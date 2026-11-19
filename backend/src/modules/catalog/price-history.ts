/** Turns raw price records into chart-ready series. Pure functions: no database access here. */

export interface RawPoint { price: number; recordedAt: Date }
export interface Point { at: string; price: number }

export const RANGES = { '30d': 30, '90d': 90, '1y': 365, all: null } as const;
export type RangeKey = keyof typeof RANGES;

const DAY = 86_400_000;
/** Every change is kept for this long; older points are thinned to one per week. */
const FULL_DETAIL_DAYS = 730;
const MAX_POINTS = 400;

/** A record is written whenever the price OR the stock changes. Charts only care about price changes. */
export function collapseToPriceChanges(points: RawPoint[]): RawPoint[] {
  const out: RawPoint[] = [];
  for (const p of points) if (!out.length || out[out.length - 1].price !== p.price) out.push(p);
  return out;
}

/** Keeps the last point of each week for data older than the full-detail window. */
export function thinOld(points: RawPoint[], now = Date.now()): RawPoint[] {
  const cutoff = now - FULL_DETAIL_DAYS * DAY;
  const out: RawPoint[] = [];
  let lastWeek = -1;
  for (const p of points) {
    if (p.recordedAt.getTime() >= cutoff) { out.push(p); continue; }
    const week = Math.floor(p.recordedAt.getTime() / (7 * DAY));
    if (week === lastWeek && out.length) out[out.length - 1] = p; // same week: keep the later one
    else out.push(p);
    lastWeek = week;
  }
  return out;
}

/**
 * Points inside the range, plus the point in effect when the range starts (so the line begins at the right height).
 */
export function withinRange(points: RawPoint[], range: RangeKey, now = Date.now()): RawPoint[] {
  const days = RANGES[range];
  if (days === null) return points;
  const start = now - days * DAY;
  const firstInside = points.findIndex((p) => p.recordedAt.getTime() >= start);
  if (firstInside === -1) return points.length ? [points[points.length - 1]] : [];
  return points.slice(Math.max(0, firstInside - 1));
}

/** Evenly drops points when a series is still too long, always keeping the first and last. */
export function capPoints(points: RawPoint[], max = MAX_POINTS): RawPoint[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}

export const toPoints = (points: RawPoint[]): Point[] => points.map((p) => ({ at: p.recordedAt.toISOString(), price: p.price }));

export function prepareSeries(raw: RawPoint[], range: RangeKey, now = Date.now()): Point[] {
  return toPoints(capPoints(withinRange(thinOld(collapseToPriceChanges(raw), now), range, now)));
}
