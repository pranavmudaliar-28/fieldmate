import {
  listUsersQuerySchema,
  type ListResponse,
  type User,
  type UserSummary,
} from '@fieldmate/shared';
import { Router, type RequestHandler } from 'express';
import type { AppConfig } from '../../config/env.js';
import type { Database } from '../../db/client.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/require-role.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../utils/app-error.js';
import { createTaskRepository } from '../tasks/task.repository.js';

export function createUsersRouter(deps: { db: Database; config: AppConfig }): Router {
  const repository = createTaskRepository(deps.db);

  const me: RequestHandler = (req, res) => {
    if (!req.user) throw new AppError('UNAUTHENTICATED', 'Authentication is required.');
    const user: User = {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    };
    res.json(user);
  };

  /** Worker picker for assignment (docs/05 §7.5). Small single organisation: no paging. */
  const listWorkers: RequestHandler = async (_req, res) => {
    const items: UserSummary[] = await repository.listFieldWorkers();
    const body: ListResponse<UserSummary> = { items };
    res.json(body);
  };

  const router = Router();
  router.get('/me', authenticate(deps), me);
  router.get(
    '/',
    authenticate(deps),
    requireRole('MANAGER'),
    validate(listUsersQuerySchema, 'query'),
    listWorkers,
  );
  return router;
}
