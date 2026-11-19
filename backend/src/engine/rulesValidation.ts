import { defaultRules, Rules } from './rules';
import { CATEGORY_KEYS, Weights } from './types';

export interface RuleIssue {
  path: string;
  message: string;
}

type Range = { min: number; max: number; int?: boolean };
const R = (min: number, max: number, int = false): Range => ({ min, max, int });

/** Allowed ranges. Exact paths win; otherwise the first matching pattern applies. */
const EXACT: Record<string, Range> = {
  'os.overheadGB': R(0, 64),
  'ram.scoreAtMinimum': R(0, 100),
  'ram.scoreAtTarget': R(0, 100),
  'ram.belowMinimumScoreCeiling': R(0, 100),
  'ram.belowMinimumFinalMultiplier': R(0, 1),
  'ram.shortfallPenaltyPoints': R(0, 100),
  'ram.headroomForFullScore': R(0.01, 5),
  'storage.osReserveGB': R(0, 1000),
  'storage.usableFraction': R(0.1, 1),
  'storage.freeSpaceHeadroomFraction': R(0, 2),
  'storage.belowNeedThreshold': R(0, 2),
  'storage.belowNeedFinalMultiplier': R(0, 1),
  'compute.secondaryDemandFactor': R(0, 1),
  'budget.stretchFraction': R(0, 1),
  'budget.belowMinimumPenalty': R(0, 100),
  'budget.stretchScoreAtMax': R(0, 100),
  'budget.stretchScoreAtLimit': R(0, 100),
  'budget.minScoreGainForStretch': R(0, 100),
  'portability.screenMismatchInch': R(0, 10),
  'portability.screenMismatchPenalty': R(0, 100),
  'display.refreshBonusAt120Hz': R(0, 100),
  'future.defaultOwnershipYears': R(1, 10, true),
  'future.growthPerYear': R(0, 1),
  'future.multitaskOverlapBoost': R(0, 1),
  'future.maxOverlap': R(0, 1),
  'missingDataScore': R(0, 100),
  'labels.minScore': R(0, 100),
  'labels.margin': R(0, 100),
  'labels.maxPerConfiguration': R(1, 5, true),
  'results.topN': R(1, 10, true),
  'results.stretchN': R(0, 5, true),
  'results.equivalentScoreTolerance': R(0, 10),
  'overProvision.maxTotalPoints': R(0, 50),
};
const PATTERNS: [RegExp, Range][] = [
  [/^intensity\.ramFactor\./, R(0, 3)],
  [/^intensity\.overlap\./, R(0, 1)],
  [/^intensity\.(cpu|gpu)Multiplier\./, R(0.1, 3)],
  [/^intensity\.baselineRamGB\./, R(1, 512)],
  [/^intensity\.baseline(Cpu|Gpu)Demand\./, R(1, 10)],
  [/^intensity\.baselineStorageGB\./, R(0, 5000)],
  [/^intensity\.userDataGB\./, R(0, 10000)],
  [/^compatibility\.(ram|cpu|gpu)Weight$/, R(0, 1)],
  [/^compatibility\./, R(0, 100)],
  [/^overProvision\.\w+\.threshold$/, R(1, 50)],
  [/^overProvision\.\w+\.pointsPerRatio$/, R(0, 50)],
  [/^overProvision\.\w+\.maxPoints$/, R(0, 50)],
  [/^future\.componentWeights\./, R(0, 1)],
  [/^future\.flags\.\w+\.(min|preferred)RamGB$/, R(1, 1024)],
  [/^future\.flags\.\w+\.(cpu|gpu)Demand$/, R(1, 10)],
  [/^future\.flags\.\w+\.storageGB$/, R(0, 20000)],
  [/^future\.flags\.\w+\.concurrencyFactor$/, R(0, 1)],
];
const FALLBACK = R(0, 100_000);

