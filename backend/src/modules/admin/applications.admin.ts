import { Prisma } from '@prisma/client';
import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { CATEGORY_KEYS } from '../../engine';
import { HttpError, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { merchantUrl } from '../affiliate/url';

const id = z.string().trim().min(1).max(60);
const bool = z.enum(['true', 'false']).transform((v) => v === 'true');
const text = (max = 300) => z.string().trim().max(max);

const requirementFields = {
  minRamGB: z.number().int().min(1).max(1024),
  preferredRamGB: z.number().int().min(1).max(1024),
  cpuDemand: z.number().int().min(1).max(10),
  gpuDemand: z.number().int().min(1).max(10),
  storageGB: z.number().int().min(0).max(20000),
  intensity: z.enum(['BASIC', 'MODERATE', 'HEAVY', 'PROFESSIONAL']),
  concurrencyFactor: z.number().min(0).max(1),
  needsAppleSilicon: z.boolean(),
  basis: z.enum(['VENDOR_PUBLISHED', 'ESTIMATE']),
  basisNote: text(600).nullable(),
  sourceUrl: merchantUrl.nullable(),
};
const requirementCreate = z.object(requirementFields).extend({ needsAppleSilicon: requirementFields.needsAppleSilicon.default(false), basis: requirementFields.basis.default('ESTIMATE'), basisNote: requirementFields.basisNote.optional(), sourceUrl: requirementFields.sourceUrl.optional() }).strict();
const requirementUpdate = z.object(requirementFields).partial().strict();

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens').max(80);

export const applicationCreate = z
  .object({ slug, name: text(100).min(1), category: text(60).min(1), macSupported: z.boolean().default(true), aliases: z.array(text(40)).max(20).default([]), notes: text(600).optional(), requirements: requirementCreate })
  .strict()
  .refine((a) => a.requirements.preferredRamGB >= a.requirements.minRamGB, { message: 'Preferred memory cannot be lower than minimum', path: ['requirements', 'preferredRamGB'] });

export const applicationUpdate = z
  .object({ name: text(100).min(1), category: text(60).min(1), macSupported: z.boolean(), aliases: z.array(text(40)).max(20), notes: text(600).nullable(), isActive: z.boolean(), requirements: requirementUpdate })
  .partial()
  .strict()
  .refine((b) => Object.keys(b).length > 0, 'Provide at least one field to update');

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: text(80).optional(),
  category: text(60).optional(),
  includeInactive: bool.prefault('false'),
});

const useCaseUpdate = z
  .object({
    name: text(100).min(1),
    description: text(300).nullable(),
    appCategories: z.array(text(60)).max(20),
    /** Application slugs preselected when a visitor starts from this use case. */
    starterApps: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use application slugs such as vscode')).max(12),
    isActive: z.boolean(),
    /** Scoring emphasis per category. 1 = neutral. */
    weights: z.record(z.string(), z.number().min(0.1).max(3)),
  })
  .partial()
  .strict()
  .refine((b) => Object.keys(b).length > 0, 'Provide at least one field to update')
  .refine((b) => !b.weights || Object.keys(b.weights).every((k) => (CATEGORY_KEYS as readonly string[]).includes(k)), { message: `Weight keys must be one of: ${CATEGORY_KEYS.join(', ')}`, path: ['weights'] });

const include = { requirements: true } satisfies Prisma.ApplicationInclude;
type AppRecord = Prisma.ApplicationGetPayload<{ include: typeof include }>;
const dto = (a: AppRecord) => ({ id: a.id, slug: a.slug, name: a.name, category: a.category, macSupported: a.macSupported, aliases: a.aliases, notes: a.notes, isActive: a.isActive, requirements: a.requirements, updatedAt: a.updatedAt });

