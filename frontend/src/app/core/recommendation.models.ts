import { Configuration } from './catalog.models';
import { RecommendationProfile } from './profile.models';

/** Shapes returned by the recommendation API. All scoring happens on the server. */

export type CategoryKey = 'cpu' | 'gpu' | 'ram' | 'storage' | 'compatibility' | 'budget' | 'portability' | 'battery' | 'future' | 'display';
export type LabelKey = 'BEST_OVERALL' | 'BEST_VALUE' | 'BEST_PERFORMANCE' | 'BEST_FUTURE' | 'STRETCH';
export type BudgetStatus = 'WITHIN' | 'STRETCH' | 'OVER' | 'UNKNOWN';

export interface CategoryScoreDto {
  key: CategoryKey;
  score: number;
  weight: number;
  contribution: number;
  applicable: boolean;
  estimated: boolean;
  note: string;
}

export interface PriceInfo {
  known: boolean;
  amount: number | null;
  currency: string | null;
  merchant: string | null;
  listPrice: number | null;
  offerId: string | null;
  stock: 'IN_STOCK' | 'OUT_OF_STOCK' | 'LIMITED' | 'UNKNOWN' | null;
  purchasable: boolean;
  note: string | null;
}

export interface Penalty {
  code: string;
  description: string;
  effect: string;
}

export interface ConfigurationVariant {
  configurationId: string;
  ramGB: number;
  storageGB: number;
  finalScore: number;
  price: number | null;
  currency: string | null;
  budgetStatus: BudgetStatus;
}

export interface ResultDto {
  resultId?: string;
  rank: number;
  configurationId: string;
  label: string;
  configuration: Configuration | null;
  finalScore: number;
  labels: LabelKey[];
  categories: CategoryScoreDto[];
  explanation: string;
  reasons: string[];
  limitations: string[];
  futureAssessment: string;
  penalties: Penalty[];
  price: PriceInfo;
  budgetStatus: BudgetStatus;
  extraCost: number | null;
  variants: ConfigurationVariant[];
}

export interface Workload {
  basis: 'applications' | 'baseline';
  ram: { osOverheadGB: number; minimumGB: number; targetGB: number; futureGB: number; drivers: { name: string; ramGB: number }[] };
  storage: { needGB: number; futureNeedGB: number };
  cpu: { demand: number; requiredIndex: number };
  gpu: { demand: number; requiredIndex: number };
  unsupportedApps: string[];
  notes: string[];
  ownershipYears: number;
}

export interface RankingComparison {
  higherId: string;
  lowerId: string;
  summary: string;
  deltas: { category: CategoryKey; delta: number }[];
}

export interface RecommendationDto {
  id: string;
  createdAt: string;
  engineVersion: string | null;
  profile: RecommendationProfile;
  workload: Workload | null;
  warnings: { code: string; message: string }[];
  matches: ResultDto[];
  stretch: ResultDto[];
  comparisons: RankingComparison[];
  notice: string;
}

export interface CompareDto {
  workload: Workload;
  results: ResultDto[];
  comparisons: RankingComparison[];
  highlights: {
    specs: Record<string, string[]>;
    finalScore: string[];
    categories: Record<string, string[]>;
  };
  notice: string;
}

export interface SpecCompareDto {
  data: Configuration[];
  highlights: Record<string, string[]>;
}

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  cpu: 'CPU performance',
  gpu: 'GPU performance',
  ram: 'Memory (RAM)',
  storage: 'Storage',
  compatibility: 'Application compatibility',
  budget: 'Budget fit',
  portability: 'Portability',
  battery: 'Battery life',
  future: 'Future-proofing',
  display: 'Display quality',
};

export const LABEL_TEXT: Record<LabelKey, string> = {
  BEST_OVERALL: 'Best Overall Match',
  BEST_VALUE: 'Best Value for Money',
  BEST_PERFORMANCE: 'Best Performance',
  BEST_FUTURE: 'Best for Future Requirements',
  STRETCH: 'Worth Stretching Your Budget?',
};
