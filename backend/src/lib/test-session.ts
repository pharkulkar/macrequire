import jwt from 'jsonwebtoken';
import { Request } from 'express';
import { env } from '../config/env';

/**
 * A test session lets an administrator walk through the public site and have everything they do tagged as test data
 * (recommendations and outbound clicks), so it never reaches the analytics and can be deleted afterwards.
 *
 * The browser carries a signed token. It is signed with a key derived from the server secret that differs from the
 * admin sign-in key, so it cannot be used as an admin token, and nobody without one can tag data as test (which
 * would hide real visitors from the analytics).
 */
const KEY = () => `${env.JWT_SECRET}:test-session`;
export const TEST_SESSION_HOURS = 12;
export const TEST_HEADER = 'x-test-session';

export function signTestSession(adminId: string): { token: string; expiresAt: string } {
  const token = jwt.sign({ typ: 'test', by: adminId }, KEY(), { algorithm: 'HS256', expiresIn: `${TEST_SESSION_HOURS}h` });
  return { token, expiresAt: new Date(Date.now() + TEST_SESSION_HOURS * 3_600_000).toISOString() };
}

export function isValidTestSession(token: unknown): boolean {
  if (typeof token !== 'string' || token.length < 20 || token.length > 600) return false;
  try {
    const claims = jwt.verify(token, KEY(), { algorithms: ['HS256'] }) as { typ?: string };
    return claims.typ === 'test';
  } catch {
    return false;
  }
}

/** True when the request carries a valid test-session token in the header (API calls) or the `test` query value (links). */
export const isTestRequest = (req: Request): boolean => isValidTestSession(req.get(TEST_HEADER) ?? (req.query?.test as string | undefined));
