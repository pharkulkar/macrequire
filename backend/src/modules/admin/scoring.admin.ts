
import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { defaultRules, defaultWeights, mergeRules, mergeWeights, Rules, Weights } from '../../engine';
import { RuleIssue, validateMergedRules, validateRulesPatch, validateWeights, validateWeightTotal } from '../../engine/rulesValidation';
import { HttpError, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { recommendationProfileSchema } from '../recommendation/profile.schema';
import { recommendationService } from '../recommendation/recommendation.service';

const idParam = z.object({ id: z.string().trim().min(1).max(60) });
const name = z.string().trim().min(1).max(80);
const createBody = z.object({ name, cloneFromId: z.string().trim().min(1).max(60).optional() }).strict();
const updateBody = z.object({ name, weights: z.record(z.string(), z.unknown()), rules: z.record(z.string(), z.unknown()) }).partial().strict().refine((b) => Object.keys(b).length > 0, 'Provide at least one field to update');
const previewBody = z
  .object({ profile: recommendationProfileSchema, ruleSetId: z.string().trim().min(1).max(60).optional(), weights: z.record(z.string(), z.unknown()).optional(), rules: z.record(z.string(), z.unknown()).optional() })
  .strict();

const fail = (issues: RuleIssue[]) => new HttpError(400, 'Invalid scoring settings', { issues });

/** Validates a patch and returns the full resulting weights and rules. */
function resolve(stored: { weights: unknown; rules: unknown }, patch: { weights?: unknown; rules?: unknown }): { weights: Weights; rules: Rules } {
  const issues: RuleIssue[] = [];
  if (patch.weights !== undefined) issues.push(...validateWeights(patch.weights));
  if (patch.rules !== undefined) issues.push(...validateRulesPatch(patch.rules));
  if (issues.length) throw fail(issues);

  const rules = mergeRules(mergeRules(defaultRules, stored.rules), patch.rules);
  const weights = { ...mergeWeights(stored.weights), ...((patch.weights as Partial<Weights> | undefined) ?? {}) };
  const merged = [...validateMergedRules(rules), ...validateWeightTotal(weights)];
  if (merged.length) throw fail(merged);
  return { weights, rules: { ...rules, version: defaultRules.version } as Rules };
}

const summary = (r: { id: string; name: string; isActive: boolean; updatedAt: Date; rules: unknown }) => ({
  id: r.id, name: r.name, isActive: r.isActive, updatedAt: r.updatedAt, rulesVersion: (r.rules as { version?: string } | null)?.version ?? null, codeVersion: defaultRules.version,
});

const detail = (r: { id: string; name: string; isActive: boolean; updatedAt: Date; weights: unknown; rules: unknown }) => ({ ...summary(r), weights: mergeWeights(r.weights), rules: mergeRules(defaultRules, r.rules) });

/** Ready-made test users so the effect of a rule change can be checked quickly. */
const SAMPLE_PROFILES = [
  { key: 'student', name: 'Student, light use', description: 'Office, browser and video calls; portability and battery matter.', useCases: ['student-academic'], apps: ['microsoft-office', 'chrome', 'zoom'], intensity: 'BASIC' as const, max: 1500, prefs: { portability: 5, batteryLife: 5 }, future: {} },
  { key: 'fullstack', name: 'Full-stack developer with Docker', description: 'Heavy IDE, database and containers.', useCases: ['full-stack-development'], apps: ['webstorm', 'nodejs', 'postgresql', 'vscode', 'chrome', 'docker-desktop'], intensity: 'HEAVY' as const, max: 3000, prefs: {}, future: {} },
  { key: 'android', name: 'Android developer, professional', description: 'Android Studio, emulators, Docker and a VM.', useCases: ['android-development'], apps: ['android-studio', 'android-emulator', 'docker-desktop', 'parallels'], intensity: 'PROFESSIONAL' as const, max: 5000, prefs: {}, future: {} },
  { key: 'video', name: 'Video editor', description: 'DaVinci Resolve, Premiere and Photoshop.', useCases: ['video-editing'], apps: ['davinci-resolve', 'premiere-pro', 'photoshop'], intensity: 'PROFESSIONAL' as const, max: 6000, prefs: {}, future: {} },
  { key: 'ai-later', name: 'Light dev now, local AI later', description: 'VS Code and Chrome today; expects to run local models.', useCases: ['software-development'], apps: ['vscode', 'chrome'], intensity: 'MODERATE' as const, max: 3000, prefs: {}, future: { runLocalAiModels: true, futureApps: ['ollama'] } },
  { key: 'no-apps', name: 'No applications selected', description: 'Checks the baseline path.', useCases: ['software-development'], apps: [], intensity: 'HEAVY' as const, max: 3000, prefs: {}, future: {} },
];

async function sampleProfiles() {
  const slugs = [...new Set(SAMPLE_PROFILES.flatMap((p) => [...p.apps, ...((p.future as { futureApps?: string[] }).futureApps ?? [])]))];
  const apps = await prisma.application.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
  const id = (slug: string) => apps.find((a) => a.slug === slug)?.id;
  return SAMPLE_PROFILES.map((p) => {
    const futureApps = (p.future as { futureApps?: string[] }).futureApps ?? [];
    return {
      key: p.key,
      name: p.name,
      description: p.description,
      profile: {
        useCases: p.useCases,
        applicationIds: p.apps.map(id).filter((x): x is string => Boolean(x)),
        intensity: p.intensity,
        future: { learnMoreLanguages: false, startVideoEditing: false, runLocalAiModels: Boolean((p.future as { runLocalAiModels?: boolean }).runLocalAiModels), useVirtualMachinesOrDocker: false, multitaskDemandingApps: false, futureApplicationIds: futureApps.map(id).filter((x): x is string => Boolean(x)) },
        budget: { country: 'US' as const, currency: 'USD' as const, min: 0, max: p.max },
        preferences: p.prefs,
      },
    };
  });
}

const h = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const adminOnly = requireRole('ADMIN');
const editors = requireRole('ADMIN', 'EDITOR');

export const scoringAdminRouter = Router();

scoringAdminRouter.get('/scoring/defaults', h(async (_req, res) => res.json({ weights: defaultWeights, rules: defaultRules })));
scoringAdminRouter.get('/scoring/sample-profiles', h(async (_req, res) => res.json({ data: await sampleProfiles() })));

scoringAdminRouter.get('/scoring/rule-sets', h(async (_req, res) => {
  const rows = await prisma.scoringRuleSet.findMany({ orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }] });
  res.json({ data: rows.map(summary) });
}));

