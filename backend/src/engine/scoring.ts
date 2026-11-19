import { clamp, round } from './math';
import {
  RawScore,
  scoreBattery,
  scoreBudget,
  scoreCompatibility,
  scoreCpu,
  scoreDisplay,
  scoreFuture,
  scoreGpu,
  scorePortability,
  scoreRam,
  scoreStorage,
} from './scorers';
import {
  Candidate,
  CATEGORY_KEYS,
  CategoryKey,
  CategoryScore,
  EngineInput,
  Penalty,
  PriceInfo,
  ScoredConfiguration,
  Weights,
  Workload,
} from './types';

/** Picks the offer used for pricing in the user's country. Never invents a price. */
export function selectPrice(c: Candidate, country: string): PriceInfo {
  const inCountry = c.offers.filter((o) => o.country === country);
  if (!inCountry.length) {
    return { known: false, amount: null, currency: null, merchant: null, listPrice: null, offerId: null, stock: null, purchasable: false, note: `No merchant offers recorded for ${country}.` };
  }
  const priced = inCountry.filter((o) => o.price !== null);
  const inStock = priced.filter((o) => o.stock !== 'OUT_OF_STOCK');
  const pool = inStock.length ? inStock : priced;
  if (!pool.length) {
    const purchasable = inCountry.some((o) => o.stock !== 'OUT_OF_STOCK');
    return { known: false, amount: null, currency: null, merchant: null, listPrice: null, offerId: null, stock: null, purchasable, note: 'Merchant offers exist but none has a verified price.' };
  }
  const best = pool.reduce((a, b) => (a.price! <= b.price! ? a : b));
  return {
    known: true,
    amount: best.price,
    currency: best.currency,
    merchant: best.merchantName,
    listPrice: best.listPrice,
    offerId: best.id,
    stock: best.stock,
    purchasable: inStock.length > 0,
    note: inStock.length === 0 ? 'Currently out of stock at every merchant.' : best.stock === 'UNKNOWN' ? 'Stock not confirmed; check the merchant.' : null,
  };
}

/**
 * Effective weight per category = base weight x average use-case multiplier x preference multiplier.
 * Display is an optional category that only activates when the user states a display-quality preference.
 */
export function effectiveWeights(input: EngineInput, base: Weights): Weights {
  const { profile, rules, useCaseWeights } = input;
  const slugs = profile.useCases;
  const w = { ...base };

  const ucMult = (key: CategoryKey) => {
    if (!slugs.length) return 1;
    return slugs.reduce((s, slug) => s + (useCaseWeights[slug]?.[key] ?? 1), 0) / slugs.length;
  };
  const imp = rules.preferences.importanceMultiplier;
  const prefMult = (v?: number) => (v ? (imp[clamp(Math.round(v), 1, imp.length) - 1] ?? 1) : 1);
  const p = profile.preferences;

  for (const key of CATEGORY_KEYS) w[key] = base[key] * ucMult(key);
  w.portability *= prefMult(p.portability);
  w.battery *= prefMult(p.batteryLife);
  w.cpu *= prefMult(p.performance);
  w.gpu *= prefMult(p.performance);
  if (p.displayQuality) {
    const table = rules.display.weightByImportance;
    w.display = Math.max(w.display, table[clamp(Math.round(p.displayQuality), 1, table.length) - 1] ?? 0);
  }
  return w;
}

/** The smallest capacity actually available per resource. You cannot buy less, so it is never "over-provisioned". */
export interface Floors {
  ramGB: number;
  usableStorageGB: number;
  cpuIndex: number;
  gpuIndex: number;
}

export function availabilityFloors(candidates: Candidate[], usableFraction: number): Floors {
  const min = (vals: number[]) => (vals.length ? Math.min(...vals) : 0);
  return {
    ramGB: min(candidates.map((c) => c.ramGB)),
    usableStorageGB: min(candidates.map((c) => c.storageGB * usableFraction)),
    cpuIndex: min(candidates.flatMap((c) => (c.cpuIndex === null ? [] : [c.cpuIndex]))),
    gpuIndex: min(candidates.flatMap((c) => (c.gpuIndex === null ? [] : [c.gpuIndex]))),
  };
}

