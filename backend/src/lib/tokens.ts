import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

/** The signing algorithm is fixed on both sides, so a token can never choose its own (for example "none"). */
const ALGORITHM = 'HS256' as const;

export interface AdminClaims {
  sub: string;
  email: string;
  role: string;
  /** AdminUser.tokenVersion at sign-in; a password change or deactivation bumps it and ends the session. */
  ver?: number;
}

export function signAdminToken(user: { id: string; email: string; role: string; tokenVersion: number }): string {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role, ver: user.tokenVersion }, env.JWT_SECRET, { algorithm: ALGORITHM, expiresIn: env.JWT_EXPIRES_IN } as SignOptions);
}

export function verifyAdminToken(token: string): AdminClaims {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITHM] }) as AdminClaims;
}