scoringAdminRouter.get('/scoring/rule-sets/:id', validate(idParam, 'params'), h(async (req, res) => {
  const row = await prisma.scoringRuleSet.findUnique({ where: { id: req.params.id } });
  if (!row) throw notFound('Rule set');
  res.json(detail(row));
}));

scoringAdminRouter.post('/scoring/rule-sets', adminOnly, validate(createBody), h(async (req, res) => {
  const b = req.body as z.infer<typeof createBody>;
  const source = b.cloneFromId ? await prisma.scoringRuleSet.findUnique({ where: { id: b.cloneFromId } }) : await prisma.scoringRuleSet.findFirst({ where: { isActive: true } });
  if (b.cloneFromId && !source) throw notFound('Rule set to clone');
  const weights = mergeWeights(source?.weights);
  const rules = mergeRules(defaultRules, source?.rules);
  const created = await prisma.scoringRuleSet.create({ data: { name: b.name, isActive: false, weights: weights as object, rules: rules as object } });
  res.status(201).json(detail(created));
}));

scoringAdminRouter.put('/scoring/rule-sets/:id', adminOnly, validate(idParam, 'params'), validate(updateBody), h(async (req, res) => {
  const b = req.body as z.infer<typeof updateBody>;
  const row = await prisma.scoringRuleSet.findUnique({ where: { id: req.params.id } });
  if (!row) throw notFound('Rule set');
  const { weights, rules } = resolve(row, b);
  const updated = await prisma.scoringRuleSet.update({ where: { id: row.id }, data: { ...(b.name ? { name: b.name } : {}), weights: weights as object, rules: rules as object } });
  res.json(detail(updated));
}));

scoringAdminRouter.post('/scoring/rule-sets/:id/activate', adminOnly, validate(idParam, 'params'), h(async (req, res) => {
  const row = await prisma.scoringRuleSet.findUnique({ where: { id: req.params.id } });
  if (!row) throw notFound('Rule set');
  // Re-validate before going live: a stored set must be usable.
  resolve(row, {});
  await prisma.$transaction([prisma.scoringRuleSet.updateMany({ where: { isActive: true, id: { not: row.id } }, data: { isActive: false } }), prisma.scoringRuleSet.update({ where: { id: row.id }, data: { isActive: true } })]);
  res.json(detail((await prisma.scoringRuleSet.findUnique({ where: { id: row.id } }))!));
}));

// Dry run: compare the live rules with a stored set and/or unsaved edits. Nothing is saved.
scoringAdminRouter.post('/scoring/preview', editors, validate(previewBody), h(async (req, res) => {
  const b = req.body as z.infer<typeof previewBody>;
  let base: { weights: unknown; rules: unknown } = { weights: undefined, rules: undefined };
  if (b.ruleSetId) {
    const set = await prisma.scoringRuleSet.findUnique({ where: { id: b.ruleSetId } });
    if (!set) throw notFound('Rule set');
    base = set;
  } else if (b.weights || b.rules) {
    base = (await prisma.scoringRuleSet.findFirst({ where: { isActive: true } })) ?? base;
  }
  const hasCandidate = Boolean(b.ruleSetId || b.weights || b.rules);
  const candidate = hasCandidate ? resolve(base, { weights: b.weights, rules: b.rules }) : null;
  res.json(await recommendationService.preview(b.profile, candidate ?? {}));
}));

