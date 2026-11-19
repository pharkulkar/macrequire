import { parse } from 'csv-parse/sync';
import express, { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { productUrl } from '../affiliate/links';
import { imageRef } from '../affiliate/url';
import { catalogAdmin } from './catalog.admin';
import { configurationCreate, configurationUpdate } from './catalog.admin.schemas';
import { offerCreate, offerUpdate } from './commerce.schemas';
import { commerceService } from './commerce.service';

const MAX_ROWS = 5000;
const MAX_CELL = 2100;

type Row = Record<string, string>;
export interface RowResult {
  /** Only for image imports: lets the admin screen show a thumbnail so the link can be checked by eye. */
  imageUrl?: string;
  row: number; // 1-based, not counting the header
  key: string;
  status: 'create' | 'update' | 'unchanged' | 'error';
  message?: string;
}

const body = z.object({ csv: z.string().min(1, 'CSV is empty').max(3_000_000, 'CSV is too large'), dryRun: z.boolean().default(true), skipInvalid: z.boolean().default(false) }).strict();

function parseCsv(text: string): Row[] {
  let rows: Row[];
  try {
    rows = parse(text, { columns: (h: string[]) => h.map((x) => x.trim()), skip_empty_lines: true, trim: true, bom: true, relax_column_count: false }) as Row[];
  } catch (e) {
    throw new HttpError(400, `The CSV could not be read: ${(e as Error).message}`);
  }
  if (!rows.length) throw new HttpError(400, 'The CSV has a header but no rows');
  if (rows.length > MAX_ROWS) throw new HttpError(400, `Too many rows (maximum ${MAX_ROWS})`);
  for (const r of rows) for (const v of Object.values(r)) if (v.length > MAX_CELL) throw new HttpError(400, 'A cell is too long');
  return rows;
}

/** Stops spreadsheet apps from running a cell as a formula when an exported file is opened. */
const safeCell = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  const guarded = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
};
const toCsv = (header: string[], rows: unknown[][]) => [header.map(safeCell).join(','), ...rows.map((r) => r.map(safeCell).join(','))].join('\n') + '\n';

