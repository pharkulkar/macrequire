import bcrypt from 'bcryptjs';
import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { HttpError, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { requireRole } from '../../middleware/auth';
import { signAdminToken } from '../../lib/tokens';
import { validate } from '../../middleware/validate';

const password = z.string().min(12, 'Use at least 12 characters').max(200);
const create = z.object({ email: z.string().trim().toLowerCase().email().max(200), password, role: z.enum(['ADMIN', 'EDITOR']).default('EDITOR') }).strict();
const update = z.object({ role: z.enum(['ADMIN', 'EDITOR']), isActive: z.boolean(), password }).partial().strict().refine((b) => Object.keys(b).length > 0, 'Provide at least one field');
const changeOwn = z.object({ currentPassword: z.string().min(1).max(200), newPassword: password }).strict();
const idParam = z.object({ id: z.string().trim().min(1).max(60) });

const publicUser = (u: { id: string; email: string; role: string; isActive: boolean; createdAt: Date; lastLoginAt: Date | null }) => ({
  id: u.id, email: u.email, role: u.role, isActive: u.isActive, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt,
});

const h = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const usersRouter = Router();

// Changing your own password is open to every signed-in admin.
usersRouter.post('/me/password', validate(changeOwn), h(async (req, res) => {
  const { currentPassword, newPassword } = req.body as z.infer<typeof changeOwn>;
  const user = await prisma.adminUser.findUniqueOrThrow({ where: { id: req.admin!.sub } });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw new HttpError(400, 'Current password is incorrect');
  // Changing the password ends every other session; this one continues with a fresh token.
  const updated = await prisma.adminUser.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 12), tokenVersion: { increment: 1 } } });
  res.json({ ok: true, token: signAdminToken(updated) });
}));

usersRouter.use(requireRole('ADMIN'));

usersRouter.get('/', h(async (_req, res) => {
  const rows = await prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
  res.json({ data: rows.map(publicUser) });
}));

usersRouter.post('/', validate(create), h(async (req, res) => {
  const b = req.body as z.infer<typeof create>;
  if (await prisma.adminUser.findUnique({ where: { email: b.email } })) throw new HttpError(409, 'An admin with that email already exists');
  const u = await prisma.adminUser.create({ data: { email: b.email, role: b.role, passwordHash: await bcrypt.hash(b.password, 12) } });
  res.status(201).json(publicUser(u));
}));

usersRouter.patch('/:id', validate(idParam, 'params'), validate(update), h(async (req, res) => {
  const b = req.body as z.infer<typeof update>;
  const target = await prisma.adminUser.findUnique({ where: { id: req.params.id } });
  if (!target) throw notFound('Admin user');
  // Never lock everyone out: you cannot demote or deactivate yourself, and one active ADMIN must remain.
  const losesAdmin = (b.role && b.role !== 'ADMIN') || b.isActive === false;
  if (losesAdmin && target.role === 'ADMIN') {
    if (target.id === req.admin!.sub) throw new HttpError(400, 'You cannot demote or deactivate your own account');
    const others = await prisma.adminUser.count({ where: { role: 'ADMIN', isActive: true, id: { not: target.id } } });
    if (others === 0) throw new HttpError(400, 'At least one active ADMIN must remain');
  }
  const { password: pw, ...rest } = b;
  const u = await prisma.adminUser.update({ where: { id: target.id }, data: { ...rest, ...(pw || b.isActive === false ? { tokenVersion: { increment: 1 } } : {}), ...(pw ? { passwordHash: await bcrypt.hash(pw, 12) } : {}) } });
  res.json(publicUser(u));
}));
