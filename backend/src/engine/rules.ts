import { Intensity, Weights } from './types';

/**
 * Default scoring configuration. These values seed the database (ScoringRuleSet) and are also the
 * fallback for any rule missing from a stored rule set, so new rules can be added without breaking
 * existing rows. At runtime the engine reads the stored rule set; nothing here is baked into scoring.
 *
 * Every number below is a tunable estimate, not a measurement. Curves are [x, y] points with linear
 * interpolation between them and clamping outside the range.
 */

export type Curve = [number, number][];
const byIntensity = (basic: number, moderate: number, heavy: number, professional: number): Record<Intensity, number> => ({
  BASIC: basic,
  MODERATE: moderate,
  HEAVY: heavy,
  PROFESSIONAL: professional,
});

export const defaultWeights: Weights = {
  cpu: 15,
  gpu: 10,
  ram: 20,
  storage: 10,
  compatibility: 15,
  budget: 10,
  portability: 5,
  battery: 5,
  future: 10,
  // Extra category, off unless the user states a display-quality preference (see rules.display).
  display: 0,
};

export interface SyntheticDemand {
  category: string; // skipped if the user already selected an app in this category
  minRamGB: number;
  preferredRamGB: number;
  cpuDemand: number;
  gpuDemand: number;
  storageGB: number;
  concurrencyFactor: number;
}

