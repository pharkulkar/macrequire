import { NextFunction, Request, Response, Router } from 'express';
import { validate } from '../../middleware/validate';
import { applicationIdParam, listApplicationsQuery, searchApplicationsQuery } from './applications.schemas';
import { applicationsService } from './applications.service';

const h = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
  fn(req, res).catch(next);

export const applicationsRouter = Router();
applicationsRouter.get('/', validate(listApplicationsQuery, 'query'), h(async (req, res) => res.json(await applicationsService.list(req.query as never))));
// Static paths must be declared before '/:id'.
applicationsRouter.get('/search', validate(searchApplicationsQuery, 'query'), h(async (req, res) => res.json(await applicationsService.search(req.query as never))));
applicationsRouter.get('/categories', h(async (_req, res) => res.json(await applicationsService.categories())));
applicationsRouter.get('/:id', validate(applicationIdParam, 'params'), h(async (req, res) => res.json(await applicationsService.get(req.params.id))));

export const useCasesRouter = Router();
useCasesRouter.get('/', h(async (_req, res) => res.json(await applicationsService.useCases())));
