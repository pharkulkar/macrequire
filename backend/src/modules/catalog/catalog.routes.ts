import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { MARKET_CODES, MarketCode } from '../../lib/markets';
import { validate } from '../../middleware/validate';
import {
  compareQuery,
  configurationIdParam,
  idParam,
  listConfigurationsQuery,
  listProductsQuery,
} from './catalog.schemas';
import { catalogService } from './catalog.service';

// Express 4 does not catch rejected promises, so wrap async handlers.
const h = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
  fn(req, res).catch(next);

const countryQuery = z.object({ country: z.enum(MARKET_CODES as [MarketCode, ...MarketCode[]]).optional() });
const country = (req: Request) => (req.query as { country?: string }).country;

export const productsRouter = Router();
productsRouter.get('/', validate(listProductsQuery, 'query'), h(async (req, res) => res.json(await catalogService.listProducts(req.query as never))));
productsRouter.get('/:id', validate(idParam, 'params'), validate(countryQuery, 'query'), h(async (req, res) => res.json(await catalogService.getProduct(req.params.id, country(req)))));
productsRouter.get(
  '/:id/configurations',
  validate(idParam, 'params'),
  validate(countryQuery, 'query'),
  h(async (req, res) => res.json(await catalogService.listProductConfigurations(req.params.id, country(req)))),
);

export const configurationsRouter = Router();
configurationsRouter.get('/', validate(listConfigurationsQuery, 'query'), h(async (req, res) => res.json(await catalogService.listConfigurations(req.query as never))));
// Must be declared before '/:id' so "compare" is not treated as an id.
configurationsRouter.get('/compare', validate(compareQuery, 'query'), h(async (req, res) => res.json(await catalogService.compare((req.query as unknown as z.infer<typeof compareQuery>).ids, country(req)))));
const historyQuery = z.object({ country: z.enum(MARKET_CODES as [MarketCode, ...MarketCode[]]).optional(), range: z.enum(['30d', '90d', '1y', 'all']).default('90d') });
configurationsRouter.get(
  '/:id/price-history',
  validate(idParam, 'params'),
  validate(historyQuery, 'query'),
  h(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof historyQuery>;
    res.json(await catalogService.priceHistory(req.params.id, q.country, q.range));
  }),
);
configurationsRouter.get('/:id', validate(idParam, 'params'), validate(countryQuery, 'query'), h(async (req, res) => res.json(await catalogService.getConfiguration(req.params.id, country(req)))));

export const merchantsRouter = Router();
merchantsRouter.get('/', validate(countryQuery, 'query'), h(async (req, res) => res.json(await catalogService.listMerchants((req.query as { country?: string }).country))));

export const offersRouter = Router();
offersRouter.get(
  '/:configurationId',
  validate(configurationIdParam, 'params'),
  validate(countryQuery, 'query'),
  h(async (req, res) => res.json(await catalogService.listOffers(req.params.configurationId, country(req)))),
);
