import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { signTestSession } from '../../lib/test-session';
import { requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

const h = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

/** Everything recorded while a test session was active, plus admin previews. */
async function counts() {
  const [recommendations, clicks] = await Promise.all([
    prisma.recommendationProfile.count({ where: { isTest: true } }),
    prisma.affiliateClickEvent.count({ where: { OR: [{ isTest: true }, { result: { profile: { isTest: true } } }] } }),
  ]);
  return { recommendations, clicks };
}

export const testDataRouter = Router();
// Starts a test session: returns a token the browser sends so its activity is tagged as test.
testDataRouter.post('/test-session', requireRole('ADMIN', 'EDITOR'), h(async (req, res) => res.status(201).json(signTestSession(req.admin!.sub))));
testDataRouter.get('/test-data', h(async (_req, res) => res.json(await counts())));
// Deletes test recommendations (with their results and score breakdowns) and test clicks. Real data is never touched.
testDataRouter.delete('/test-data', requireRole('ADMIN'), h(async (_req, res) => {
  const deleted = await prisma.$transaction(async (tx) => {
    const resultIds = (await tx.recommendationResult.findMany({ where: { profile: { isTest: true } }, select: { id: true } })).map((r) => r.id);
    const clicks = await tx.affiliateClickEvent.deleteMany({ where: { OR: [{ isTest: true }, ...(resultIds.length ? [{ resultId: { in: resultIds } }] : [])] } });
    const profiles = await tx.recommendationProfile.deleteMany({ where: { isTest: true } }); // results and breakdowns cascade
    return { recommendations: profiles.count, clicks: clicks.count };
  });
  res.locals.auditSummary = { deletedTestData: deleted };
  res.json({ deleted });
}));

/**
 * Everything the dashboard is built from: every saved recommendation (with its results and score breakdowns) and every
 * recorded Buy click, real or test. Prices, offers, price history, the catalog and admin settings are not part of it.
 */
const clearBody = z.object({ confirm: z.literal('DELETE') }).strict();
testDataRouter.get('/dashboard-data', h(async (_req, res) => {
  const [recommendations, clicks] = await Promise.all([prisma.recommendationProfile.count(), prisma.affiliateClickEvent.count()]);
  res.json({ recommendations, clicks });
}));
testDataRouter.post('/dashboard-data/clear', requireRole('ADMIN'), validate(clearBody), h(async (_req, res) => {
  const deleted = await prisma.$transaction(async (tx) => {
    const clicks = await tx.affiliateClickEvent.deleteMany(); // first: clicks point at recommendation results
    const profiles = await tx.recommendationProfile.deleteMany(); // results and score breakdowns cascade
    return { recommendations: profiles.count, clicks: clicks.count };
  });
  res.locals.auditSummary = { clearedDashboardData: deleted };
  res.json({ deleted });
}));
