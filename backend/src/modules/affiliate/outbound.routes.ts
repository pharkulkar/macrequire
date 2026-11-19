import { NextFunction, Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env';
import { validate } from '../../middleware/validate';
import { outboundService } from './outbound.service';

const params = z.object({ offerId: z.string().trim().min(1).max(60) });
const query = z.object({ source: z.string().trim().max(30).optional(), result: z.string().trim().max(60).optional() });

const outboundLimit = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false });

export const outboundRouter = Router();

/**
 * GET /api/outbound/:offerId?source=recommendation&result=<resultId>
 * Records the click, then redirects (302) to the stored merchant/affiliate URL, unchanged.
 */
outboundRouter.get('/:offerId', outboundLimit, validate(params, 'params'), validate(query, 'query'), (req: Request, res: Response, next: NextFunction) => {
  const q = req.query as z.infer<typeof query>;
  outboundService
    .resolve(req.params.offerId, {
      source: q.source,
      resultId: q.result,
      userAgent: req.get('user-agent') ?? undefined,
      ip: req.ip,
      method: req.method,
    })
    .then((result) => {
      res.set({
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
        // Keep the origin as the referrer so merchants and affiliate networks can see where the visit came from.
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      });
      if (result.ok) return res.redirect(302, result.url);
      return res.redirect(302, `${env.FRONTEND_URL}/offer-unavailable`);
    })
    .catch(next);
});