const rangeFor = (path: string): Range => EXACT[path] ?? PATTERNS.find(([re]) => re.test(path))?.[1] ?? FALLBACK;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function check(def: unknown, val: unknown, path: string, issues: RuleIssue[]): void {
  if (typeof def === 'number') {
    const r = rangeFor(path);
    if (typeof val !== 'number' || !Number.isFinite(val)) return void issues.push({ path, message: 'Must be a number' });
    if (val < r.min || val > r.max) issues.push({ path, message: `Must be between ${r.min} and ${r.max}` });
    else if (r.int && !Number.isInteger(val)) issues.push({ path, message: 'Must be a whole number' });
    return;
  }
  if (typeof def === 'boolean') {
    if (typeof val !== 'boolean') issues.push({ path, message: 'Must be true or false' });
    return;
  }
  if (typeof def === 'string') {
    if (typeof val !== 'string') issues.push({ path, message: 'Must be text' });
    return;
  }
  if (Array.isArray(def)) {
    if (!Array.isArray(val)) return void issues.push({ path, message: 'Must be a list' });
    if (Array.isArray(def[0])) {
      // A curve: at least two [x, y] points with strictly increasing x and y within 0-100.
      if (val.length < 2 || val.length > 20) return void issues.push({ path, message: 'A curve needs between 2 and 20 points' });
      let prevX = -Infinity;
      val.forEach((pt, i) => {
        if (!Array.isArray(pt) || pt.length !== 2 || !pt.every((n) => typeof n === 'number' && Number.isFinite(n))) return void issues.push({ path: `${path}[${i}]`, message: 'Each point must be [x, y] numbers' });
        const [x, y] = pt as [number, number];
        if (x <= prevX) issues.push({ path: `${path}[${i}]`, message: 'x values must be strictly increasing' });
        if (y < 0 || y > 100) issues.push({ path: `${path}[${i}]`, message: 'y must be between 0 and 100' });
        prevX = x;
      });
    } else {
      if (val.length !== def.length) return void issues.push({ path, message: `Must contain exactly ${def.length} numbers` });
      val.forEach((n, i) => {
        if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 100) issues.push({ path: `${path}[${i}]`, message: 'Must be a number between 0 and 100' });
      });
    }
    return;
  }
  if (isObj(def)) {
    if (!isObj(val)) return void issues.push({ path, message: 'Must be an object' });
    for (const k of Object.keys(val)) {
      if (!(k in def)) issues.push({ path: path ? `${path}.${k}` : k, message: 'Unknown setting' });
      else check(def[k], val[k], path ? `${path}.${k}` : k, issues);
    }
  }
}

/** Checks a (possibly partial) rules object against the shape and limits of the defaults. `version` is server-managed. */
export function validateRulesPatch(patch: unknown): RuleIssue[] {
  const issues: RuleIssue[] = [];
  if (!isObj(patch)) return [{ path: '', message: 'Rules must be an object' }];
  const { version: _ignored, ...rest } = patch;
  void _ignored;
  check(defaultRules, rest, '', issues);
  return issues;
}

/** Relationships between settings that only make sense once everything is merged. */
export function validateMergedRules(r: Rules): RuleIssue[] {
  const issues: RuleIssue[] = [];
  if (!(r.ram.belowMinimumScoreCeiling <= r.ram.scoreAtMinimum)) issues.push({ path: 'ram.belowMinimumScoreCeiling', message: 'Must not exceed ram.scoreAtMinimum' });
  if (!(r.ram.scoreAtMinimum < r.ram.scoreAtTarget)) issues.push({ path: 'ram.scoreAtMinimum', message: 'Must be lower than ram.scoreAtTarget' });
  if (r.budget.stretchScoreAtLimit > r.budget.stretchScoreAtMax) issues.push({ path: 'budget.stretchScoreAtLimit', message: 'Must not exceed budget.stretchScoreAtMax' });
  const fw = r.future.componentWeights;
  if (fw.ram + fw.storage + fw.cpu + fw.gpu <= 0) issues.push({ path: 'future.componentWeights', message: 'At least one component weight must be above zero' });
  const c = r.compatibility;
  if (c.ramWeight + c.cpuWeight + c.gpuWeight <= 0) issues.push({ path: 'compatibility', message: 'At least one of ramWeight, cpuWeight, gpuWeight must be above zero' });
  for (const [name, f] of Object.entries(r.future.flags)) {
    if (f.preferredRamGB < f.minRamGB) issues.push({ path: `future.flags.${name}.preferredRamGB`, message: 'Must not be lower than minRamGB' });
  }
  return issues;
}

export function validateWeights(w: unknown): RuleIssue[] {
  const issues: RuleIssue[] = [];
  if (!isObj(w)) return [{ path: 'weights', message: 'Weights must be an object' }];
  for (const [k, v] of Object.entries(w)) {
    if (!(CATEGORY_KEYS as readonly string[]).includes(k)) issues.push({ path: `weights.${k}`, message: 'Unknown category' });
    else if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) issues.push({ path: `weights.${k}`, message: 'Must be a number between 0 and 100' });
  }
  return issues;
}

/** The nine core categories must carry some weight or every score would divide by zero. */
export function validateWeightTotal(w: Weights): RuleIssue[] {
  const core = CATEGORY_KEYS.filter((k) => k !== 'display').reduce((s, k) => s + w[k], 0);
  return core > 0 ? [] : [{ path: 'weights', message: 'At least one category weight must be above zero' }];
}
