import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Number of proxies in front of the API; see config/env.ts. Defaults to 1 only for local development.
  app.set('trust proxy', env.TRUST_PROXY_HOPS ?? 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  const allowedOrigins = env.CORS_ORIGIN.split(',');
  // In development, pages opened from another device on the local network (http://192.168.x.x:4200) are allowed too.
  const localNetwork = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|[a-z0-9-]+\.local)(:\d+)?$/i;
  app.use(
    cors({
      origin: (origin, done) => done(null, !origin || allowedOrigins.includes(origin) || (env.NODE_ENV === 'development' && localNetwork.test(origin))),
      credentials: true,
    }),
  );
  // Ordinary requests are small. CSV imports are larger, but that parser lives in the imports router, after sign-in,
  // so nobody can make the server read megabytes without being an administrator.
  const smallJson = express.json({ limit: '100kb' });
  app.use((req, res, next) => (req.path.startsWith('/api/admin/imports') ? next() : smallJson(req, res, next)));
  if (env.NODE_ENV !== 'test') app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));
  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
