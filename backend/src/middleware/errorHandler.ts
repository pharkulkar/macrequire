import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/errors';
import { logger } from '../lib/logger';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { message: 'That address does not exist.' } });
}

// Centralized error handler. Must keep the 4-argument signature.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: { message: 'Some values are not valid. See the details below.', details: err.flatten() } });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { message: err.message, details: err.details } });
  }
  // Errors raised by the body parser (too large, malformed JSON) carry a 4xx status; they are the sender's mistake.
  const status = (err as { status?: number; statusCode?: number })?.status ?? (err as { statusCode?: number })?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    const message = status === 413 ? 'The request is too large' : status === 400 ? 'The request body could not be read' : 'The request could not be processed';
    return res.status(status).json({ error: { message } });
  }
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: { message: 'Something went wrong on our side. Please try again in a few minutes.' } });
}
