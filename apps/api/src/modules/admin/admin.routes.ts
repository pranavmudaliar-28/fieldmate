import {
  createUserSchema,
  listManagedUsersQuerySchema,
  updateUserSchema,
  type CreateUserInput,
  type ListManagedUsersQuery,
  type UpdateUserInput,
} from '@fieldmate/shared';
import { Router, type Request, type RequestHandler } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/require-role.js';
import { validate, validated } from '../../middleware/validate.js';
import { AppError } from '../../utils/app-error.js';
import type { AuthDeps } from '../auth/auth.service.js';
import { createAdminUserService } from './admin-user.service.js';

const userParamsSchema = z.strictObject({ userId: z.uuid('User was not found.') });

function actorId(req: Request): string {
  if (!req.user) throw new AppError('UNAUTHENTICATED', 'Authentication is required.');
  return req.user.id;
}

const userId = (req: Request) => validated<{ userId: string }>(req, 'params').userId;

/** Admin-only user management (docs/07 §3). */
export function createAdminRouter(deps: AuthDeps): Router {
  const service = createAdminUserService(deps);

  const list: RequestHandler = async (req, res) => {
    res.json(await service.list(validated<ListManagedUsersQuery>(req, 'query')));
  };

  const get: RequestHandler = async (req, res) => {
    res.json(await service.get(userId(req)));
  };

  const create: RequestHandler = async (req, res) => {
    const inviter = { id: actorId(req), role: 'ADMIN' } as const;
    res.status(201).json(await service.invite(inviter, validated<CreateUserInput>(req)));
  };

  const update: RequestHandler = async (req, res) => {
    res.json(await service.update(actorId(req), userId(req), validated<UpdateUserInput>(req)));
  };

  const resendInvite: RequestHandler = async (req, res) => {
    await service.resendInvite(userId(req));
    res.status(204).end();
  };

  const sendPasswordReset: RequestHandler = async (req, res) => {
    await service.sendPasswordReset(userId(req));
    res.status(204).end();
  };

  const revokeSessions: RequestHandler = async (req, res) => {
    await service.revokeSessions(userId(req));
    res.status(204).end();
  };

  const remove: RequestHandler = async (req, res) => {
    await service.remove(actorId(req), userId(req));
    res.status(204).end();
  };

  const router = Router();
  const withUserId = validate(userParamsSchema, 'params');

  router.use(authenticate(deps), requireRole('ADMIN'));

  router.get('/users', validate(listManagedUsersQuerySchema, 'query'), list);
  router.post('/users', validate(createUserSchema), create);
  router.get('/users/:userId', withUserId, get);
  router.patch('/users/:userId', withUserId, validate(updateUserSchema), update);
  router.post('/users/:userId/invite', withUserId, resendInvite);
  router.post('/users/:userId/password-reset', withUserId, sendPasswordReset);
  router.post('/users/:userId/sessions/revoke', withUserId, revokeSessions);
  router.delete('/users/:userId', withUserId, remove);

  return router;
}
