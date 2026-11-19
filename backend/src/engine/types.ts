/**
 * Types for the recommendation engine. The engine is pure: it takes plain data in and returns plain
 * data out. It knows nothing about Express, Prisma or HTTP.
 */

export type Intensity = 'BASIC' | 'MODERATE' | 'HEAVY' | 'PROFESSIONAL';
export type Country = 'IN' | 'US';
export type StockStatus = 'IN_STOCK' | 'OUT_OF_STOCK' | 'LIMITED' | 'UNKNOWN';

export const CATEGORY_KEYS = ['cpu', 'gpu', 'ram', 'storage', 'compatibility', 'budget', 'portability', 'battery', 'future', 'display'] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];
export type Weights = Record<CategoryKey, number>;

// ------------------------------------------------------------------ inputs

export interface EngineApp {
  id: string;
  name: string;
  category: string;
  macSupported: boolean;
  minRamGB: number;
  preferredRamGB: number;
  cpuDemand: number; // 1-10
  gpuDemand: number; // 1-10
  storageGB: number;
  concurrencyFactor: number; // 0-1
  needsAppleSilicon: boolean;
}

export interface EngineProfile {
  useCases: string[]; // slugs
  intensity: Intensity;
  future: {
    learnMoreLanguages: boolean;
    startVideoEditing: boolean;
    runLocalAiModels: boolean;
    useVirtualMachinesOrDocker: boolean;
    multitaskDemandingApps: boolean;
  };
  budget: { country: Country; currency: 'INR' | 'USD'; min: number; max: number };
  preferences: {
    screenSizeInch?: number;
    portability?: number;
    batteryLife?: number;
    displayQuality?: number;
    performance?: number;
    storageGB?: number;
    ramGB?: number;
    ownershipYears?: number;
  };
}

export interface EngineOffer {
  id: string;
  merchantName: string;
  country: Country;
  currency: string;
  price: number | null;
  listPrice: number | null;
  stock: StockStatus;
}

/** One concrete hardware configuration. Capability indices are already scaled to this configuration's core counts. */
export interface Candidate {
  id: string;
  label: string;
  modelName: string;
  category: string;
  generation: string;
  screenSizeInch: number;
  chipName: string;
  cpuCores: number;
  gpuCores: number;
  ramGB: number;
  storageGB: number;
  cpuIndex: number | null; // 0-100
  gpuIndex: number | null; // 0-100
  family: string; // chip family, e.g. "M5"
  weightKg: number | null;
  batteryVideoHours: number | null;
  brightnessNits: number | null;
  refreshRateHz: number | null;
  offers: EngineOffer[];
}

export interface EngineInput {
  profile: EngineProfile;
  /** Applications the user uses now. */
  apps: EngineApp[];
  /** Applications the user expects to adopt. */
  futureApps: EngineApp[];
  /** Per-use-case multipliers by category key. */
  useCaseWeights: Record<string, Partial<Record<CategoryKey, number>>>;
  candidates: Candidate[];
  weights: Weights;
  rules: import('./rules').Rules;
}

// ----------------------------------------------------------------- workload

export interface Workload {
  basis: 'applications' | 'baseline';
  ram: {
    osOverheadGB: number;
    minimumGB: number;
    targetGB: number;
    futureGB: number;
    drivers: { name: string; ramGB: number }[];
  };
  storage: { needGB: number; futureNeedGB: number };
  cpu: { demand: number; requiredIndex: number; futureRequiredIndex: number };
  gpu: { demand: number; requiredIndex: number; futureRequiredIndex: number };
  unsupportedApps: string[];
  notes: string[];
  ownershipYears: number;
}

// ------------------------------------------------------------------- output

export interface CategoryScore {
  key: CategoryKey;
  /** 0-100. */
  score: number;
  /** True when this category does not apply to the user (excluded from the weighted average). */
  applicable: boolean;
  /** Effective weight after use-case and preference multipliers (0 when not applicable). */
  weight: number;
  /** Share of the final score: score * weight / total applicable weight. */
  contribution: number;
  /** True when input data was missing and a conservative default was used. */
  estimated: boolean;
  /** One-line, human-readable account of how this score came about. */
  note: string;
  detail: Record<string, unknown>;
}

export type Label = 'BEST_OVERALL' | 'BEST_VALUE' | 'BEST_PERFORMANCE' | 'BEST_FUTURE' | 'STRETCH';

export interface PriceInfo {
  known: boolean;
  amount: number | null;
  currency: string | null;
  merchant: string | null;
  listPrice: number | null;
  offerId: string | null;
  stock: StockStatus | null;
  purchasable: boolean;
  note: string | null;
}

export interface Penalty {
  code: string;
  description: string;
  effect: string;
}

export interface ScoredConfiguration {
  candidate: Candidate;
  finalScore: number;
  /** Weighted average before penalties. */
  baseScore: number;
  categories: CategoryScore[];
  penalties: Penalty[];
  price: PriceInfo;
  budgetStatus: 'WITHIN' | 'STRETCH' | 'OVER' | 'UNKNOWN';
  /** Cost above the user's maximum budget; null if within budget or unknown. */
  extraCost: number | null;
  capability: number; // cpu+gpu capability, used for "best performance"
  reasons: string[];
  limitations: string[];
  futureAssessment: string;
  explanation: string;
  labels: Label[];
  /** Other memory/storage sizes of the same chip variant that score the same or add nothing, each scored independently. */
  variants: ConfigurationVariant[];
}

export interface ConfigurationVariant {
  configurationId: string;
  ramGB: number;
  storageGB: number;
  finalScore: number;
  price: number | null;
  currency: string | null;
  budgetStatus: 'WITHIN' | 'STRETCH' | 'OVER' | 'UNKNOWN';
}

export interface RankingComparison {
  higherId: string;
  lowerId: string;
  summary: string;
  deltas: { category: CategoryKey; delta: number }[];
}

export interface EngineOutput {
  engineVersion: string;
  workload: Workload;
  warnings: { code: string; message: string }[];
  /** Top matches in rank order. */
  matches: ScoredConfiguration[];
  /** Slightly over budget but substantially better. */
  stretch: ScoredConfiguration[];
  comparisons: RankingComparison[];
  stats: { evaluated: number; excluded: Record<string, number> };
}
