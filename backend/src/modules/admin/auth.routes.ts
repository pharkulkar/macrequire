import bcrypt from 'bcryptjs';
import { NextFunction, Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env';
import { signAdminToken } from '../../lib/tokens';
import { HttpError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { requireAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

const loginBody = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) }).strict();

// Brute-force protection: failed attempts count, successful logins do not.
const loginLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many login attempts. Try again in a few minutes.' } },
});

// Compared against when the email is unknown so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

export const adminAuthRouter = Router();

adminAuthRouter.post('/login', loginLimit, validate(loginBody), (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body as z.infer<typeof loginBody>;
  (async () => {
    const user = await prisma.adminUser.findUnique({ where: { email } });
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !user.isActive || !valid) throw new HttpError(401, 'Invalid email or password');

    await prisma.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const token = signAdminToken(user);
    res.json({ token, expiresIn: env.JWT_EXPIRES_IN, admin: { id: user.id, email: user.email, role: user.role } });
  })().catch(next);
});

adminAuthRouter.get('/me', requireAdmin, (req, res) => res.json({ admin: { id: req.admin!.sub, email: req.admin!.email, role: req.admin!.role } }));
