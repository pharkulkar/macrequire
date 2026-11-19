import { z } from 'zod';

/**
 * Contract for the questionnaire answers. The scoring engine (Phase 4) consumes this.
 * The frontend mirrors this shape in `core/profile.models.ts`.
 */

export const INTENSITIES = ['BASIC', 'MODERATE', 'HEAVY', 'PROFESSIONAL'] as const;

const importance = z.number().int().min(1).max(5);

export const futureNeedsSchema = z.object({
  learnMoreLanguages: z.boolean().default(false),
  startVideoEditing: z.boolean().default(false),
  runLocalAiModels: z.boolean().default(false),
  useVirtualMachinesOrDocker: z.boolean().default(false),
  multitaskDemandingApps: z.boolean().default(false),
  /** Extra applications the user expects to adopt. Merged with applicationIds for future scoring. */
  futureApplicationIds: z.array(z.string().min(1).max(60)).max(40).default([]),
});

export const budgetSchema = z
  .object({
    country: z.enum(['IN', 'US']),
    currency: z.enum(['INR', 'USD']),
    min: z.number().int().min(0).default(0),
    max: z.number().int().positive(),
  })
  .refine((b) => b.max >= b.min, { message: 'Maximum budget must be at least the minimum', path: ['max'] })
  .refine((b) => (b.country === 'IN') === (b.currency === 'INR'), { message: 'Currency does not match country', path: ['currency'] });

export const preferencesSchema = z.object({
  screenSizeInch: z.number().min(10).max(20).optional(),
  portability: importance.optional(),
  batteryLife: importance.optional(),
  displayQuality: importance.optional(),
  performance: importance.optional(),
  storageGB: z.number().int().positive().optional(),
  ramGB: z.number().int().positive().optional(),
  ownershipYears: z.number().int().min(1).max(10).optional(),
});

export const recommendationProfileSchema = z
  .object({
    useCases: z.array(z.string().min(1).max(60)).min(1, 'Choose at least one use case').max(16),
    applicationIds: z.array(z.string().min(1).max(60)).max(40).default([]),
    intensity: z.enum(INTENSITIES),
    future: futureNeedsSchema.prefault({}),
    budget: budgetSchema,
    preferences: preferencesSchema.prefault({}),
  })
  .strict();

export type RecommendationProfile = z.infer<typeof recommendationProfileSchema>;