const service = {
  async list(q: z.infer<typeof listQuery>) {
    const where: Prisma.ApplicationWhereInput = {
      ...(q.includeInactive ? {} : { isActive: true }),
      ...(q.category && { category: q.category }),
      ...(q.q && { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { slug: { contains: q.q.toLowerCase() } }, { aliases: { has: q.q.toLowerCase() } }] }),
    };
    const [total, rows] = await prisma.$transaction([
      prisma.application.count({ where }),
      prisma.application.findMany({ where, include, orderBy: [{ category: 'asc' }, { name: 'asc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    ]);
    return { data: rows.map(dto), pagination: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) } };
  },

  async get(idv: string) {
    const a = await prisma.application.findUnique({ where: { id: idv }, include });
    if (!a) throw notFound('Application');
    return dto(a);
  },

  async create(input: z.infer<typeof applicationCreate>) {
    const { requirements, ...app } = input;
    try {
      const created = await prisma.application.create({
        data: { ...app, requirements: { create: { ...requirements, verifiedAt: requirements.basis === 'VENDOR_PUBLISHED' ? new Date() : null } } },
        include,
      });
      return dto(created);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new HttpError(409, `An application with slug "${input.slug}" already exists`);
      throw e;
    }
  },

  async update(idv: string, input: z.infer<typeof applicationUpdate>) {
    const existing = await prisma.application.findUnique({ where: { id: idv }, include });
    if (!existing) throw notFound('Application');
    const { requirements, ...app } = input;
    if (requirements) {
      const min = requirements.minRamGB ?? existing.requirements?.minRamGB ?? 1;
      const pref = requirements.preferredRamGB ?? existing.requirements?.preferredRamGB ?? min;
      if (pref < min) throw new HttpError(400, 'Preferred memory cannot be lower than minimum');
      const basis = requirements.basis ?? existing.requirements?.basis;
      if (basis === 'VENDOR_PUBLISHED' && !(requirements.sourceUrl ?? existing.requirements?.sourceUrl)) throw new HttpError(400, 'A vendor-published requirement needs a source URL');
    }
    const updated = await prisma.application.update({
      where: { id: idv },
      data: {
        ...app,
        ...(requirements
          ? { requirements: { upsert: { update: { ...requirements, ...(requirements.basis === 'VENDOR_PUBLISHED' ? { verifiedAt: new Date() } : {}) }, create: { minRamGB: 1, preferredRamGB: 1, cpuDemand: 1, gpuDemand: 1, storageGB: 0, ...requirements } } } }
          : {}),
      },
      include,
    });
    return dto(updated);
  },

  async listUseCases() {
    const rows = await prisma.useCase.findMany({ orderBy: { sortOrder: 'asc' }, include: { weights: true } });
    return { data: rows.map((u) => ({ id: u.id, slug: u.slug, name: u.name, description: u.description, appCategories: u.appCategories, starterApps: u.starterApps, isActive: u.isActive, weights: Object.fromEntries(u.weights.map((w) => [w.category, w.multiplier])) })) };
  },

  async updateUseCase(idv: string, input: z.infer<typeof useCaseUpdate>) {
    if (!(await prisma.useCase.findUnique({ where: { id: idv }, select: { id: true } }))) throw notFound('Use case');
    const { weights, ...rest } = input;
    if (rest.starterApps?.length) {
      const found = await prisma.application.findMany({ where: { slug: { in: rest.starterApps } }, select: { slug: true } });
      const missing = rest.starterApps.filter((s) => !found.some((f) => f.slug === s));
      if (missing.length) throw new HttpError(400, `Unknown application slug(s): ${missing.join(', ')}`);
    }
    await prisma.$transaction(async (tx) => {
      if (Object.keys(rest).length) await tx.useCase.update({ where: { id: idv }, data: rest });
      if (weights) {
        // The submitted map is the full set: categories left out return to neutral (row removed).
        await tx.useCaseWeight.deleteMany({ where: { useCaseId: idv, category: { notIn: Object.keys(weights) } } });
        for (const [category, multiplier] of Object.entries(weights)) {
          await tx.useCaseWeight.upsert({ where: { useCaseId_category: { useCaseId: idv, category } }, update: { multiplier }, create: { useCaseId: idv, category, multiplier } });
        }
      }
    });
    return (await this.listUseCases()).data.find((u) => u.id === idv);
  },
};

const h = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const editors = requireRole('ADMIN', 'EDITOR');
const idParam = z.object({ id });

export const applicationsAdminRouter = Router();
applicationsAdminRouter.get('/applications', validate(listQuery, 'query'), h(async (req, res) => res.json(await service.list(req.query as never))));
applicationsAdminRouter.post('/applications', editors, validate(applicationCreate), h(async (req, res) => res.status(201).json(await service.create(req.body))));
applicationsAdminRouter.get('/applications/:id', validate(idParam, 'params'), h(async (req, res) => res.json(await service.get(req.params.id))));
applicationsAdminRouter.patch('/applications/:id', editors, validate(idParam, 'params'), validate(applicationUpdate), h(async (req, res) => res.json(await service.update(req.params.id, req.body))));
applicationsAdminRouter.get('/use-cases', h(async (_req, res) => res.json(await service.listUseCases())));
applicationsAdminRouter.patch('/use-cases/:id', editors, validate(idParam, 'params'), validate(useCaseUpdate), h(async (req, res) => res.json(await service.updateUseCase(req.params.id, req.body))));
