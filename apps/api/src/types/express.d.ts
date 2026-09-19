import type { Role } from '@fieldmate/shared';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

declare global {
  namespace Express {
    interface Request {
      /** Set by the authenticate middleware; the role always comes from the database. */
      user?: AuthUser;
      /** Values parsed by the validate middleware (req.query is read-only in Express 5). */
      validated?: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
    }
  }
}
