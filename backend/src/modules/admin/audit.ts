import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

const SENSITIVE = /password|token|secret|hash/i;

/** Compact, secret-free copy of a request body for the audit trail. */
function summarize(body: unknown): unknown {
  if (!body || typeof body !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (SENSITIVE.test(k)) out[k] = '[redacted]';
    else if (typeof v === 'string' && v.length > 300) out[k] = `[${v.length} chars]`;
    else out[k] = v;
  }
  const text = JSON.stringify(out);
  return text.length > 2000 ? { truncated: true, keys: Object.keys(out) } : out;
}

/**
 * Records every successful state-changing admin request (who, what, when). Handlers can attach extra context
 * with res.locals.auditSummary (for example the result of a CSV import).
 */
export function auditTrail(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  res.on('finish', () => {
    if (res.statusCode >= 400 || !req.admin) return;
    prisma.auditLog
      .create({
        data: {
          adminId: req.admin.sub,
          adminEmail: req.admin.email,
          method: req.method,
          path: req.baseUrl + req.path,
          status: res.statusCode,
          summary: (res.locals.auditSummary ?? summarize(req.body)) as object | undefined,
        },
      })
      .catch((err) => logger.error({ err }, 'Failed to write audit log'));
  });
  next();
}

const listQuery = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(50) });

export const auditRouter = Router();
auditRouter.get('/', requireRole('ADMIN'), validate(listQuery, 'query'), (req, res, next) => {
  const q = req.query as unknown as z.infer<typeof listQuery>;
  Promise.all([prisma.auditLog.count(), prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize })])
    .then(([total, rows]) => res.json({ data: rows, pagination: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) } }))
    .catch(next);
});
