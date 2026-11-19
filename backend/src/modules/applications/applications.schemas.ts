import { z } from 'zod';

const csv = z
  .string()
  .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean))
  .pipe(z.array(z.string().max(60)).max(20));

export const listApplicationsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  q: z.string().trim().min(1).max(80).optional(),
  category: z.string().trim().min(1).max(60).optional(),
  categories: csv.optional(),
  macSupported: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

export const searchApplicationsQuery = z.object({
  q: z.string().trim().min(1).max(80),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

export const applicationIdParam = z.object({ id: z.string().trim().min(1).max(80) });

export type ListApplicationsQuery = z.infer<typeof listApplicationsQuery>;
export type SearchApplicationsQuery = z.infer<typeof searchApplicationsQuery>;
