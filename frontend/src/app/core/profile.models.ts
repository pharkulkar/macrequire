/**
 * Mirrors backend/src/modules/recommendation/profile.schema.ts.
 * The frontend only collects answers; all scoring happens on the server.
 */
export type Intensity = 'BASIC' | 'MODERATE' | 'HEAVY' | 'PROFESSIONAL';
export type Country = 'IN' | 'US';
export type Currency = 'INR' | 'USD';

export interface FutureNeeds {
  learnMoreLanguages: boolean;
  startVideoEditing: boolean;
  runLocalAiModels: boolean;
  useVirtualMachinesOrDocker: boolean;
  multitaskDemandingApps: boolean;
  futureApplicationIds: string[];
}

export interface Budget {
  country: Country;
  currency: Currency;
  min: number;
  max: number;
}

export interface Preferences {
  screenSizeInch?: number;
  portability?: number;
  batteryLife?: number;
  displayQuality?: number;
  performance?: number;
  storageGB?: number;
  ramGB?: number;
  ownershipYears?: number;
}

export interface RecommendationProfile {
  useCases: string[];
  applicationIds: string[];
  intensity: Intensity;
  future: FutureNeeds;
  budget: Budget;
  preferences: Preferences;
}

export interface IntensityOption {
  value: Intensity;
  label: string;
  description: string;
}

export const INTENSITY_OPTIONS: IntensityOption[] = [
  { value: 'BASIC', label: 'Basic', description: 'Occasional usage.' },
  { value: 'MODERATE', label: 'Moderate', description: 'Regular professional usage.' },
  { value: 'HEAVY', label: 'Heavy', description: 'Daily intensive usage.' },
  { value: 'PROFESSIONAL', label: 'Professional', description: 'Multiple demanding applications at the same time.' },
];

export const FUTURE_QUESTIONS: { key: keyof Omit<FutureNeeds, 'futureApplicationIds'>; label: string; hint: string }[] = [
  { key: 'learnMoreLanguages', label: 'I will learn more programming languages or frameworks', hint: 'More toolchains and larger projects over time.' },
  { key: 'startVideoEditing', label: 'I may start video editing', hint: 'Needs GPU, memory and a lot of storage.' },
  { key: 'runLocalAiModels', label: 'I may run local AI models', hint: 'Model size is limited by unified memory.' },
  { key: 'useVirtualMachinesOrDocker', label: 'I will use virtual machines or Docker', hint: 'These reserve memory the rest of your apps cannot use.' },
  { key: 'multitaskDemandingApps', label: 'I will multitask with several demanding apps', hint: 'Memory headroom matters most here.' },
];

/** Budget input hints. These are UI suggestions only, not price data. */
export const BUDGET_CONFIG: Record<Country, { currency: Currency; label: string; step: number; quickPicks: number[] }> = {
  IN: { currency: 'INR', label: 'India (INR)', step: 5000, quickPicks: [80000, 120000, 160000, 250000, 400000] },
  US: { currency: 'USD', label: 'United States (USD)', step: 50, quickPicks: [1000, 1500, 2000, 3000, 5000] },
};

/** Maps the homepage tile names to use-case slugs. */
export const HOME_TILE_TO_USE_CASES: Record<string, string[]> = {
  'Software Development': ['software-development'],
  'Video Editing': ['video-editing'],
  'Graphic Design': ['graphic-design'],
  'AI/ML Development': ['ai-ml-development'],
  'Business & Productivity': ['business-office'],
  Students: ['student-academic'],
  'Content Creation': ['video-editing', 'photo-editing'],
  'General Everyday Use': ['general-purpose'],
};
