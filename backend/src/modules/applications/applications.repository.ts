import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ListApplicationsQuery } from './applications.schemas';

const include = { requirements: true } satisfies Prisma.ApplicationInclude;
export type ApplicationRecord = Prisma.ApplicationGetPayload<{ include: typeof include }>;

const textMatch = (q: string): Prisma.ApplicationWhereInput => {
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  return {
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { slug: { contains: q.toLowerCase().replace(/\s+/g, '-') } },
      { category: { contains: q, mode: 'insensitive' } },
      { aliases: { hasSome: tokens } },
    ],
  };
};

export const applicationsRepository = {
  async list(q: ListApplicationsQuery) {
    const where: Prisma.ApplicationWhereInput = {
      isActive: true,
      ...(q.q && textMatch(q.q)),
      ...(q.category && { category: { equals: q.category, mode: 'insensitive' } }),
      ...(q.categories?.length && { category: { in: q.categories } }),
      ...(q.macSupported !== undefined && { macSupported: q.macSupported }),
    };
    const [total, items] = await prisma.$transaction([
      prisma.application.count({ where }),
      prisma.application.findMany({
        where,
        include,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return { total, items };
  },

  search(q: string, take: number) {
    // Over-fetch, then rank in the service layer.
    return prisma.application.findMany({ where: { isActive: true, ...textMatch(q) }, include, take: take * 3 });
  },

  find(idOrSlug: string) {
    return prisma.application.findFirst({ where: { isActive: true, OR: [{ id: idOrSlug }, { slug: idOrSlug }] }, include });
  },

  async categories() {
    const rows = await prisma.application.groupBy({ by: ['category'], where: { isActive: true }, _count: { _all: true }, orderBy: { category: 'asc' } });
    return rows.map((r) => ({ name: r.category, count: r._count._all }));
  },

  /** Active, Mac-compatible applications for the given slugs (used for use-case starter apps). */
  findStarterApps(slugs: string[]) {
    return prisma.application.findMany({ where: { slug: { in: slugs }, isActive: true, macSupported: true }, select: { id: true, slug: true, name: true, macSupported: true } });
  },
  listUseCases() {
    return prisma.useCase.findMany({ where: { isActive: true }, include: { weights: true }, orderBy: { sortOrder: 'asc' } });
  },
};
