import { Router } from 'express';
import {
  configurationsRouter,
  merchantsRouter,
  offersRouter,
  productsRouter,
} from '../modules/catalog/catalog.routes';
import { applicationsRouter, useCasesRouter } from '../modules/applications/applications.routes';
import { recommendationsRouter } from '../modules/recommendation/recommendation.routes';
import { adminRouter } from '../modules/admin';
import { outboundRouter } from '../modules/affiliate/outbound.routes';
import { methodologyRouter } from '../modules/catalog/methodology.routes';
import { marketRouter } from '../modules/market/market.routes';
import { refreshSettings } from '../lib/site-settings';
import { healthRouter } from './health';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
// Keep the site-wide switches fresh for every API request (cached for a few seconds).
apiRouter.use((_req, _res, next) => void refreshSettings().finally(next));
apiRouter.use('/products', productsRouter);
apiRouter.use('/configurations', configurationsRouter);
apiRouter.use('/merchants', merchantsRouter);
apiRouter.use('/offers', offersRouter);
apiRouter.use('/applications', applicationsRouter);
apiRouter.use('/use-cases', useCasesRouter);
apiRouter.use('/recommendations', recommendationsRouter);
apiRouter.use('/methodology', methodologyRouter);
apiRouter.use('/market', marketRouter);
apiRouter.use('/outbound', outboundRouter);
apiRouter.use('/admin', adminRouter);
