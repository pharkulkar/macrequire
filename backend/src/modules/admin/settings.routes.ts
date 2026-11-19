import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { refreshSettings, saveSettings } from '../../lib/site-settings';
import { requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

const patch = z.object({ showCtoConfigurations: z.boolean() }).partial().strict().refine((b) => Object.keys(b).length > 0, 'Provide at least one setting');
const h = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const settingsRouter = Router();
settingsRouter.get('/settings', h(async (_req, res) => res.json(await refreshSettings(true))));
settingsRouter.patch('/settings', requireRole('ADMIN'), validate(patch), h(async (req, res) => res.json(await saveSettings(req.body))));
