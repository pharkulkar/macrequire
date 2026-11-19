import { NextFunction, Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { recommendationProfileSchema, RecommendationProfile } from './profile.schema';
import { recommendationService } from './recommendation.service';

const h = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
  fn(req, res).catch(next);

const idParam = z.object({ id: z.string().trim().min(1).max(60) });

const compareBody = z
  .object({
    recommendationId: z.string().trim().min(1).max(60).optional(),
    profile: recommendationProfileSchema.optional(),
    configurationIds: z
      .array(z.string().trim().min(1).max(60))
      .min(2, 'Select at least 2 configurations')
      .max(4, 'Compare up to 4 configurations')
      .refine((ids) => new Set(ids).size === ids.length, 'Configuration ids must be unique'),
  })
  .strict()
  .refine((b) => Boolean(b.recommendationId) !== Boolean(b.profile), { message: 'Provide exactly one of recommendationId or profile' });

// Generating a recommendation scores every configuration, so it gets a tighter limit than read endpoints.
const generateLimit = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: { message: 'Too many recommendation requests. Please wait a minute and try again.' } } });

export const recommendationsRouter = Router();

recommendationsRouter.post(
  '/',
  generateLimit,
  validate(recommendationProfileSchema),
  h(async (req, res) => res.status(201).json(await recommendationService.create(req.body as RecommendationProfile))),
);

// Declared before '/:id' so "compare" is not read as an id.
recommendationsRouter.post(
  '/compare',
  generateLimit,
  validate(compareBody),
  h(async (req, res) => res.json(await recommendationService.compare(req.body as z.infer<typeof compareBody>))),
);

recommendationsRouter.get('/:id', validate(idParam, 'params'), h(async (req, res) => res.json(await recommendationService.get(req.params.id))));
recommendationsRouter.get('/:id/breakdown', validate(idParam, 'params'), h(async (req, res) => res.json(await recommendationService.breakdown(req.params.id))));
