import type { Role } from '@fieldmate/shared';
import type { RequestHandler } from 'express';
import { AppError } from '../utils/app-error.js';

/** Route-level RBAC (docs/05 §7.20). Must run after authenticate. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new AppError('UNAUTHENTICATED', 'Authentication is required for this request.'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError('FORBIDDEN', 'You do not have permission to perform this action.'));
      return;
    }
    next();
  };
}
