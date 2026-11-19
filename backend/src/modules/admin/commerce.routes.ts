import { NextFunction, Request, Response, Router } from 'express';
import { HttpError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  idParam,
  merchantCreate,
  merchantListQuery,
  merchantUpdate,
  offerCreate,
  offerListQuery,
  offerUpdate,
  programCreate,
  programListQuery,
  programUpdate,
} from './commerce.schemas';
import { commerceService } from './commerce.service';

const h = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

const adminOnly = requireRole('ADMIN');
const editors = requireRole('ADMIN', 'EDITOR');

/**
 * A manual affiliate URL decides where shoppers are sent and who is paid, so only ADMINs may set or change one.
 * EDITORs keep everything else (prices, stock, product IDs) and the merchant's affiliate ID still applies to their offers.
 */
const REASON = 'Only an ADMIN can set or change an affiliate URL';
const guardCreate = (req: Request, _res: Response, next: NextFunction) =>
  req.body?.affiliateUrl && req.admin?.role !== 'ADMIN' ? next(new HttpError(403, REASON)) : next();
const guardUpdate = (req: Request, _res: Response, next: NextFunction) => {
  if (req.admin?.role === 'ADMIN' || req.body?.affiliateUrl === undefined) return next();
  prisma.merchantOffer
    .findUnique({ where: { id: req.params.id }, select: { affiliateUrl: true } })
    .then((o) => (o && (req.body.affiliateUrl ?? null) !== o.affiliateUrl ? next(new HttpError(403, REASON)) : next()))
    .catch(next);
};

/** Mounted under /api/admin behind requireAdmin. */
export const commerceRouter = Router();

// Merchants and affiliate programs are structural, so only ADMINs can change them.
commerceRouter.get('/merchants', validate(merchantListQuery, 'query'), h(async (req, res) => res.json(await commerceService.listMerchants(req.query as never))));
commerceRouter.post('/merchants', adminOnly, validate(merchantCreate), h(async (req, res) => res.status(201).json(await commerceService.createMerchant(req.body))));
commerceRouter.patch('/merchants/:id', adminOnly, validate(idParam, 'params'), validate(merchantUpdate), h(async (req, res) => res.json(await commerceService.updateMerchant(req.params.id, req.body))));

commerceRouter.get('/affiliate-programs', validate(programListQuery, 'query'), h(async (req, res) => res.json(await commerceService.listPrograms(req.query as never))));
commerceRouter.post('/affiliate-programs', adminOnly, validate(programCreate), h(async (req, res) => res.status(201).json(await commerceService.createProgram(req.body))));
commerceRouter.patch('/affiliate-programs/:id', adminOnly, validate(idParam, 'params'), validate(programUpdate), h(async (req, res) => res.json(await commerceService.updateProgram(req.params.id, req.body))));

// Offers (prices, stock and links) are day-to-day work, so EDITORs can manage them too.
commerceRouter.get('/offers', validate(offerListQuery, 'query'), h(async (req, res) => res.json(await commerceService.listOffers(req.query as never))));
commerceRouter.post('/offers', editors, validate(offerCreate), guardCreate, h(async (req, res) => res.status(201).json(await commerceService.createOffer(req.body))));
commerceRouter.get('/offers/:id', validate(idParam, 'params'), h(async (req, res) => res.json(await commerceService.getOffer(req.params.id))));
commerceRouter.patch('/offers/:id', editors, validate(idParam, 'params'), validate(offerUpdate), guardUpdate, h(async (req, res) => res.json(await commerceService.updateOffer(req.params.id, req.body))));
// Deactivates (does not delete) so click and price history are preserved.
commerceRouter.delete('/offers/:id', editors, validate(idParam, 'params'), h(async (req, res) => res.json(await commerceService.deactivateOffer(req.params.id))));
commerceRouter.get('/offers/:id/price-history', validate(idParam, 'params'), h(async (req, res) => res.json(await commerceService.priceHistory(req.params.id))));