export const defaultRules = {
  version: 'rules-3',

  os: { overheadGB: 3.5 },

  intensity: {
    /** Where between an app's minimum and preferred RAM the user's workload sits (1 = preferred, >1 = beyond it). */
    ramFactor: byIntensity(0, 0.5, 1, 1.15),
    /** How much of the other apps' RAM is realistically in use at the same time. */
    overlap: byIntensity(0.4, 0.55, 0.7, 0.8),
    cpuMultiplier: byIntensity(0.65, 1, 1.1, 1.2),
    gpuMultiplier: byIntensity(0.65, 1, 1.1, 1.2),
    /** Used when the user selected no applications. */
    baselineRamGB: byIntensity(6, 10, 16, 24),
    baselineCpuDemand: byIntensity(2, 4, 6, 8),
    baselineGpuDemand: byIntensity(1, 2, 4, 6),
    baselineStorageGB: byIntensity(20, 40, 80, 150),
    /** Personal files, projects and media on top of the OS and apps. */
    userDataGB: byIntensity(50, 100, 200, 400),
  },

  ram: {
    /** Score at the minimum (to run at all) and at the target (comfortable). Curve is applied across min -> target. */
    scoreAtMinimum: 45,
    scoreAtTarget: 85,
    /** Headroom beyond the target that earns the last points: full marks at target * (1 + this). */
    headroomForFullScore: 0.5,
    belowMinimumScoreCeiling: 30,
    /** Final-score multiplier when RAM is below what the workload needs just to run. */
    belowMinimumFinalMultiplier: 0.6,
    /** Extra points deducted at 100% shortfall between minimum and target. */
    shortfallPenaltyPoints: 12,
  },

  storage: {
    osReserveGB: 60,
    usableFraction: 0.85,
    freeSpaceHeadroomFraction: 0.2,
    /** usable / need  ->  score */
    curve: [[0.5, 5], [1, 60], [1.5, 90], [2, 100]] as Curve,
    belowNeedThreshold: 0.8,
    belowNeedFinalMultiplier: 0.85,
  },

  compute: {
    /** Combined app demand (1-10) -> the capability index needed (0-100). */
    demandToIndex: [[1, 10], [4, 30], [7, 55], [10, 80]] as Curve,
    /** capability / needed  ->  score */
    ratioCurve: [[0.4, 10], [0.7, 45], [1, 80], [1.3, 95], [1.6, 100]] as Curve,
    /** Contribution of non-dominant apps to combined demand. */
    secondaryDemandFactor: 0.1,
  },

  compatibility: {
    ramWeight: 0.6,
    cpuWeight: 0.2,
    gpuWeight: 0.2,
    scoreBelowMinimumRam: 20,
    scoreAtMinimumRam: 60,
    unsupportedAppScore: 0,
  },

  budget: {
    /** price / max budget  ->  score, for prices within budget. */
    withinCurve: [[0.5, 100], [0.9, 100], [1, 85]] as Curve,
    belowMinimumPenalty: 10,
    /** Fraction above the maximum that is still considered for "worth stretching". */
    stretchFraction: 0.2,
    stretchScoreAtMax: 60,
    stretchScoreAtLimit: 30,
    /** A stretch option must beat the best in-budget option's final score by at least this many points. */
    minScoreGainForStretch: 6,
  },

  portability: {
    /** weight in kg -> score */
    weightCurve: [[1.2, 100], [1.5, 90], [1.7, 75], [2.2, 40], [2.5, 20]] as Curve,
    screenMismatchInch: 1,
    screenMismatchPenalty: 20,
  },

  battery: {
    /** Apple-claimed video streaming hours -> score */
    hoursCurve: [[8, 20], [12, 50], [16, 70], [18, 80], [22, 92], [24, 100]] as Curve,
  },

  display: {
    brightnessCurve: [[400, 40], [500, 55], [1000, 90], [1600, 100]] as Curve,
    refreshBonusAt120Hz: 10,
    /** Display-quality importance 1..5 -> weight on the 0-100 weight scale. */
    weightByImportance: [3, 5, 7, 10, 14],
  },

  /**
   * Gentle penalty for capacity far beyond what the workload (including projected growth) needs.
   * It keeps big machines from winning by default, which matters most while prices are unknown.
   * Set maxTotalPoints to 0 to disable. ratio = capacity / projected need.
   */
  overProvision: {
    maxTotalPoints: 10,
    ram: { threshold: 2, pointsPerRatio: 4, maxPoints: 6 },
    storage: { threshold: 3, pointsPerRatio: 1.5, maxPoints: 3 },
    cpu: { threshold: 2.2, pointsPerRatio: 3, maxPoints: 4 },
    gpu: { threshold: 2.5, pointsPerRatio: 3, maxPoints: 4 },
  },

  future: {
    defaultOwnershipYears: 4,
    /** Yearly growth in software demand over the ownership period. */
    growthPerYear: 0.08,
    componentWeights: { ram: 0.45, storage: 0.25, cpu: 0.15, gpu: 0.15 },
    /** Demand added by "I may..." answers, when the user has no app of that category already. */
    flags: {
      learnMoreLanguages: { category: 'Development', minRamGB: 4, preferredRamGB: 8, cpuDemand: 4, gpuDemand: 1, storageGB: 10, concurrencyFactor: 0.5 },
      startVideoEditing: { category: 'Video', minRamGB: 8, preferredRamGB: 16, cpuDemand: 7, gpuDemand: 7, storageGB: 150, concurrencyFactor: 0.85 },
      runLocalAiModels: { category: 'AI / ML', minRamGB: 8, preferredRamGB: 24, cpuDemand: 6, gpuDemand: 7, storageGB: 40, concurrencyFactor: 0.95 },
      useVirtualMachinesOrDocker: { category: 'Virtualization & Containers', minRamGB: 4, preferredRamGB: 16, cpuDemand: 6, gpuDemand: 1, storageGB: 40, concurrencyFactor: 0.8 },
    } as Record<string, SyntheticDemand>,
    /** "Multitask demanding apps" raises the overlap factor by this much (capped at maxOverlap). */
    multitaskOverlapBoost: 0.15,
    maxOverlap: 0.95,
  },

  preferences: {
    /** Importance 1..5 -> multiplier on the related category weight. */
    importanceMultiplier: [0.4, 0.7, 1, 1.4, 1.8],
  },

  /** Used when data is missing so that missing data is never rewarded. */
  missingDataScore: 40,

  labels: {
    /** A configuration needs at least this final score to earn any label. */
    minScore: 60,
    /** Winner must lead the runner-up on the label's criterion by this much. */
    margin: 2,
    maxPerConfiguration: 2,
  },

  results: {
    topN: 5,
    stretchN: 2,
    /** Drop configurations whose only offers are out of stock. */
    excludeOutOfStock: true,
    /**
     * Show one result per hardware class (same model, chip, core counts and memory). The other storage
     * sizes are still scored independently and listed as variants on that result.
     */
    groupStorageVariants: true,
    /**
     * With grouping on, a larger-memory variant of the same chip whose score is within this many points of
     * an already listed result is shown as that result's variant instead of as a separate recommendation.
     */
    equivalentScoreTolerance: 0.5,
  },
};

export type Rules = typeof defaultRules;

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Deep-merges stored rules over the defaults. Arrays and primitives from `stored` replace defaults wholesale. */
export function mergeRules(defaults: Rules, stored: unknown): Rules {
  const merge = (base: unknown, over: unknown): unknown => {
    if (over === undefined || over === null) return base;
    if (isObj(base) && isObj(over)) {
      const out: Json = { ...base };
      for (const k of Object.keys(over)) out[k] = merge(base[k], over[k]);
      return out;
    }
    return over;
  };
  return merge(defaults, stored) as Rules;
}

export function mergeWeights(stored: unknown): Weights {
  return { ...defaultWeights, ...(isObj(stored) ? (stored as Partial<Weights>) : {}) };
}
