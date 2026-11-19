import { clamp, interp, round } from './math';
import { Rules } from './rules';
import { Candidate, CategoryKey, EngineApp, EngineInput, PriceInfo, Workload } from './types';

/** A category score before weights are applied. Every score is normalised to 0-100. */
export interface RawScore {
  key: CategoryKey;
  score: number;
  applicable: boolean;
  /** True when data was missing and the conservative default was used. */
  estimated: boolean;
  detail: Record<string, unknown>;
}

const raw = (key: CategoryKey, score: number, detail: Record<string, unknown>, extra: Partial<RawScore> = {}): RawScore => ({
  key,
  score: round(clamp(score), 1),
  applicable: true,
  estimated: false,
  detail,
  ...extra,
});

const missing = (key: CategoryKey, rules: Rules, what: string): RawScore =>
  raw(key, rules.missingDataScore, { missing: what, note: `${what} unavailable, so a conservative default score was used.` }, { estimated: true });

/** Shared RAM curve: below `min` is poor, `min`->`target` rises to a comfortable level, headroom earns the rest. */
function ramCurve(ramGB: number, minGB: number, targetGB: number, rules: Rules) {
  const { scoreAtMinimum, scoreAtTarget, headroomForFullScore, belowMinimumScoreCeiling } = rules.ram;
  if (ramGB < minGB) return minGB > 0 ? belowMinimumScoreCeiling * (ramGB / minGB) : 0;
  if (ramGB < targetGB) return scoreAtMinimum + ((scoreAtTarget - scoreAtMinimum) * (ramGB - minGB)) / (targetGB - minGB);
  return scoreAtTarget + (100 - scoreAtTarget) * clamp((ramGB - targetGB) / (targetGB * headroomForFullScore), 0, 1);
}

export function scoreRam(c: Candidate, w: Workload, rules: Rules): RawScore {
  const score = ramCurve(c.ramGB, w.ram.minimumGB, w.ram.targetGB, rules);
  return raw('ram', score, {
    ramGB: c.ramGB,
    minimumGB: w.ram.minimumGB,
    targetGB: w.ram.targetGB,
    headroomGB: round(c.ramGB - w.ram.targetGB, 1),
    band: c.ramGB < w.ram.minimumGB ? 'BELOW_MINIMUM' : c.ramGB < w.ram.targetGB ? 'BELOW_TARGET' : 'MEETS_TARGET',
  });
}

export function scoreStorage(c: Candidate, w: Workload, rules: Rules): RawScore {
  const usable = c.storageGB * rules.storage.usableFraction;
  const ratio = usable / w.storage.needGB;
  return raw('storage', interp(rules.storage.curve, ratio), { storageGB: c.storageGB, usableGB: Math.round(usable), needGB: w.storage.needGB, ratio: round(ratio, 2) });
}

function computeScore(key: 'cpu' | 'gpu', index: number | null, required: number, rules: Rules): RawScore {
  if (index === null) return missing(key, rules, `${key.toUpperCase()} capability data`);
  const ratio = index / required;
  return raw(key, interp(rules.compute.ratioCurve, ratio), { capabilityIndex: round(index, 1), requiredIndex: required, ratio: round(ratio, 2) });
}
export const scoreCpu = (c: Candidate, w: Workload, rules: Rules) => computeScore('cpu', c.cpuIndex, w.cpu.requiredIndex, rules);
export const scoreGpu = (c: Candidate, w: Workload, rules: Rules) => computeScore('gpu', c.gpuIndex, w.gpu.requiredIndex, rules);

/** How well this configuration runs each selected application on its own (support, memory, CPU, GPU). */
export function scoreCompatibility(c: Candidate, apps: EngineApp[], rules: Rules): RawScore {
  if (!apps.length) {
    return { ...raw('compatibility', 0, { note: 'No applications selected.' }), applicable: false };
  }
  const k = rules.compatibility;
  let estimated = false;
  const perApp = apps.map((a) => {
    if (!a.macSupported) return { name: a.name, score: k.unsupportedAppScore, issue: 'Not available on macOS' };
    const ramComp =
      c.ramGB < a.minRamGB
        ? k.scoreBelowMinimumRam
        : c.ramGB < a.preferredRamGB
          ? k.scoreAtMinimumRam + ((100 - k.scoreAtMinimumRam) * (c.ramGB - a.minRamGB)) / Math.max(1, a.preferredRamGB - a.minRamGB)
          : 100;
    const comp = (idx: number | null, demand: number) => {
      if (idx === null) {
        estimated = true;
        return rules.missingDataScore;
      }
      return interp(rules.compute.ratioCurve, idx / interp(rules.compute.demandToIndex, demand));
    };
    const cpuComp = comp(c.cpuIndex, a.cpuDemand);
    const gpuComp = comp(c.gpuIndex, a.gpuDemand);
    const score = k.ramWeight * ramComp + k.cpuWeight * cpuComp + k.gpuWeight * gpuComp;
    const issue = c.ramGB < a.minRamGB ? `Below its ${a.minRamGB}GB minimum memory` : c.ramGB < a.preferredRamGB ? `Under its ${a.preferredRamGB}GB preferred memory` : undefined;
    return { name: a.name, score: round(score, 1), issue };
  });
  const mean = perApp.reduce((s, a) => s + a.score, 0) / perApp.length;
  return raw('compatibility', mean, { perApp, unsupported: apps.filter((a) => !a.macSupported).map((a) => a.name) }, { estimated });
}