const num = (v: string | undefined): number | null | undefined => {
  if (v === undefined || v === '') return undefined; // blank = leave as is
  const n = Number(v.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};
const storageLabel = (gb: number) => (gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`);

// ------------------------------------------------------------------------ offers
async function runOffers(rows: Row[], dryRun: boolean, skipInvalid: boolean, isAdmin: boolean) {
  const [configs, merchants] = await Promise.all([
    prisma.productConfiguration.findMany({ select: { id: true, modelId: true, ramGB: true, storageGB: true, cpuCores: true, gpuCores: true, model: { select: { slug: true, name: true } }, chip: { select: { name: true } } } }),
    prisma.merchant.findMany(),
  ]);
  const byId = new Map(configs.map((c) => [c.id, c]));
  const natural = new Map(configs.map((c) => [`${c.model.slug}|${c.chip.name.toLowerCase()}|${c.cpuCores}|${c.gpuCores}|${c.ramGB}|${c.storageGB}`, c]));
  // A configuration has a different id in every database (local, production), so ids are only a shortcut. A row is
  // matched by its stable details: model slug (or model name), chip, cores, memory and storage. Those are the same
  // everywhere, so one CSV works in every environment.
  const byName = new Map(configs.map((c) => [`${c.model.name.toLowerCase()}|${c.chip.name.toLowerCase()}|${c.cpuCores}|${c.gpuCores}|${c.ramGB}|${c.storageGB}`, c]));
  const merchantBySlug = new Map(merchants.map((m) => [m.slug, m]));
  const results: RowResult[] = [];
  const plan: { index: number; action: 'create' | 'update'; configurationId: string; merchantId: string; existingId?: string; input: Record<string, unknown> }[] = [];
  const seen = new Set<string>();

  for (const [i, r] of rows.entries()) {
    const n = i + 1;
    const fail = (key: string, message: string) => results.push({ row: n, key, status: 'error', message });
    const spec = `${(r.chip ?? '').toLowerCase()}|${r.cpuCores}|${r.gpuCores}|${r.ramGB}|${r.storageGB}`;
    const cfg =
      (r.configurationId ? byId.get(r.configurationId) : undefined) ??
      natural.get(`${(r.modelSlug ?? '').toLowerCase()}|${spec}`) ??
      byName.get(`${(r.model ?? '').toLowerCase()}|${spec}`);
    const key = cfg ? `${r.merchantSlug} · ${cfg.model.slug} · ${cfg.chip.name} · ${cfg.ramGB}GB · ${storageLabel(cfg.storageGB)}` : `row ${n}`;
    if (!cfg) { fail(key, 'Configuration not found (check configurationId, or the model name or modelSlug with chip, cpuCores, gpuCores, ramGB and storageGB)'); continue; }
    const merchant = merchantBySlug.get(r.merchantSlug ?? '');
    if (!merchant) { fail(key, `Unknown merchantSlug "${r.merchantSlug ?? ''}"`); continue; }
    const dupKey = `${cfg.id}|${merchant.id}`;
    if (seen.has(dupKey)) { fail(key, 'Duplicate row for the same configuration and merchant'); continue; }
    seen.add(dupKey);

    const price = num(r.price), listPrice = num(r.listPrice);
    if (Number.isNaN(price) || Number.isNaN(listPrice)) { fail(key, 'price/listPrice must be numbers'); continue; }

    const existing = await prisma.merchantOffer.findUnique({ where: { configurationId_merchantId_country: { configurationId: cfg.id, merchantId: merchant.id, country: merchant.country } } });
    const provided: Record<string, unknown> = {};
    if (price !== undefined) provided.price = price;
    if (listPrice !== undefined) provided.listPrice = listPrice;
    if (r.stock) provided.stock = r.stock.toUpperCase();
    if (r.productId) provided.productId = r.productId;
    if (r.regularUrl) provided.regularUrl = r.regularUrl;
    if (r.affiliateUrl) provided.affiliateUrl = r.affiliateUrl;
    if (r.source) provided.source = r.source.toUpperCase();

    if (!isAdmin && provided.affiliateUrl && provided.affiliateUrl !== existing?.affiliateUrl) { fail(key, 'Only an ADMIN can set or change an affiliate URL. Leave the affiliateUrl column blank.'); continue; }
    if (!existing) {
      if (!provided.regularUrl && !productUrl(merchant.productUrlTemplate, (provided.productId as string | undefined) ?? null)) {
        fail(key, merchant.productUrlTemplate ? 'New offers need a productId (for example the ASIN) or a regularUrl' : `New offers need a regularUrl. ${merchant.name} has no product link template, so a productId alone cannot make a link`);
        continue;
      }
      const parsed = offerCreate.safeParse({ configurationId: cfg.id, merchantId: merchant.id, ...provided });
      if (!parsed.success) { fail(key, parsed.error.issues.map((x) => `${x.path.join('.') || 'row'}: ${x.message}`).join('; ')); continue; }
      results.push({ row: n, key, status: 'create' });
      plan.push({ index: n, action: 'create', configurationId: cfg.id, merchantId: merchant.id, input: parsed.data });
    } else {
      const parsed = offerUpdate.safeParse(provided);
      if (!parsed.success && Object.keys(provided).length) { fail(key, parsed.error.issues.map((x) => `${x.path.join('.') || 'row'}: ${x.message}`).join('; ')); continue; }
      const changes = Object.fromEntries(Object.entries(provided).filter(([k, v]) => (existing as unknown as Record<string, unknown>)[k] !== v));
      const merged = { price: existing.price, listPrice: existing.listPrice, ...changes } as { price: number | null; listPrice: number | null };
      if (merged.price !== null && merged.listPrice !== null && merged.listPrice < merged.price) { fail(key, 'List price cannot be lower than the selling price'); continue; }
      if (!Object.keys(changes).length) { results.push({ row: n, key, status: 'unchanged' }); continue; }
      results.push({ row: n, key, status: 'update', message: `changes: ${Object.keys(changes).join(', ')}` });
      plan.push({ index: n, action: 'update', configurationId: cfg.id, merchantId: merchant.id, existingId: existing.id, input: changes });
    }
  }

  return finish('offers', results, dryRun, skipInvalid, async () => {
    for (const p of plan) {
      try {
        if (p.action === 'create') await commerceService.createOffer(p.input as never);
        else await commerceService.updateOffer(p.existingId!, p.input as never);
      } catch (e) {
        const r = results.find((x) => x.row === p.index)!;
        r.status = 'error';
        r.message = (e as Error).message;
      }
    }
  });
}

// ---------------------------------------------------------------- configurations
async function runConfigurations(rows: Row[], dryRun: boolean, skipInvalid: boolean) {
  const [models, chips] = await Promise.all([prisma.productModel.findMany(), prisma.chipSpecification.findMany()]);
  const modelBySlug = new Map(models.map((m) => [m.slug, m]));
  const chipByName = new Map(chips.map((c) => [c.name.toLowerCase(), c]));
  const results: RowResult[] = [];
  const plan: { index: number; action: 'create' | 'update'; modelId: string; chipId: string; id?: string; input: Record<string, unknown> }[] = [];
  const seen = new Set<string>();

  for (const [i, r] of rows.entries()) {
    const n = i + 1;
    const key = `${r.modelSlug} · ${r.chip} · ${r.ramGB}GB · ${r.storageGB}GB`;
    const fail = (message: string) => results.push({ row: n, key, status: 'error', message });
    const model = modelBySlug.get((r.modelSlug ?? '').toLowerCase());
    const chip = chipByName.get((r.chip ?? '').toLowerCase());
    if (!model) { fail(`Unknown modelSlug "${r.modelSlug ?? ''}". Create the model first.`); continue; }
    if (!chip) { fail(`Unknown chip "${r.chip ?? ''}". Create the chip first.`); continue; }
    const cpu = Number(r.cpuCores), gpu = Number(r.gpuCores), ram = Number(r.ramGB), storage = Number(r.storageGB);
    const dup = `${model.id}|${chip.id}|${cpu}|${gpu}|${ram}|${storage}`;
    if (seen.has(dup)) { fail('Duplicate row'); continue; }
    seen.add(dup);

    const optional: Record<string, unknown> = {};
    if (r.sku) optional.sku = r.sku;
    if (r.colors) optional.colors = r.colors.split('|').map((c) => c.trim()).filter(Boolean);
    if (r.verification) optional.verification = r.verification.toUpperCase();
    if (r.source) optional.source = r.source.toUpperCase();
    if (r.isActive) optional.isActive = r.isActive.toLowerCase() === 'true';

    const existing = await prisma.productConfiguration.findUnique({ where: { modelId_chipId_cpuCores_gpuCores_ramGB_storageGB: { modelId: model.id, chipId: chip.id, cpuCores: cpu, gpuCores: gpu, ramGB: ram, storageGB: storage } } });
    if (!existing) {
      const parsed = configurationCreate.safeParse({ modelId: model.id, chipId: chip.id, cpuCores: cpu, gpuCores: gpu, ramGB: ram, storageGB: storage, ...optional });
      if (!parsed.success) { fail(parsed.error.issues.map((x) => `${x.path.join('.') || 'row'}: ${x.message}`).join('; ')); continue; }
      if (cpu > chip.cpuCores || gpu > chip.gpuCores) { fail(`${chip.name} has at most ${chip.cpuCores} CPU / ${chip.gpuCores} GPU cores`); continue; }
      results.push({ row: n, key, status: 'create', message: 'specifications will be copied from a sibling configuration if one exists' });
      plan.push({ index: n, action: 'create', modelId: model.id, chipId: chip.id, input: parsed.data });
    } else {
      const parsed = configurationUpdate.safeParse(optional);
      if (Object.keys(optional).length && !parsed.success) { fail(parsed.error.issues.map((x) => `${x.path.join('.') || 'row'}: ${x.message}`).join('; ')); continue; }
      const changes = Object.fromEntries(Object.entries(optional).filter(([k, v]) => JSON.stringify((existing as unknown as Record<string, unknown>)[k]) !== JSON.stringify(v)));
      if (!Object.keys(changes).length) { results.push({ row: n, key, status: 'unchanged' }); continue; }
      results.push({ row: n, key, status: 'update', message: `changes: ${Object.keys(changes).join(', ')}` });
      plan.push({ index: n, action: 'update', modelId: model.id, chipId: chip.id, id: existing.id, input: changes });
    }
  }

  return finish('configurations', results, dryRun, skipInvalid, async () => {
    for (const p of plan) {
      try {
        if (p.action === 'update') await catalogAdmin.updateConfiguration(p.id!, p.input as never);
        else {
          const created = await catalogAdmin.createConfiguration(p.input as never);
          const sibling = await prisma.productConfiguration.findFirst({ where: { modelId: p.modelId, chipId: p.chipId, id: { not: created.id }, specification: { isNot: null } }, include: { specification: true } });
          if (sibling?.specification) {
            const { id: _id, configurationId: _cid, updatedAt: _u, ...spec } = sibling.specification;
            void _id; void _cid; void _u;
            await prisma.configurationSpecification.create({ data: { ...spec, extra: spec.extra ?? undefined, configurationId: created.id } });
          }
        }
      } catch (e) {
        const r = results.find((x) => x.row === p.index)!;
        r.status = 'error';
        r.message = (e as Error).message;
      }
    }
  });
}

// ------------------------------------------------------------------------ images
/** One row per model: modelSlug, imageUrl. A blank imageUrl leaves the current image; the word CLEAR removes it. */
async function runImages(rows: Row[], dryRun: boolean, skipInvalid: boolean) {
  const models = await prisma.productModel.findMany();
  const bySlug = new Map(models.map((m) => [m.slug.toLowerCase(), m]));
  const results: RowResult[] = [];
  const plan: { index: number; id: string; imageUrl: string | null }[] = [];
  const seen = new Set<string>();
  for (const [i, r] of rows.entries()) {
    const n = i + 1;
    const slug = (r.modelSlug ?? '').toLowerCase();
    const model = bySlug.get(slug);
    const key = model ? model.name : `row ${n}`;
    const fail = (message: string) => results.push({ row: n, key, status: 'error', message });
    if (!model) { fail(`Unknown modelSlug "${r.modelSlug ?? ''}"`); continue; }
    if (seen.has(slug)) { fail('Duplicate row for the same model'); continue; }
    seen.add(slug);
    const raw = (r.imageUrl ?? '').trim();
    if (!raw) { results.push({ row: n, key, status: 'unchanged' }); continue; }
    let next: string | null;
    if (raw.toUpperCase() === 'CLEAR') next = null;
    else {
      const parsed = imageRef.safeParse(raw);
      if (!parsed.success) { fail(`imageUrl: ${parsed.error.issues[0]?.message ?? 'invalid URL'}`); continue; }
      next = parsed.data;
    }
    if (next === model.imageUrl) { results.push({ row: n, key, status: 'unchanged' }); continue; }
    results.push({ row: n, key, status: 'update', message: next ?? 'image will be removed', ...(next ? { imageUrl: next } : {}) });
    plan.push({ index: n, id: model.id, imageUrl: next });
  }
  return finish('images', results, dryRun, skipInvalid, async () => {
    for (const p of plan) {
      try {
        await catalogAdmin.updateModel(p.id, { imageUrl: p.imageUrl });
      } catch (e) {
        const r = results.find((x) => x.row === p.index)!;
        r.status = 'error';
        r.message = (e as Error).message;
      }
    }
  });
}

async function finish(kind: string, results: RowResult[], dryRun: boolean, skipInvalid: boolean, apply: () => Promise<void>) {
  const errors = results.filter((r) => r.status === 'error').length;
  // All-or-nothing unless the admin explicitly chooses to skip invalid rows.
  const blocked = !dryRun && errors > 0 && !skipInvalid;
  if (!dryRun && !blocked) await apply();
  const count = (s: RowResult['status']) => results.filter((r) => r.status === s).length;
  return {
    kind,
    dryRun,
    applied: !dryRun && !blocked,
    blocked,
    totals: { rows: results.length, create: count('create'), update: count('update'), unchanged: count('unchanged'), error: count('error') },
    results,
    message: blocked ? 'Nothing was imported because some rows have errors. Fix them, or import with "skip invalid rows".' : dryRun ? 'Preview only. Nothing was changed.' : 'Import complete.',
  };
}

// -------------------------------------------------------------------- templates
async function offersTemplate(merchantSlug: string) {
  const merchant = await prisma.merchant.findUnique({ where: { slug: merchantSlug } });
  if (!merchant) throw new HttpError(404, `Merchant "${merchantSlug}" not found`);
  const configs = await prisma.productConfiguration.findMany({
    where: { isActive: true, model: { isActive: true } },
    orderBy: [{ model: { name: 'asc' } }, { chip: { name: 'asc' } }, { ramGB: 'asc' }, { storageGB: 'asc' }],
    include: { model: { select: { name: true, slug: true } }, chip: { select: { name: true } }, offers: { where: { merchantId: merchant.id, country: merchant.country } } },
  });
  const header = ['configurationId', 'modelSlug', 'model', 'chip', 'cpuCores', 'gpuCores', 'ramGB', 'storageGB', 'merchantSlug', 'price', 'listPrice', 'stock', 'productId', 'regularUrl', 'affiliateUrl', 'source'];
  const rows = configs.map((c) => {
    const o = c.offers[0];
    return [c.id, c.model.slug, c.model.name, c.chip.name, c.cpuCores, c.gpuCores, c.ramGB, c.storageGB, merchant.slug, o?.price ?? '', o?.listPrice ?? '', o?.stock ?? '', o?.productId ?? '', o?.regularUrl ?? '', o?.affiliateUrl ?? '', o?.source ?? ''];
  });
  return toCsv(header, rows);
}

async function configurationsTemplate() {
  const configs = await prisma.productConfiguration.findMany({ orderBy: [{ model: { name: 'asc' } }, { chip: { name: 'asc' } }, { ramGB: 'asc' }, { storageGB: 'asc' }], include: { model: { select: { slug: true } }, chip: { select: { name: true } } } });
  const header = ['modelSlug', 'chip', 'cpuCores', 'gpuCores', 'ramGB', 'storageGB', 'sku', 'colors', 'verification', 'source', 'isActive'];
  return toCsv(header, configs.map((c) => [c.model.slug, c.chip.name, c.cpuCores, c.gpuCores, c.ramGB, c.storageGB, c.sku ?? '', c.colors.join('|'), c.verification, c.source, c.isActive]));
}

async function imagesTemplate() {
  const models = await prisma.productModel.findMany({ orderBy: [{ category: 'asc' }, { screenSizeInch: 'asc' }, { name: 'asc' }] });
  return toCsv(['modelSlug', 'name', 'imageUrl'], models.map((m) => [m.slug, m.name, m.imageUrl ?? '']));
}

const h = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const editors = requireRole('ADMIN', 'EDITOR');
const send = (res: Response, filename: string, csv: string) => res.set({ 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${filename}"`, 'cache-control': 'no-store' }).send(csv);

