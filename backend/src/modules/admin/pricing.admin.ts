import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { validate } from '../../middleware/validate';

const DAY = 86_400_000;
const query = z.object({
  country: z.enum(['IN', 'US']).default('US'),
  merchant: z.string().trim().min(1).max(60).optional(),
  staleDays: z.coerce.number().int().min(1).max(365).default(7),
});

const storageLabel = (gb: number) => (gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`);

/**
 * How complete and fresh pricing is. The first block says how many configurations a shopper in this country can
 * currently see a verified, in-stock price for (this is what lets the budget filter work). The optional merchant
 * block lists the configurations that merchant still has no priced offer for.
 */
async function coverage(q: z.infer<typeof query>) {
  const stale = new Date(Date.now() - q.staleDays * DAY);
  const configs = await prisma.productConfiguration.findMany({
    where: { isActive: true, model: { isActive: true } },
    orderBy: [{ model: { name: 'asc' } }, { chip: { name: 'asc' } }, { ramGB: 'asc' }, { storageGB: 'asc' }],
    include: { model: { select: { name: true } }, chip: { select: { name: true } }, offers: { where: { isActive: true, merchant: { isActive: true }, country: q.country }, include: { merchant: { select: { slug: true } } } } },
  });
  const label = (c: (typeof configs)[number]) => `${c.model.name} · ${c.chip.name} (${c.cpuCores}-core CPU, ${c.gpuCores}-core GPU) · ${c.ramGB}GB · ${storageLabel(c.storageGB)}`;
  const usable = (c: (typeof configs)[number]) => c.offers.some((o) => o.price !== null && o.stock !== 'OUT_OF_STOCK' && o.priceVerifiedAt && o.priceVerifiedAt >= stale);

  const overall = {
    country: q.country,
    totalConfigurations: configs.length,
    withFreshInStockPrice: configs.filter(usable).length,
    withAnyOffer: configs.filter((c) => c.offers.length > 0).length,
    withStalePriceOnly: configs.filter((c) => !usable(c) && c.offers.some((o) => o.price !== null && o.stock !== 'OUT_OF_STOCK')).length,
    allOutOfStock: configs.filter((c) => c.offers.length > 0 && c.offers.every((o) => o.stock === 'OUT_OF_STOCK')).length,
    staleDays: q.staleDays,
  };
  let merchantBlock = null;
  if (q.merchant) {
    const m = await prisma.merchant.findUnique({ where: { slug: q.merchant } });
    if (!m) throw new HttpError(404, `Merchant "${q.merchant}" not found`);
    const mine = configs.map((c) => ({ c, o: c.offers.find((o) => o.merchant.slug === m.slug) }));
    merchantBlock = {
      merchant: { slug: m.slug, name: m.name, country: m.country },
      withOffer: mine.filter((x) => x.o).length,
      withPrice: mine.filter((x) => x.o?.price != null).length,
      stale: mine.filter((x) => x.o && (!x.o.priceVerifiedAt || x.o.priceVerifiedAt < stale)).length,
      missing: mine.filter((x) => !x.o || x.o.price == null).slice(0, 300).map((x) => ({ configurationId: x.c.id, label: label(x.c) })),
    };
  }
  return { overall, merchant: merchantBlock };
}

export const pricingAdminRouter = Router();
pricingAdminRouter.get('/pricing/coverage', validate(query, 'query'), (req: Request, res: Response, next: NextFunction) => {
  coverage(req.query as never).then((d) => res.json(d)).catch(next);
});
