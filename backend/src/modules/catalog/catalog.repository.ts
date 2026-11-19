import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { publicConfigurationFilter } from '../../lib/site-settings';
import { ListConfigurationsQuery, ListProductsQuery } from './catalog.schemas';

/** Data access only: no business rules, no HTTP concerns. */

const configurationInclude = {
  model: true,
  chip: true,
  specification: true,
  offers: { where: { isActive: true, merchant: { isActive: true } }, include: { merchant: true }, orderBy: { price: 'asc' as const } },
} satisfies Prisma.ProductConfigurationInclude;

export type ConfigurationRecord = Prisma.ProductConfigurationGetPayload<{ include: typeof configurationInclude }>;

export const catalogRepository = {
  async listModels(q: ListProductsQuery) {
    const where: Prisma.ProductModelWhereInput = {
      isActive: true,
      ...(q.category && { category: { equals: q.category, mode: 'insensitive' } }),
      ...(q.generation && { generation: { equals: q.generation, mode: 'insensitive' } }),
      ...(q.q && { name: { contains: q.q, mode: 'insensitive' } }),
      // A model with no visible configuration is not shown.
      configurations: { some: { isActive: true, ...publicConfigurationFilter() } },
    };
    const [total, items] = await prisma.$transaction([
      prisma.productModel.count({ where }),
      prisma.productModel.findMany({
        where,
        orderBy: [{ releaseYear: 'desc' }, { screenSizeInch: 'asc' }, { name: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          configurations: {
            where: { isActive: true, ...publicConfigurationFilter() },
            select: { ramGB: true, storageGB: true, chip: { select: { name: true } }, verification: true },
          },
        },
      }),
    ]);
    return { total, items };
  },

  findModel(idOrSlug: string) {
    return prisma.productModel.findFirst({
      where: { isActive: true, OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    });
  },

  listConfigurationsForModel(modelId: string) {
    return prisma.productConfiguration.findMany({
      where: { modelId, isActive: true, ...publicConfigurationFilter() },
      include: configurationInclude,
      orderBy: [{ chip: { name: 'asc' } }, { gpuCores: 'asc' }, { ramGB: 'asc' }, { storageGB: 'asc' }],
    });
  },

  async listConfigurations(q: ListConfigurationsQuery) {
    const where: Prisma.ProductConfigurationWhereInput = {
      isActive: true,
      ...publicConfigurationFilter(),
      model: {
        isActive: true,
        ...(q.category && { category: { equals: q.category, mode: 'insensitive' } }),
        ...(q.screenSize && { screenSizeInch: { gte: q.screenSize - 0.5, lte: q.screenSize + 0.5 } }),
      },
      ...(q.modelId && { modelId: q.modelId }),
      ...(q.chip && { chip: { name: { equals: q.chip, mode: 'insensitive' } } }),
      ...((q.minRam || q.maxRam) && { ramGB: { gte: q.minRam, lte: q.maxRam } }),
      ...((q.minStorage || q.maxStorage) && { storageGB: { gte: q.minStorage, lte: q.maxStorage } }),
    };
    const orderBy: Prisma.ProductConfigurationOrderByWithRelationInput[] =
      q.sort === 'ram'
        ? [{ ramGB: 'desc' }, { storageGB: 'desc' }]
        : q.sort === 'storage'
          ? [{ storageGB: 'desc' }, { ramGB: 'desc' }]
          : [{ model: { releaseYear: 'desc' } }, { ramGB: 'asc' }, { storageGB: 'asc' }];
    const [total, items] = await prisma.$transaction([
      prisma.productConfiguration.count({ where }),
      prisma.productConfiguration.findMany({
        where,
        include: configurationInclude,
        orderBy,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return { total, items };
  },

  findConfiguration(id: string) {
    return prisma.productConfiguration.findFirst({ where: { id, isActive: true, ...publicConfigurationFilter() }, include: configurationInclude });
  },

  findConfigurations(ids: string[]) {
    return prisma.productConfiguration.findMany({ where: { id: { in: ids }, isActive: true, ...publicConfigurationFilter() }, include: configurationInclude });
  },

  listMerchants(country?: string) {
    return prisma.merchant.findMany({
      where: { isActive: true, ...(country && { country }) },
      orderBy: [{ country: 'asc' }, { name: 'asc' }],
      select: { id: true, slug: true, name: true, country: true, websiteUrl: true },
    });
  },

  /** Recorded prices (not stock-only rows) for the given offers, oldest first. */
  priceRecords(offerIds: string[]) {
    return prisma.priceHistory.findMany({
      where: { offerId: { in: offerIds }, price: { not: null } },
      orderBy: { recordedAt: 'asc' },
      select: { offerId: true, price: true, recordedAt: true },
    });
  },
  listOffers(configurationId: string, country?: string) {
    return prisma.merchantOffer.findMany({
      where: { configurationId, isActive: true, merchant: { isActive: true }, ...(country && { country }) },
      include: { merchant: true },
      orderBy: { price: 'asc' },
    });
  },
};
