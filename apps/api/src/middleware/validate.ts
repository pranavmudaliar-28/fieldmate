import { formatZodError } from '@fieldmate/shared';
import type { Request, RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../utils/app-error.js';

type Source = 'body' | 'query' | 'params';

/**
 * Validates one part of the request with a shared Zod schema.
 * Parsed values go to `req.validated` because `req.query` is read-only in Express 5.
 */
export function validate(schema: ZodType, source: Source = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(new AppError('VALIDATION_ERROR', formatZodError(result.error)));
      return;
    }
    req.validated = { ...req.validated, [source]: result.data };
    next();
  };
}

/** Reads a value stored by `validate`. */
export function validated<T>(req: Request, source: Source = 'body'): T {
  const value = req.validated?.[source];
  if (value === undefined) {
    throw new Error(
      `No validated ${source}: add the validate(${source}) middleware to this route.`,
    );
  }
  return value as T;
}
