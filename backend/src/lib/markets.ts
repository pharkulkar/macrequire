/** Countries MacRequire can price for. A market is "available" once it has priced offers (see modules/market). */
export const MARKETS = {
  US: { currency: 'USD', name: 'United States' },
  IN: { currency: 'INR', name: 'India' },
} as const;
export type MarketCode = keyof typeof MARKETS;
export const MARKET_CODES = Object.keys(MARKETS) as MarketCode[];
/** Shown to visitors from countries with no data of their own, and to crawlers. */
export const DEFAULT_MARKET: MarketCode = 'US';
export const isMarket = (v: unknown): v is MarketCode => typeof v === 'string' && v in MARKETS;
