import type { Role } from '@fieldmate/shared';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from 'express';
import type { AppConfig } from '../config/env.js';
import type { Database } from '../db/client.js';
import { users } from '../db/schema.js';
import { AppError } from '../utils/app-error.js';
import { bearerToken, verifyAccessToken } from '../utils/jwt.js';

const unauthenticated = () =>
  new AppError('UNAUTHENTICATED', 'Authentication is required for this request.');

/**
 * Verifies the bearer token, then loads the user from the database.
 * The role and token version always come from the database, never from the token
 * (docs/05 §8), so revoked sessions and role changes take effect immediately.
 */
export function authenticate(deps: { db: Database; config: AppConfig }): RequestHandler {
  return async (req, _res, next) => {
    const token = bearerToken(req.header('authorization'));
    if (!token) return next(unauthenticated());

    const claims = await verifyAccessToken(token, deps.config);
    if (!claims) return next(unauthenticated());

    const [user] = await deps.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        tokenVersion: users.tokenVersion,
      })
      .from(users)
      .where(eq(users.id, claims.userId))
      .limit(1);

    // A deactivated account loses access immediately, mid-session (docs/07 §2).
    if (!user || !user.isActive || user.tokenVersion !== claims.tokenVersion) {
      return next(unauthenticated());
    }

    req.user = { id: user.id, name: user.name, email: user.email, role: user.role as Role };
    next();
  };
}
