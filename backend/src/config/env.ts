import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGIN: z.string().default('http://localhost:4200'),
  IP_HASH_SALT: z.string().default('dev-salt'),
  /**
   * How many reverse proxies sit between the internet and this API (Render's edge, a CDN such as Cloudflare, ...).
   * Express uses it to find the visitor's real IP, which the rate limits and click hashing depend on. Too low and
   * every visitor looks like the same address; too high and the address can be spoofed. Calibrate it after deploying
   * with GET /api/admin/diagnostics/network (see DEPLOY.md).
   */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).optional(),
  /** Where users are sent when an outbound link is unavailable. Defaults to the first CORS origin. */
  FRONTEND_URL: z.string().url().optional(),
});

/** Settings that are harmless on a laptop but unsafe on a real server. They are enforced when running in production. */
const strict = schema.superRefine((v, ctx) => {
  // Hosting platforms set these variables; a "development" server on one of them is almost certainly a mistake.
  if (process.env.RENDER && v.NODE_ENV !== 'production') {
    ctx.addIssue({ code: 'custom', path: ['NODE_ENV'], message: 'NODE_ENV must be "production" when deployed' });
  }
  if (v.NODE_ENV !== 'production') return;
  const fail = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
  if (/change-me|example|secret|password/i.test(v.JWT_SECRET)) fail('JWT_SECRET', 'Use a random secret, not a placeholder (node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))")');
  if (v.IP_HASH_SALT.length < 16 || /dev-salt|change-me/i.test(v.IP_HASH_SALT)) fail('IP_HASH_SALT', 'Set a random IP_HASH_SALT of at least 16 characters');
  if (v.TRUST_PROXY_HOPS === undefined) fail('TRUST_PROXY_HOPS', 'Set TRUST_PROXY_HOPS to the number of proxies in front of the API (see DEPLOY.md)');
  const origins = v.CORS_ORIGIN.split(',').map((o) => o.trim());
  if (origins.some((o) => !o.startsWith('https://'))) fail('CORS_ORIGIN', 'Every CORS_ORIGIN must be an https:// address in production');
  if (v.FRONTEND_URL && !v.FRONTEND_URL.startsWith('https://')) fail('FRONTEND_URL', 'FRONTEND_URL must be an https:// address in production');
});
const parsed = strict.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = { ...parsed.data, FRONTEND_URL: parsed.data.FRONTEND_URL ?? parsed.data.CORS_ORIGIN.split(',')[0] };
