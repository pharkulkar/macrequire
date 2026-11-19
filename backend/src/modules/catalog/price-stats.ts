import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

/** What the price history says about one offer. Only prices we actually recorded are used; nothing is estimated. */
export interface PriceStats {
  /** The lowest price recorded for this offer, and the first time it was recorded. */
  lowest: { amount: number; recordedAt: Date };
  /** The most recent recorded price that differs from today's price, or null if it has never changed. */
  previous: { amount: number; recordedAt: Date } | null;
  /** How many price records exist for this offer (a record is written whenever the price or stock changes). */
  observations: number;
  /** How many times the price itself has changed (stock-only records do not count). */
  priceChanges: number;
  /** When the first price was recorded for this offer. */
  since: Date;
}

/** Loads price statistics for many offers with three queries, however long their histories are. */
export async function loadPriceStats(offerIds: string[]): Promise<Map<string, PriceStats>> {
  const out = new Map<string, PriceStats>();
  if (!offerIds.length) return out;
  const ids = Prisma.sql`${offerIds}::text[]`;

  const [lows, previous, counts, changes] = await Promise.all([
    prisma.$queryRaw<{ offerId: string; price: number; recordedAt: Date }[]>(Prisma.sql`
      SELECT DISTINCT ON ("offerId") "offerId", price, "recordedAt"
      FROM "PriceHistory"
      WHERE "offerId" = ANY(${ids}) AND price IS NOT NULL
      ORDER BY "offerId", price ASC, "recordedAt" ASC`),
    prisma.$queryRaw<{ offerId: string; price: number; recordedAt: Date }[]>(Prisma.sql`
      SELECT DISTINCT ON (h."offerId") h."offerId", h.price, h."recordedAt"
      FROM "PriceHistory" h JOIN "MerchantOffer" o ON o.id = h."offerId"
      WHERE h."offerId" = ANY(${ids}) AND h.price IS NOT NULL AND o.price IS NOT NULL AND h.price <> o.price
      ORDER BY h."offerId", h."recordedAt" DESC`),
    prisma.priceHistory.groupBy({ by: ['offerId'], where: { offerId: { in: offerIds }, price: { not: null } }, _count: { _all: true }, _min: { recordedAt: true } }),
    prisma.$queryRaw<{ offerId: string; changes: bigint }[]>(Prisma.sql`
      SELECT "offerId", count(*) FILTER (WHERE prev IS NOT NULL AND price <> prev) AS changes
      FROM (SELECT "offerId", price, LAG(price) OVER (PARTITION BY "offerId" ORDER BY "recordedAt") AS prev
            FROM "PriceHistory" WHERE "offerId" = ANY(${ids}) AND price IS NOT NULL) t
      GROUP BY "offerId"`),
  ]);

  const prev = new Map(previous.map((r) => [r.offerId, { amount: r.price, recordedAt: r.recordedAt }]));
  const count = new Map(counts.map((r) => [r.offerId, { n: r._count._all, since: r._min.recordedAt }]));
  const changed = new Map(changes.map((r) => [r.offerId, Number(r.changes)]));
  for (const r of lows) out.set(r.offerId, { lowest: { amount: r.price, recordedAt: r.recordedAt }, previous: prev.get(r.offerId) ?? null, observations: count.get(r.offerId)?.n ?? 1, priceChanges: changed.get(r.offerId) ?? 0, since: count.get(r.offerId)?.since ?? r.recordedAt });
  return out;
}
