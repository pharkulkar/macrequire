import { z } from 'zod';
import { imageRef, merchantUrl } from '../affiliate/url';

const id = z.string().trim().min(1).max(60);
const dataSource = z.enum(['OFFICIAL_APPLE', 'MERCHANT_FEED', 'ADMIN_VERIFIED', 'SAMPLE']);
const verification = z.enum(['STORE_CONFIRMED', 'CTO_DERIVED', 'ADMIN_VERIFIED']);
const isoDate = z.coerce.date().max(new Date(Date.now() + 86_400_000), 'Verification date cannot be in the future');
const optText = (max = 300) => z.string().trim().max(max);
const pos = z.number().int().positive();
const page = { page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) };
const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

export const idParam = z.object({ id });

// ---- chips
const chipFields = {
  name: z.string().trim().min(1).max(60),
  family: z.string().trim().min(1).max(30),
  tier: z.enum(['BASE', 'PRO', 'MAX', 'ULTRA']),
  cpuCores: pos.max(128),
  superCores: pos.max(64).nullable(),
  performanceCores: pos.max(64).nullable(),
  efficiencyCores: pos.max(64).nullable(),
  gpuCores: pos.max(256),
  neuralEngineCores: pos.max(256).nullable(),
  neuralEngineNote: optText().nullable(),
  memoryBandwidthGBs: pos.max(5000).nullable(),
  maxMemoryGB: pos.max(4096).nullable(),
  cpuPerfIndex: z.number().min(0).max(100),
  gpuPerfIndex: z.number().min(0).max(100),
  perfIndexBasis: optText(600).nullable(),
  source: dataSource,
  sourceUrl: merchantUrl.nullable(),
  verifiedAt: isoDate.nullable(),
};
export const chipCreate = z
  .object({ ...chipFields, superCores: chipFields.superCores.optional(), performanceCores: chipFields.performanceCores.optional(), efficiencyCores: chipFields.efficiencyCores.optional(), neuralEngineCores: chipFields.neuralEngineCores.optional(), neuralEngineNote: chipFields.neuralEngineNote.optional(), memoryBandwidthGBs: chipFields.memoryBandwidthGBs.optional(), maxMemoryGB: chipFields.maxMemoryGB.optional(), perfIndexBasis: chipFields.perfIndexBasis.optional(), source: chipFields.source.default('ADMIN_VERIFIED'), sourceUrl: chipFields.sourceUrl.optional(), verifiedAt: chipFields.verifiedAt.optional() })
  .strict();
export const chipUpdate = z.object(chipFields).partial().strict().refine((b) => Object.keys(b).length > 0, 'Provide at least one field to update');

// ---- models
const modelFields = {
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(40),
  generation: z.string().trim().min(1).max(30),
  releaseYear: z.number().int().min(2006).max(2100),
  modelIdentifier: optText(80).nullable(),
  screenSizeInch: z.number().min(10).max(20),
  imageUrl: imageRef.nullable(),
  officialSpecUrl: merchantUrl.nullable(),
  source: dataSource,
  verifiedAt: isoDate.nullable(),
  isActive: z.boolean(),
};
export const modelCreate = z
  .object({
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens').max(100),
    ...modelFields,
    modelIdentifier: modelFields.modelIdentifier.optional(),
    imageUrl: modelFields.imageUrl.optional(),
    officialSpecUrl: modelFields.officialSpecUrl.optional(),
    source: modelFields.source.default('ADMIN_VERIFIED'),
    verifiedAt: modelFields.verifiedAt.optional(),
    isActive: modelFields.isActive.default(true),
  })
  .strict();
export const modelUpdate = z.object(modelFields).partial().strict().refine((b) => Object.keys(b).length > 0, 'Provide at least one field to update');
export const modelListQuery = z.object({ ...page, q: z.string().trim().max(100).optional(), includeInactive: bool.prefault('false') });

// ---- configurations
const specFields = {
  displayTech: optText(),
  displayResolution: optText(),
  refreshRateHz: z.number().int().min(24).max(500),
  brightnessNits: z.number().int().min(50).max(5000),
  batteryWh: z.number().min(10).max(200),
  batteryLifeHours: z.number().min(1).max(60),
  weightKg: z.number().min(0.3).max(10),
  ports: z.array(optText(120)).max(20),
  wireless: optText(),
  camera: optText(),
  audio: optText(400),
  externalDisplays: optText(),
};
export const specInput = z.object(specFields).partial().strict();

export const configurationCreate = z
  .object({
    modelId: id,
    chipId: id,
    cpuCores: pos.max(128),
    gpuCores: pos.max(256),
    ramGB: pos.max(4096),
    storageGB: pos.max(65536),
    sku: z.string().trim().min(1).max(60).optional(),
    colors: z.array(optText(40)).max(12).default([]),
    verification: verification.default('ADMIN_VERIFIED'),
    source: dataSource.default('ADMIN_VERIFIED'),
    verifiedAt: isoDate.optional(),
    isActive: z.boolean().default(true),
    spec: specInput.optional(),
  })
  .strict();

export const configurationUpdate = z
  .object({
    sku: z.string().trim().min(1).max(60).nullable(),
    colors: z.array(optText(40)).max(12),
    verification,
    source: dataSource,
    verifiedAt: isoDate.nullable(),
    isActive: z.boolean(),
    spec: specInput,
  })
  .partial()
  .strict()
  .refine((b) => Object.keys(b).length > 0, 'Provide at least one field to update');

export const configurationListQuery = z.object({
  ...page,
  modelId: id.optional(),
  chipId: id.optional(),
  includeInactive: bool.prefault('false'),
  verification: verification.optional(),
});

export type ChipCreate = z.infer<typeof chipCreate>;
export type ChipUpdate = z.infer<typeof chipUpdate>;
export type ModelCreate = z.infer<typeof modelCreate>;
export type ModelUpdate = z.infer<typeof modelUpdate>;
export type ConfigurationCreate = z.infer<typeof configurationCreate>;
export type ConfigurationUpdate = z.infer<typeof configurationUpdate>;
