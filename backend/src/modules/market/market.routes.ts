import { NextFunction, Request, Response, Router } from 'express';
import { DEFAULT_MARKET, MARKETS, MARKET_CODES, MarketCode } from '../../lib/markets';
import { prisma } from '../../lib/prisma';
import { publicConfigurationFilter } from '../../lib/site-settings';

/**
 * Headers that hosts and CDNs add with the visitor's country (ISO 3166-1 alpha-2). They are only trusted as a
 * hint for choosing a market, never for anything security related. Without a CDN none exist, so we fall back to
 * the region in the browser's language (en-IN), which is a weaker signal. Visitors can always switch market.
 */
const COUNTRY_HEADERS = ['cf-ipcountry', 'x-vercel-ip-country', 'cloudfront-viewer-country', 'x-appengine-country', 'x-country-code'];

function detectCountry(req: Request): { country: string | null; basis: 'network' | 'language' | 'none' } {
  for (const name of COUNTRY_HEADERS) {
    const v = req.header(name)?.trim().toUpperCase();
    if (v && /^[A-Z]{2}$/.test(v) && v !== 'XX') return { country: v, basis: 'network' };
  }
  const lang = req.header('accept-language')?.split(',')[0]?.trim();
  const region = lang?.match(/^[a-z]{2,3}-([A-Za-z]{2})\b/)?.[1]?.toUpperCase();
  return region ? { country: region, basis: 'language' } : { country: null, basis: 'none' };
}

/** Markets that have at least one active, priced offer from an active merchant. */
async function availableMarkets() {
  const rows = await prisma.merchantOffer.groupBy({
    by: ['country'],
    where: { isActive: true, price: { not: null }, merchant: { isActive: true }, configuration: { isActive: true, ...publicConfigurationFilter(), model: { isActive: true } } },
  });
  const have = new Set(rows.map((r) => r.country));
  // The default market is always listed so there is always somewhere to fall back to.
  return MARKET_CODES.filter((c) => have.has(c) || c === DEFAULT_MARKET).map((c) => ({ country: c, currency: MARKETS[c].currency, name: MARKETS[c].name }));
}

const h = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const marketRouter = Router();
/**
 * Which market a visitor should see. Nothing is stored: the country comes from this request only.
 * `market` is the detected country when we have data for it, otherwise the default.
 */
marketRouter.get('/', h(async (req, res) => {
  const [{ country, basis }, available] = await Promise.all([Promise.resolve(detectCountry(req)), availableMarkets()]);
  const supported = available.some((m) => m.country === country);
  res.set('Cache-Control', 'private, no-store').json({
    detected: country,
    basis,
    market: (supported ? country : DEFAULT_MARKET) as MarketCode,
    fallback: !supported,
    default: DEFAULT_MARKET,
    available,
  });
}));
