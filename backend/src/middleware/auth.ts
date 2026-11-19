import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { AdminClaims, verifyAdminToken } from '../lib/tokens';


declare module 'express-serve-static-core' {
  interface Request {
    admin?: AdminClaims;
  }
}

/**
 * Requires a valid admin JWT AND an account that still exists and is active, so deactivating an admin
 * takes effect immediately rather than when their token expires. The role is read from the database,
 * not trusted from the token.
 */
export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Authentication required');
    let claims: AdminClaims;
    try {
      claims = verifyAdminToken(header.slice(7));
    } catch {
      throw new HttpError(401, 'Invalid or expired token');
    }
    const user = await prisma.adminUser.findUnique({ where: { id: claims.sub }, select: { id: true, email: true, role: true, isActive: true, tokenVersion: true } });
    // A changed password or a deactivation bumps tokenVersion, which ends sessions that were signed before it.
    if (!user || !user.isActive || (claims.ver ?? 0) !== user.tokenVersion) throw new HttpError(401, 'Invalid or expired token');
    req.admin = { sub: user.id, email: user.email, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

/** Use after requireAdmin. */
export const requireRole =
  (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction) =>
    req.admin && roles.includes(req.admin.role) ? next() : next(new HttpError(403, 'You do not have permission to do that'));
