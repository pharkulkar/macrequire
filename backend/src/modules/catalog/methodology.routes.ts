import { publicConfigurationFilter } from '../../lib/site-settings';
import { NextFunction, Request, Response, Router } from 'express';
import { defaultRules, mergeRules, mergeWeights } from '../../engine';
import { prisma } from '../../lib/prisma';

/**
 * Public, read-only summary of how recommendations are produced. It is built from the live rule set and the
 * database, so the methodology page can never drift from what the engine actually does. Only headline
 * parameters are exposed; the full rules stay in the admin.
 */
async function methodology() {
  const [ruleSet, configs, apps, chips, lastVerified] = await Promise.all([
    prisma.scoringRuleSet.findFirst({ where: { isActive: true } }),
    prisma.productConfiguration.groupBy({ by: ['verification'], where: { isActive: true, ...publicConfigurationFilter(), model: { isActive: true } }, _count: { _all: true } }),
    prisma.applicationRequirement.groupBy({ by: ['basis'], where: { application: { isActive: true } }, _count: { _all: true } }),
    prisma.chipSpecification.findMany({ select: { perfIndexBasis: true } }),
    prisma.productConfiguration.aggregate({ where: { isActive: true }, _max: { verifiedAt: true } }),
  ]);
  const weights = mergeWeights(ruleSet?.weights);
  const rules = mergeRules(defaultRules, ruleSet?.rules);
  const core = (['cpu', 'gpu', 'ram', 'storage', 'compatibility', 'budget', 'portability', 'battery', 'future'] as const).map((k) => ({ key: k, weight: weights[k] }));
  const total = core.reduce((s, c) => s + c.weight, 0) || 1;
  const count = (rows: { _count: { _all: number } }[]) => rows.reduce((s, r) => s + r._count._all, 0);
  const cfg = (v: string) => configs.find((c) => c.verification === v)?._count._all ?? 0;
  const app = (b: string) => apps.find((a) => a.basis === b)?._count._all ?? 0;

  return {
    scoring: {
      categories: core.map((c) => ({ key: c.key, percent: Math.round((c.weight / total) * 1000) / 10 })),
      note: 'Shares of the nine core categories. A display-quality category is added only when a shopper says display quality matters. Use-case and preference answers shift these shares per shopper.',
      rulesVersion: rules.version,
    },
    assumptions: {
      osOverheadGB: rules.os.overheadGB,
      baselineMemoryGB: rules.intensity.baselineRamGB,
      osStorageReserveGB: rules.storage.osReserveGB,
      usableStorageFraction: rules.storage.usableFraction,
      defaultOwnershipYears: rules.future.defaultOwnershipYears,
      yearlyDemandGrowth: rules.future.growthPerYear,
    },
    data: {
      configurations: { total: count(configs), storeConfirmed: cfg('STORE_CONFIRMED'), configureToOrderDerived: cfg('CTO_DERIVED'), adminVerified: cfg('ADMIN_VERIFIED') },
      applications: { total: count(apps), vendorPublishedMemory: app('VENDOR_PUBLISHED'), estimated: app('ESTIMATE') },
      specificationsLastVerified: lastVerified._max.verifiedAt,
      cpuGpuIndexBasis: [...new Set(chips.map((c) => c.perfIndexBasis).filter(Boolean))].some((b) => /proxy/i.test(String(b))) ? 'core-count proxy' : 'benchmark-based',
    },
  };
}

export const methodologyRouter = Router();
methodologyRouter.get('/', (_req: Request, res: Response, next: NextFunction) => {
  methodology().then((d) => res.set('Cache-Control', 'public, max-age=300').json(d)).catch(next);
});
