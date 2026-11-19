import { Prisma } from '@prisma/client';
import { NextFunction, Request, Response, Router } from 'express';
import { HttpError, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  chipCreate, ChipCreate, chipUpdate, ChipUpdate, configurationCreate, ConfigurationCreate, configurationListQuery,
  configurationUpdate, ConfigurationUpdate, idParam, modelCreate, ModelCreate, modelListQuery, modelUpdate, ModelUpdate,
} from './catalog.admin.schemas';

const storageLabel = (gb: number) => (gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`);
const pagination = (page: number, pageSize: number, total: number) => ({ page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });

async function guardUnique<T>(op: () => Promise<T>, message: string): Promise<T> {
  try {
    return await op();
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new HttpError(409, message);
    throw e;
  }
}

const configInclude = { model: { select: { id: true, name: true, slug: true } }, chip: { select: { id: true, name: true } }, specification: true, _count: { select: { offers: true } } } satisfies Prisma.ProductConfigurationInclude;
type ConfigRecord = Prisma.ProductConfigurationGetPayload<{ include: typeof configInclude }>;
const configDto = (c: ConfigRecord) => ({
  id: c.id, sku: c.sku, isActive: c.isActive, model: c.model, chip: c.chip, cpuCores: c.cpuCores, gpuCores: c.gpuCores, ramGB: c.ramGB, storageGB: c.storageGB,
  label: `${c.chip.name} (${c.cpuCores}-core CPU, ${c.gpuCores}-core GPU) · ${c.ramGB}GB · ${storageLabel(c.storageGB)}`,
  colors: c.colors, verification: c.verification, source: c.source, verifiedAt: c.verifiedAt, offerCount: c._count.offers, specification: c.specification,
});

export const catalogAdmin = {
  // ------------------------------------------------------------------ chips
  async listChips() {
    const rows = await prisma.chipSpecification.findMany({ orderBy: [{ family: 'asc' }, { name: 'asc' }], include: { _count: { select: { configurations: true } } } });
    return { data: rows.map((c) => ({ ...c, configurationCount: c._count.configurations, _count: undefined })) };
  },
  createChip: (input: ChipCreate) => guardUnique(() => prisma.chipSpecification.create({ data: input }), `A chip named "${input.name}" already exists`),
  async updateChip(id: string, input: ChipUpdate) {
    const chip = await prisma.chipSpecification.findUnique({ where: { id }, include: { configurations: { select: { cpuCores: true, gpuCores: true } } } });
    if (!chip) throw notFound('Chip');
    // Capability indices are scaled by cores / chip maximum, so a configuration must never exceed its chip.
    const cpu = input.cpuCores ?? chip.cpuCores;
    const gpu = input.gpuCores ?? chip.gpuCores;
    if (chip.configurations.some((c) => c.cpuCores > cpu || c.gpuCores > gpu)) throw new HttpError(400, 'Core counts cannot be lower than the largest configuration that uses this chip');
    return guardUnique(() => prisma.chipSpecification.update({ where: { id }, data: input }), `A chip with that name already exists`);
  },

  // ----------------------------------------------------------------- models
  async listModels(q: { page: number; pageSize: number; q?: string; includeInactive: boolean }) {
    const where: Prisma.ProductModelWhereInput = { ...(q.includeInactive ? {} : { isActive: true }), ...(q.q && { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { slug: { contains: q.q.toLowerCase() } }] }) };
    const [total, rows] = await prisma.$transaction([
      prisma.productModel.count({ where }),
      prisma.productModel.findMany({ where, orderBy: [{ releaseYear: 'desc' }, { name: 'asc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { _count: { select: { configurations: true } } } }),
    ]);
    return { data: rows.map((m) => ({ ...m, configurationCount: m._count.configurations, _count: undefined })), pagination: pagination(q.page, q.pageSize, total) };
  },
  createModel: (input: ModelCreate) => guardUnique(() => prisma.productModel.create({ data: input }), `A model with slug "${input.slug}" already exists`),
  async updateModel(id: string, input: ModelUpdate) {
    if (!(await prisma.productModel.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Model');
    return prisma.productModel.update({ where: { id }, data: input });
  },

  // --------------------------------------------------------- configurations
  async listConfigurations(q: { page: number; pageSize: number; modelId?: string; chipId?: string; includeInactive: boolean; verification?: string }) {
    const where: Prisma.ProductConfigurationWhereInput = {
      ...(q.includeInactive ? {} : { isActive: true }),
      ...(q.modelId && { modelId: q.modelId }),
      ...(q.chipId && { chipId: q.chipId }),
      ...(q.verification && { verification: q.verification }),
    };
    const [total, rows] = await prisma.$transaction([
      prisma.productConfiguration.count({ where }),
      prisma.productConfiguration.findMany({ where, include: configInclude, orderBy: [{ model: { name: 'asc' } }, { chip: { name: 'asc' } }, { ramGB: 'asc' }, { storageGB: 'asc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    ]);
    return { data: rows.map(configDto), pagination: pagination(q.page, q.pageSize, total) };
  },

  async getConfiguration(id: string) {
    const c = await prisma.productConfiguration.findUnique({ where: { id }, include: configInclude });
    if (!c) throw notFound('Configuration');
    return configDto(c);
  },

  async createConfiguration(input: ConfigurationCreate) {
    const [model, chip] = await Promise.all([prisma.productModel.findUnique({ where: { id: input.modelId } }), prisma.chipSpecification.findUnique({ where: { id: input.chipId } })]);
    if (!model) throw notFound('Model');
    if (!chip) throw notFound('Chip');
    if (input.cpuCores > chip.cpuCores || input.gpuCores > chip.gpuCores) {
      throw new HttpError(400, `${chip.name} has at most ${chip.cpuCores} CPU and ${chip.gpuCores} GPU cores. Raise the chip's maximums first if this variant really exists.`);
    }
    const { spec, ...rest } = input;
    const created = await guardUnique(
      () => prisma.productConfiguration.create({ data: { ...rest, ...(spec ? { specification: { create: spec } } : {}) } }),
      'That exact combination (model, chip, cores, memory, storage) already exists',
    );
    return this.getConfiguration(created.id);
  },

  async updateConfiguration(id: string, input: ConfigurationUpdate) {
    const existing = await prisma.productConfiguration.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw notFound('Configuration');
    const { spec, ...rest } = input;
    await guardUnique(
      () => prisma.productConfiguration.update({ where: { id }, data: { ...rest, ...(spec ? { specification: { upsert: { create: spec, update: spec } } } : {}) } }),
      'That SKU is already used by another configuration',
    );
    return this.getConfiguration(id);
  },
};

