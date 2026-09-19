import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiErrorBody, ErrorCode } from '@fieldmate/shared';
import type { Logger } from '../config/logger.js';
import { AppError } from '../utils/app-error.js';

function body(code: ErrorCode, message: string): ApiErrorBody {
  return { error: { code, message } };
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json(body('NOT_FOUND', 'Resource was not found.'));
};

type BodyParserError = Error & { type?: string; status?: number };

/**
 * Converts every error into the standard `{ error: { code, message } }` shape.
 * Unexpected errors are logged in full and returned as a generic 500.
 */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    if (err instanceof AppError) {
      res.status(err.status).json(body(err.code, err.message));
      return;
    }

    const parserError = err as BodyParserError;
    if (parserError?.type === 'entity.parse.failed') {
      res.status(400).json(body('INVALID_REQUEST', 'Request body is not valid JSON.'));
      return;
    }
    if (parserError?.type === 'entity.too.large') {
      res.status(400).json(body('INVALID_REQUEST', 'Request body is too large.'));
      return;
    }

    (req.log ?? logger).error({ err }, 'Unhandled error');
    res.status(500).json(body('INTERNAL_ERROR', 'Something went wrong.'));
  };
}