export function scoreBudget(price: PriceInfo, input: EngineInput): RawScore {
  const { budget } = input.profile;
  const k = input.rules.budget;
  if (!price.known || price.amount === null) {
    return missing('budget', input.rules, 'Verified price');
  }
  const p = price.amount;
  const ratio = p / budget.max;
  if (p <= budget.max) {
    let s = interp(k.withinCurve, ratio);
    const belowMin = p < budget.min;
    if (belowMin) s -= k.belowMinimumPenalty;
    return raw('budget', s, { price: p, max: budget.max, min: budget.min, status: 'WITHIN', belowMinimum: belowMin });
  }
  const limit = 1 + k.stretchFraction;
  if (ratio <= limit) {
    const s = interp([[1, k.stretchScoreAtMax], [limit, k.stretchScoreAtLimit]], ratio);
    return raw('budget', s, { price: p, max: budget.max, status: 'STRETCH', extraCost: p - budget.max });
  }
  return raw('budget', 0, { price: p, max: budget.max, status: 'OVER', extraCost: p - budget.max });
}

export function scorePortability(c: Candidate, input: EngineInput): RawScore {
  const rules = input.rules;
  if (c.weightKg === null) return missing('portability', rules, 'Weight data');
  let s = interp(rules.portability.weightCurve, c.weightKg);
  const wanted = input.profile.preferences.screenSizeInch;
  let mismatch = false;
  if (wanted && Math.abs(c.screenSizeInch - wanted) > rules.portability.screenMismatchInch) {
    s -= rules.portability.screenMismatchPenalty;
    mismatch = true;
  }
  return raw('portability', s, { weightKg: c.weightKg, screenSizeInch: c.screenSizeInch, preferredScreenInch: wanted ?? null, screenMismatch: mismatch });
}

export function scoreBattery(c: Candidate, rules: Rules): RawScore {
  if (c.batteryVideoHours === null) return missing('battery', rules, 'Battery data');
  return raw('battery', interp(rules.battery.hoursCurve, c.batteryVideoHours), { videoHours: c.batteryVideoHours, basis: 'Apple-claimed video streaming hours; real-world results vary' });
}

export function scoreDisplay(c: Candidate, input: EngineInput): RawScore {
  const k = input.rules.display;
  if (c.brightnessNits === null) return missing('display', input.rules, 'Display data');
  let s = interp(k.brightnessCurve, c.brightnessNits);
  if ((c.refreshRateHz ?? 0) >= 120) s += k.refreshBonusAt120Hz;
  return raw('display', s, { brightnessNits: c.brightnessNits, refreshRateHz: c.refreshRateHz });
}

/**
 * Will this configuration still fit the user's needs over the ownership period?
 * Based only on headroom against projected demand (memory, storage, CPU, GPU). It deliberately gives
 * no credit for being a newer model.
 */
export function scoreFuture(c: Candidate, w: Workload, rules: Rules): RawScore {
  const f = rules.future.componentWeights;
  let estimated = false;

  const ram = ramCurve(c.ramGB, w.ram.targetGB, Math.max(w.ram.futureGB, w.ram.targetGB + 0.01), rules);
  const storageRatio = (c.storageGB * rules.storage.usableFraction) / w.storage.futureNeedGB;
  const storage = interp(rules.storage.curve, storageRatio);
  const compute = (idx: number | null, req: number) => {
    if (idx === null) {
      estimated = true;
      return rules.missingDataScore;
    }
    return interp(rules.compute.ratioCurve, idx / req);
  };
  const cpu = compute(c.cpuIndex, w.cpu.futureRequiredIndex);
  const gpu = compute(c.gpuIndex, w.gpu.futureRequiredIndex);

  const total = f.ram + f.storage + f.cpu + f.gpu;
  const score = (f.ram * ram + f.storage * storage + f.cpu * cpu + f.gpu * gpu) / total;
  return raw(
    'future',
    score,
    {
      ownershipYears: w.ownershipYears,
      components: { ram: round(ram, 1), storage: round(storage, 1), cpu: round(cpu, 1), gpu: round(gpu, 1) },
      futureRamGB: w.ram.futureGB,
      ramHeadroomGB: round(c.ramGB - w.ram.futureGB, 1),
      storageHeadroomGB: Math.round(c.storageGB * rules.storage.usableFraction - w.storage.futureNeedGB),
    },
    { estimated },
  );
}