const h = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const editors = requireRole('ADMIN', 'EDITOR');

export const catalogAdminRouter = Router();
catalogAdminRouter.get('/chips', h(async (_req, res) => res.json(await catalogAdmin.listChips())));
catalogAdminRouter.post('/chips', editors, validate(chipCreate), h(async (req, res) => res.status(201).json(await catalogAdmin.createChip(req.body))));
catalogAdminRouter.patch('/chips/:id', editors, validate(idParam, 'params'), validate(chipUpdate), h(async (req, res) => res.json(await catalogAdmin.updateChip(req.params.id, req.body))));

catalogAdminRouter.get('/models', validate(modelListQuery, 'query'), h(async (req, res) => res.json(await catalogAdmin.listModels(req.query as never))));
catalogAdminRouter.post('/models', editors, validate(modelCreate), h(async (req, res) => res.status(201).json(await catalogAdmin.createModel(req.body))));
catalogAdminRouter.patch('/models/:id', editors, validate(idParam, 'params'), validate(modelUpdate), h(async (req, res) => res.json(await catalogAdmin.updateModel(req.params.id, req.body))));

catalogAdminRouter.get('/configurations', validate(configurationListQuery, 'query'), h(async (req, res) => res.json(await catalogAdmin.listConfigurations(req.query as never))));
catalogAdminRouter.post('/configurations', editors, validate(configurationCreate), h(async (req, res) => res.status(201).json(await catalogAdmin.createConfiguration(req.body))));
catalogAdminRouter.get('/configurations/:id', validate(idParam, 'params'), h(async (req, res) => res.json(await catalogAdmin.getConfiguration(req.params.id))));
catalogAdminRouter.patch('/configurations/:id', editors, validate(idParam, 'params'), validate(configurationUpdate), h(async (req, res) => res.json(await catalogAdmin.updateConfiguration(req.params.id, req.body))));
