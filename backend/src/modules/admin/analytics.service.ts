import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const clickAnalyticsQuery = z.object({
  from: date.optional(),
  to: date.optional(),
  country: z.enum(['IN', 'US']).optional(),
  merchantId: z.string().trim().min(1).max(60).optional(),
});
export type ClickAnalyticsQuery = z.infer<typeof clickAnalyticsQuery>;

export const overviewQuery = z.object({ from: date.optional(), to: date.optional() });
export type OverviewQuery = z.infer<typeof overviewQuery>;

const n = (v: unknown) => Number(v ?? 0);

/**
 * Outbound click analytics. These count visits we sent to merchants. They say nothing about purchases:
 * sales and commissions are only known to the affiliate network and are not recorded here.
 */
export const analyticsService = {
  async clicks(q: ClickAnalyticsQuery) {
    const DAY = 86_400_000;
    const to = q.to ? new Date(`${q.to}T00:00:00Z`) : new Date(Math.floor(Date.now() / DAY) * DAY);
    const toExclusive = new Date(to.getTime() + DAY); // include the whole "to" day
    const from = q.from ? new Date(`${q.from}T00:00:00Z`) : new Date(to.getTime() - 29 * DAY);

    const conds = [Prisma.sql`c."isTest" = false`, Prisma.sql`c."createdAt" >= ${from}`, Prisma.sql`c."createdAt" < ${toExclusive}`];
    if (q.country) conds.push(Prisma.sql`c."country" = ${q.country}`);
    if (q.merchantId) conds.push(Prisma.sql`c."merchantId" = ${q.merchantId}`);
    const where = Prisma.join(conds, ' AND ');

    const profileWhere = Prisma.join(
      [Prisma.sql`p."isTest" = false`, Prisma.sql`p."createdAt" >= ${from}`, Prisma.sql`p."createdAt" < ${toExclusive}`, ...(q.country ? [Prisma.sql`p."country" = ${q.country}`] : [])],
      ' AND ',
    );

    const [totals, byDay, byMerchant, byCountry, bySource, topConfigurations, topModels, generated, withClicks, fromRecs] = await Promise.all([
      prisma.$queryRaw<{ clicks: bigint; offers: bigint; affiliate: bigint }[]>`
        SELECT COUNT(*) AS clicks, COUNT(DISTINCT c."offerId") AS offers,
               COUNT(*) FILTER (WHERE c."linkType" = 'AFFILIATE') AS affiliate
        FROM "AffiliateClickEvent" c WHERE ${where}`,
      prisma.$queryRaw<{ day: Date; clicks: bigint }[]>`
        SELECT date_trunc('day', c."createdAt")::date AS day, COUNT(*) AS clicks
        FROM "AffiliateClickEvent" c WHERE ${where} GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ id: string; name: string; country: string; clicks: bigint }[]>`
        SELECT m.id, m.name, m.country, COUNT(*) AS clicks
        FROM "AffiliateClickEvent" c JOIN "Merchant" m ON m.id = c."merchantId"
        WHERE ${where} GROUP BY m.id, m.name, m.country ORDER BY clicks DESC`,
      prisma.$queryRaw<{ country: string; clicks: bigint }[]>`
        SELECT c."country" AS country, COUNT(*) AS clicks FROM "AffiliateClickEvent" c WHERE ${where} GROUP BY 1 ORDER BY clicks DESC`,
      prisma.$queryRaw<{ source: string; clicks: bigint }[]>`
        SELECT COALESCE(c."referralSource", 'other') AS source, COUNT(*) AS clicks FROM "AffiliateClickEvent" c WHERE ${where} GROUP BY 1 ORDER BY clicks DESC`,
      prisma.$queryRaw<{ id: string; model: string; chip: string; ram: number; storage: number; clicks: bigint }[]>`
        SELECT pc.id, pm.name AS model, ch.name AS chip, pc."ramGB" AS ram, pc."storageGB" AS storage, COUNT(*) AS clicks
        FROM "AffiliateClickEvent" c
          JOIN "ProductConfiguration" pc ON pc.id = c."configurationId"
          JOIN "ProductModel" pm ON pm.id = pc."modelId"
          JOIN "ChipSpecification" ch ON ch.id = pc."chipId"
        WHERE ${where} GROUP BY pc.id, pm.name, ch.name, pc."ramGB", pc."storageGB" ORDER BY clicks DESC LIMIT 10`,
      prisma.$queryRaw<{ id: string; name: string; clicks: bigint }[]>`
        SELECT pm.id, pm.name, COUNT(*) AS clicks
        FROM "AffiliateClickEvent" c JOIN "ProductModel" pm ON pm.id = c."productModelId"
        WHERE ${where} GROUP BY pm.id, pm.name ORDER BY clicks DESC LIMIT 10`,
      prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "RecommendationProfile" p WHERE ${profileWhere}`,
      prisma.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(DISTINCT r."profileId") AS n
        FROM "AffiliateClickEvent" c
          JOIN "RecommendationResult" r ON r.id = c."resultId"
          JOIN "RecommendationProfile" p ON p.id = r."profileId"
        WHERE ${where} AND p."isTest" = false`,
      prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "AffiliateClickEvent" c WHERE ${where} AND c."resultId" IS NOT NULL`,
    ]);

    const clicks = n(totals[0]?.clicks);
    const recsGenerated = n(generated[0]?.n);
    const recsWithClicks = n(withClicks[0]?.n);

    return {
      range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      filters: { country: q.country ?? null, merchantId: q.merchantId ?? null },
      totals: { clicks, offersClicked: n(totals[0]?.offers), affiliateLinkClicks: n(totals[0]?.affiliate), plainLinkClicks: clicks - n(totals[0]?.affiliate) },
      byDay: byDay.map((r) => ({ day: r.day.toISOString().slice(0, 10), clicks: n(r.clicks) })),
      byMerchant: byMerchant.map((r) => ({ merchantId: r.id, merchant: r.name, country: r.country, clicks: n(r.clicks) })),
      byCountry: byCountry.map((r) => ({ country: r.country, clicks: n(r.clicks) })),
      bySource: bySource.map((r) => ({ source: r.source, clicks: n(r.clicks) })),
      topConfigurations: topConfigurations.map((r) => ({ configurationId: r.id, label: `${r.model} · ${r.chip} · ${r.ram}GB · ${r.storage >= 1024 ? `${r.storage / 1024}TB` : `${r.storage}GB`}`, clicks: n(r.clicks) })),
      topModels: topModels.map((r) => ({ modelId: r.id, model: r.name, clicks: n(r.clicks) })),
      funnel: {
        recommendationsGenerated: recsGenerated,
        recommendationsWithClicks: recsWithClicks,
        clicksFromRecommendations: n(fromRecs[0]?.n),
        clickThroughRate: recsGenerated > 0 ? Math.round((recsWithClicks / recsGenerated) * 1000) / 10 : null,
      },
      notes: [
        'Counts are visits sent to merchants. Crawlers, HEAD requests and repeat clicks within 5 seconds are ignored.',
        'Purchases and commissions are NOT measured here. Only the affiliate network can confirm a sale.',
        'Clicks from the catalog and comparison pages cannot be tied to a recommendation, so the funnel only covers clicks from recommendation results.',
        'Country is the country of the merchant offer that was clicked, not the visitor’s location.',
      ],
    };
  },

  /** How people use the recommender: volume, popular choices, and what it recommended. Test previews are excluded. */
  async overview(q: OverviewQuery) {
    const DAY = 86_400_000;
    const to = q.to ? new Date(`${q.to}T00:00:00Z`) : new Date(Math.floor(Date.now() / DAY) * DAY);
    const toExclusive = new Date(to.getTime() + DAY);
    const from = q.from ? new Date(`${q.from}T00:00:00Z`) : new Date(to.getTime() - 29 * DAY);
    const where = Prisma.sql`p."isTest" = false AND p."createdAt" >= ${from} AND p."createdAt" < ${toExclusive}`;

    const [total, byDay, byCountry, topRecommended, topOverall, useCases, apps, intensity, budgets] = await Promise.all([
      prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "RecommendationProfile" p WHERE ${where}`,
      prisma.$queryRaw<{ day: Date; n: bigint }[]>`SELECT date_trunc('day', p."createdAt")::date AS day, COUNT(*) AS n FROM "RecommendationProfile" p WHERE ${where} GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ country: string; n: bigint }[]>`SELECT p."country" AS country, COUNT(*) AS n FROM "RecommendationProfile" p WHERE ${where} GROUP BY 1 ORDER BY n DESC`,
      prisma.$queryRaw<{ id: string; model: string; chip: string; ram: number; storage: number; n: bigint }[]>`
        SELECT pc.id, pm.name AS model, ch.name AS chip, pc."ramGB" AS ram, pc."storageGB" AS storage, COUNT(*) AS n
        FROM "RecommendationResult" r
          JOIN "RecommendationProfile" p ON p.id = r."profileId"
          JOIN "ProductConfiguration" pc ON pc.id = r."configurationId"
          JOIN "ProductModel" pm ON pm.id = pc."modelId"
          JOIN "ChipSpecification" ch ON ch.id = pc."chipId"
        WHERE ${where} AND r."section" IS DISTINCT FROM 'STRETCH'
        GROUP BY pc.id, pm.name, ch.name, pc."ramGB", pc."storageGB" ORDER BY n DESC LIMIT 10`,
      prisma.$queryRaw<{ id: string; model: string; chip: string; ram: number; storage: number; n: bigint }[]>`
        SELECT pc.id, pm.name AS model, ch.name AS chip, pc."ramGB" AS ram, pc."storageGB" AS storage, COUNT(*) AS n
        FROM "RecommendationResult" r
          JOIN "RecommendationProfile" p ON p.id = r."profileId"
          JOIN "ProductConfiguration" pc ON pc.id = r."configurationId"
          JOIN "ProductModel" pm ON pm.id = pc."modelId"
          JOIN "ChipSpecification" ch ON ch.id = pc."chipId"
        WHERE ${where} AND r."rank" = 1
        GROUP BY pc.id, pm.name, ch.name, pc."ramGB", pc."storageGB" ORDER BY n DESC LIMIT 10`,
      prisma.$queryRaw<{ slug: string; name: string | null; n: bigint }[]>`
        SELECT u.slug, uc.name, COUNT(*) AS n
        FROM "RecommendationProfile" p, LATERAL unnest(p."useCases") AS u(slug)
          LEFT JOIN "UseCase" uc ON uc.slug = u.slug
        WHERE ${where} GROUP BY u.slug, uc.name ORDER BY n DESC LIMIT 16`,
      prisma.$queryRaw<{ id: string; name: string; n: bigint }[]>`
        SELECT a.id, a.name, COUNT(*) AS n
        FROM "RecommendationProfile" p, LATERAL unnest(p."applicationIds") AS x(app_id)
          JOIN "Application" a ON a.id = x.app_id
        WHERE ${where} GROUP BY a.id, a.name ORDER BY n DESC LIMIT 10`,
      prisma.$queryRaw<{ intensity: string; n: bigint }[]>`SELECT p."intensity"::text AS intensity, COUNT(*) AS n FROM "RecommendationProfile" p WHERE ${where} GROUP BY 1 ORDER BY n DESC`,
      prisma.$queryRaw<{ currency: string; median: number; avg: number }[]>`
        SELECT p."currency" AS currency, percentile_cont(0.5) WITHIN GROUP (ORDER BY p."maxBudget") AS median, AVG(p."maxBudget") AS avg
        FROM "RecommendationProfile" p WHERE ${where} GROUP BY 1`,
    ]);

    const label = (r: { model: string; chip: string; ram: number; storage: number }) => `${r.model} · ${r.chip} · ${r.ram}GB · ${r.storage >= 1024 ? `${r.storage / 1024}TB` : `${r.storage}GB`}`;
    return {
      range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      recommendations: { total: n(total[0]?.n), byDay: byDay.map((r) => ({ day: r.day.toISOString().slice(0, 10), count: n(r.n) })), byCountry: byCountry.map((r) => ({ country: r.country, count: n(r.n) })) },
      mostRecommended: topRecommended.map((r) => ({ configurationId: r.id, label: label(r), count: n(r.n) })),
      mostOftenFirst: topOverall.map((r) => ({ configurationId: r.id, label: label(r), count: n(r.n) })),
      popularUseCases: useCases.map((r) => ({ slug: r.slug, name: r.name ?? r.slug, count: n(r.n) })),
      popularApplications: apps.map((r) => ({ applicationId: r.id, name: r.name, count: n(r.n) })),
      intensity: intensity.map((r) => ({ intensity: r.intensity, count: n(r.n) })),
      budgets: budgets.map((r) => ({ currency: r.currency, median: Math.round(Number(r.median)), average: Math.round(Number(r.avg)) })),
      notes: ['Counts exclude admin previews. “Most recommended” counts appearances in the top results; “most often first” counts rank 1.'],
    };
  },
};
