import type { RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { AppConfig } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

/**
 * Slows password guessing: 10 attempts per 15 minutes per IP + email
 * (docs/05 §7.2). In-memory, so it applies per API instance.
 */
export function loginRateLimiter(config: AppConfig): RequestHandler {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: MAX_ATTEMPTS,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Tests would otherwise trip the limit across cases.
    skip: () => config.appEnv === 'test' && process.env.RATE_LIMIT_IN_TESTS !== 'true',
    keyGenerator: (req) => {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      return `${ipKeyGenerator(req.ip ?? '')}:${email}`;
    },
    handler: (_req, _res, next) => {
      next(new AppError('RATE_LIMITED', 'Too many login attempts. Try again later.'));
    },
  });
}
