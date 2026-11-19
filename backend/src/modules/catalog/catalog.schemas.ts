import { z } from 'zod';
import { MARKET_CODES, MarketCode } from '../../lib/markets';
const marketCode = z.enum(MARKET_CODES as [MarketCode, ...MarketCode[]]);

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export const listProductsQuery = z.object({
  ...pagination,
  category: z.string().trim().min(1).optional(),
  generation: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

export const listConfigurationsQuery = z.object({
  ...pagination,
  category: z.string().trim().min(1).optional(),
  modelId: z.string().trim().min(1).optional(),
  chip: z.string().trim().min(1).optional(),
  minRam: z.coerce.number().int().min(1).optional(),
  maxRam: z.coerce.number().int().min(1).optional(),
  minStorage: z.coerce.number().int().min(1).optional(),
  maxStorage: z.coerce.number().int().min(1).optional(),
  screenSize: z.coerce.number().min(10).max(20).optional(),
  sort: z.enum(['ram', 'storage', 'newest']).default('newest'),
  country: marketCode.optional(),
});

export const compareQuery = z.object({
  country: marketCode.optional(),
  ids: z
    .string()
    .transform((v) => [...new Set(v.split(',').map((s) => s.trim()).filter(Boolean))])
    .pipe(z.array(z.string()).min(2, 'Select at least 2 configurations').max(4, 'Compare up to 4 configurations')),
});

export const idParam = z.object({ id: z.string().trim().min(1) });
export const configurationIdParam = z.object({ configurationId: z.string().trim().min(1) });

export type ListProductsQuery = z.infer<typeof listProductsQuery>;
export type ListConfigurationsQuery = z.infer<typeof listConfigurationsQuery>;
