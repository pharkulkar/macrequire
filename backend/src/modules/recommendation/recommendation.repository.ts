import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { publicConfigurationFilter } from '../../lib/site-settings';

/** Data access for the recommendation module. No scoring logic here. */

const candidateInclude = {
  model: true,
  chip: true,
  specification: true,
  offers: { where: { isActive: true, merchant: { isActive: true } }, include: { merchant: { select: { name: true } } } },
} satisfies Prisma.ProductConfigurationInclude;

export type CandidateRecord = Prisma.ProductConfigurationGetPayload<{ include: typeof candidateInclude }>;
export type AppRecord = Prisma.ApplicationGetPayload<{ include: { requirements: true } }>;

export const recommendationRepository = {
  loadActiveConfigurations() {
    return prisma.productConfiguration.findMany({
      where: { isActive: true, ...publicConfigurationFilter(), model: { isActive: true } },
      include: candidateInclude,
    });
  },

  loadConfigurationsByIds(ids: string[]) {
    return prisma.productConfiguration.findMany({ where: { id: { in: ids }, isActive: true, ...publicConfigurationFilter() }, include: candidateInclude });
  },

  loadApplications(ids: string[]) {
    if (!ids.length) return Promise.resolve([] as AppRecord[]);
    return prisma.application.findMany({ where: { id: { in: ids }, isActive: true }, include: { requirements: true } });
  },

  async loadUseCases(slugs: string[]) {
    return prisma.useCase.findMany({ where: { slug: { in: slugs }, isActive: true }, include: { weights: true } });
  },

  activeRuleSet() {
    return prisma.scoringRuleSet.findFirst({ where: { isActive: true }, orderBy: { updatedAt: 'desc' } });
  },

  getProfile(id: string) {
    return prisma.recommendationProfile.findUnique({
      where: { id },
      include: {
        results: { orderBy: { rank: 'asc' }, include: { breakdown: true } },
      },
    });
  },

  createProfileWithResults(data: Prisma.RecommendationProfileCreateInput) {
    return prisma.recommendationProfile.create({ data });
  },
};
