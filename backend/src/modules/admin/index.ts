import { NextFunction, Request, Response, Router } from 'express';
import { env } from '../../config/env';
import { requireAdmin, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { analyticsService, clickAnalyticsQuery, overviewQuery } from './analytics.service';
import { applicationsAdminRouter } from './applications.admin';
import { auditRouter, auditTrail } from './audit';
import { adminAuthRouter } from './auth.routes';
import { catalogAdminRouter } from './catalog.admin';
import { commerceRouter } from './commerce.routes';
import { importsRouter } from './imports.admin';
import { pricingAdminRouter } from './pricing.admin';
import { settingsRouter } from './settings.routes';
import { scoringAdminRouter } from './scoring.admin';
import { usersRouter } from './users.routes';

export const adminRouter = Router();

// Public: login only. Everything after this line requires a valid, active admin.
adminRouter.use('/auth', adminAuthRouter);

adminRouter.use(requireAdmin);
adminRouter.use(auditTrail);
adminRouter.use(commerceRouter);
adminRouter.use(catalogAdminRouter);
adminRouter.use(applicationsAdminRouter);
adminRouter.use(scoringAdminRouter);
adminRouter.use(importsRouter);
adminRouter.use(settingsRouter);
// Lets an administrator check that TRUST_PROXY_HOPS is right: "ip" must be your own public address.
adminRouter.get('/diagnostics/network', requireRole('ADMIN'), (req, res) =>
  res.json({
    ip: req.ip,
    trustProxyHops: env.TRUST_PROXY_HOPS ?? 1,
    forwardedFor: req.headers['x-forwarded-for'] ?? null,
    trueClientIp: req.headers['true-client-ip'] ?? null,
    cfConnectingIp: req.headers['cf-connecting-ip'] ?? null,
  }),
);
adminRouter.use(pricingAdminRouter);
adminRouter.use('/users', usersRouter);
adminRouter.use('/audit', auditRouter);

const send = (fn: (q: never) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => fn(req.query as never).then((d) => res.json(d)).catch(next);
adminRouter.get('/analytics/clicks', validate(clickAnalyticsQuery, 'query'), send((q) => analyticsService.clicks(q)));
adminRouter.get('/analytics/overview', validate(overviewQuery, 'query'), send((q) => analyticsService.overview(q)));