export const importsRouter = Router();
// Mounted after requireAdmin. Allows the larger CSV bodies for these routes only.
importsRouter.use('/imports', express.json({ limit: '3mb' }));
importsRouter.get('/imports/offers/template', validate(z.object({ merchant: z.string().trim().min(1).max(60) }), 'query'), h(async (req, res) => send(res, `offers-${req.query.merchant}.csv`, await offersTemplate(String(req.query.merchant)))));
importsRouter.get('/imports/configurations/template', h(async (_req, res) => send(res, 'configurations.csv', await configurationsTemplate())));

importsRouter.get('/imports/images/template', h(async (_req, res) => send(res, 'model-images.csv', await imagesTemplate())));

importsRouter.post('/imports/images', editors, validate(body), h(async (req, res) => {
  const b = req.body as z.infer<typeof body>;
  const out = await runImages(parseCsv(b.csv), b.dryRun, b.skipInvalid);
  res.locals.auditSummary = { import: 'images', dryRun: out.dryRun, applied: out.applied, totals: out.totals };
  res.status(out.blocked ? 422 : 200).json(out);
}));

importsRouter.post('/imports/offers', editors, validate(body), h(async (req, res) => {
  const b = req.body as z.infer<typeof body>;
  const out = await runOffers(parseCsv(b.csv), b.dryRun, b.skipInvalid, req.admin?.role === 'ADMIN');
  res.locals.auditSummary = { import: 'offers', dryRun: out.dryRun, applied: out.applied, totals: out.totals };
  res.status(out.blocked ? 422 : 200).json(out);
}));

importsRouter.post('/imports/configurations', editors, validate(body), h(async (req, res) => {
  const b = req.body as z.infer<typeof body>;
  const out = await runConfigurations(parseCsv(b.csv), b.dryRun, b.skipInvalid);
  res.locals.auditSummary = { import: 'configurations', dryRun: out.dryRun, applied: out.applied, totals: out.totals };
  res.status(out.blocked ? 422 : 200).json(out);
}));
