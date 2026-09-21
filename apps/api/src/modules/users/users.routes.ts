import {
  TASK_MANAGING_ROLES,
  listUsersQuerySchema,
  registerPushTokenSchema,
  type ListResponse,
  type RegisterPushTokenInput,
  type User,
  type UserSummary,
} from '@fieldmate/shared';
import { Router, type RequestHandler } from 'express';
import type { AppConfig } from '../../config/env.js';
import type { Database } from '../../db/client.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/require-role.js';
import { validate, validated } from '../../middleware/validate.js';
import { AppError } from '../../utils/app-error.js';
import { createTaskRepository } from '../tasks/task.repository.js';
import { createDeviceTokenRepository } from './device-token.repository.js';

export function createUsersRouter(deps: { db: Database; config: AppConfig }): Router {
  const repository = createTaskRepository(deps.db);
  const deviceTokens = createDeviceTokenRepository(deps.db);

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

  /** Registers this device for push notifications (docs/05 §7.6). */
  const registerPushToken: RequestHandler = async (req, res) => {
    if (!req.user) throw new AppError('UNAUTHENTICATED', 'Authentication is required.');
    const { token, platform } = validated<RegisterPushTokenInput>(req);
    await deviceTokens.register(req.user.id, token, platform);
    res.status(204).end();
  };

  const router = Router();
  router.get('/me', authenticate(deps), me);
  router.post(
    '/me/push-tokens',
    authenticate(deps),
    validate(registerPushTokenSchema),
    registerPushToken,
  );
  router.get(
    '/',
    authenticate(deps),
    requireRole(...TASK_MANAGING_ROLES),
    validate(listUsersQuerySchema, 'query'),
    listWorkers,
  );
  return router;
}