export function scoreCandidate(c: Candidate, input: EngineInput, workload: Workload, weights: Weights, floors: Floors): ScoredConfiguration {
  const { rules, profile } = input;
  const price = selectPrice(c, profile.budget.country);

  const raws: RawScore[] = [
    scoreCpu(c, workload, rules),
    scoreGpu(c, workload, rules),
    scoreRam(c, workload, rules),
    scoreStorage(c, workload, rules),
    scoreCompatibility(c, input.apps, rules),
    scoreBudget(price, input),
    scorePortability(c, input),
    scoreBattery(c, rules),
    scoreDisplay(c, input),
    scoreFuture(c, workload, rules),
  ];

  const applicable = (r: RawScore) => r.applicable && weights[r.key] > 0;
  const totalWeight = raws.filter(applicable).reduce((s, r) => s + weights[r.key], 0);

  const categories: CategoryScore[] = raws.map((r) => {
    const isApplicable = applicable(r);
    const weight = isApplicable ? weights[r.key] : 0;
    return {
      key: r.key,
      score: r.score,
      applicable: isApplicable,
      weight: round(weight, 2),
      contribution: isApplicable && totalWeight > 0 ? round((r.score * weight) / totalWeight, 2) : 0,
      estimated: r.estimated,
      note: '',
      detail: r.detail,
    };
  });

  const baseScore = categories.reduce((s, x) => s + x.contribution, 0);

  // ---- hard constraints and penalties
  let final = baseScore;
  const penalties: Penalty[] = [];

  if (c.ramGB < workload.ram.minimumGB) {
    final *= rules.ram.belowMinimumFinalMultiplier;
    penalties.push({
      code: 'RAM_BELOW_MINIMUM',
      description: `${c.ramGB}GB is below the ~${workload.ram.minimumGB}GB needed just to run your workload.`,
      effect: `Final score multiplied by ${rules.ram.belowMinimumFinalMultiplier}`,
    });
  } else if (c.ramGB < workload.ram.targetGB) {
    const shortfall = (workload.ram.targetGB - c.ramGB) / Math.max(0.01, workload.ram.targetGB - workload.ram.minimumGB);
    const pts = rules.ram.shortfallPenaltyPoints * clamp(shortfall, 0, 1);
    final -= pts;
    penalties.push({
      code: 'RAM_BELOW_TARGET',
      description: `${c.ramGB}GB is under the ~${workload.ram.targetGB}GB target for comfortable use.`,
      effect: `${round(pts, 1)} points deducted`,
    });
  }

  const storage = categories.find((x) => x.key === 'storage')!.detail as { ratio: number };
  if (storage.ratio < rules.storage.belowNeedThreshold) {
    final *= rules.storage.belowNeedFinalMultiplier;
    penalties.push({
      code: 'STORAGE_TIGHT',
      description: `Usable storage is only ${Math.round(storage.ratio * 100)}% of the ~${workload.storage.needGB}GB your apps and files need.`,
      effect: `Final score multiplied by ${rules.storage.belowNeedFinalMultiplier}`,
    });
  }

  // Capacity far beyond projected need earns a small deduction (see rules.overProvision).
  const op = rules.overProvision;
  if (op.maxTotalPoints > 0) {
    const ratios: { name: string; ratio: number; rule: { threshold: number; pointsPerRatio: number; maxPoints: number } }[] = [
      { name: 'memory', ratio: c.ramGB / Math.max(workload.ram.futureGB, workload.ram.targetGB, floors.ramGB), rule: op.ram },
      { name: 'storage', ratio: (c.storageGB * rules.storage.usableFraction) / Math.max(workload.storage.futureNeedGB, floors.usableStorageGB), rule: op.storage },
    ];
    if (c.cpuIndex !== null) ratios.push({ name: 'CPU', ratio: c.cpuIndex / Math.max(workload.cpu.futureRequiredIndex, floors.cpuIndex), rule: op.cpu });
    if (c.gpuIndex !== null) ratios.push({ name: 'GPU', ratio: c.gpuIndex / Math.max(workload.gpu.futureRequiredIndex, floors.gpuIndex), rule: op.gpu });
    const over = ratios
      .map((r) => ({ ...r, pts: Math.min(r.rule.maxPoints, Math.max(0, (r.ratio - r.rule.threshold) * r.rule.pointsPerRatio)) }))
      .filter((r) => r.pts > 0);
    if (over.length) {
      const total = Math.min(op.maxTotalPoints, over.reduce((sum, r) => sum + r.pts, 0));
      final -= total;
      penalties.push({
        code: 'OVERPROVISIONED',
        description: `Well beyond what your workload needs (${over.map((r) => `${r.name} about ${round(r.ratio, 1)}x`).join(', ')}), so you may pay for capacity you will not use.`,
        effect: `${round(total, 1)} points deducted`,
      });
    }
  }

  let budgetStatus: ScoredConfiguration['budgetStatus'] = 'UNKNOWN';
  let extraCost: number | null = null;
  if (price.known && price.amount !== null) {
    const max = profile.budget.max;
    budgetStatus = price.amount <= max ? 'WITHIN' : price.amount <= max * (1 + rules.budget.stretchFraction) ? 'STRETCH' : 'OVER';
    extraCost = price.amount > max ? price.amount - max : null;
  }

  return {
    candidate: c,
    finalScore: round(clamp(final), 1),
    baseScore: round(baseScore, 1),
    categories,
    penalties,
    price,
    budgetStatus,
    extraCost,
    capability: (c.cpuIndex ?? 0) + (c.gpuIndex ?? 0),
    reasons: [],
    limitations: [],
    futureAssessment: '',
    explanation: '',
    labels: [],
    variants: [],
  };
}
