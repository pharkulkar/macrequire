import { NextFunction, Request, Response } from 'express';
import { ZodTypeAny } from 'zod';

type Target = 'body' | 'query' | 'params';

/** Validates a request part with Zod and replaces it with the parsed value. */
export const validate =
  (schema: ZodTypeAny, target: Target = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) return next(result.error);
    Object.defineProperty(req, target, { value: result.data, writable: true, configurable: true });
    next();
  };
