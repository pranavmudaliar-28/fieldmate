import {
  TASK_MANAGING_ROLES,
  changeEmailSchema,
  changePasswordSchema,
  confirmEmailSchema,
  inviteUserSchema,
  listUsersQuerySchema,
  registerPushTokenSchema,
  updateMeSchema,
  type ChangeEmailInput,
  type ChangePasswordInput,
  type ConfirmEmailInput,
  type InviteUserInput,
  type ListResponse,
  type RegisterPushTokenInput,
  type UpdateMeInput,
  type User,
  type UserSummary,
} from '@fieldmate/shared';
import { Router, type Request, type RequestHandler } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { loginRateLimiter } from '../../middleware/rate-limit.js';
import { requireRole } from '../../middleware/require-role.js';
import { validate, validated } from '../../middleware/validate.js';
import { AppError } from '../../utils/app-error.js';
import { createAdminUserService } from '../admin/admin-user.service.js';
import { createAuthServiceFor, type AuthDeps } from '../auth/auth.service.js';
import { createTaskRepository } from '../tasks/task.repository.js';
import { createDeviceTokenRepository } from './device-token.repository.js';

function currentUser(req: Request): User {
  if (!req.user) throw new AppError('UNAUTHENTICATED', 'Authentication is required.');
  return req.user;
}

export function createUsersRouter(deps: AuthDeps): Router {
  const repository = createTaskRepository(deps.db);
  const deviceTokens = createDeviceTokenRepository(deps.db);
  const account = createAuthServiceFor(deps);
  const userAdmin = createAdminUserService(deps);

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

  const updateMe: RequestHandler = async (req, res) => {
    res.json(await account.updateName(currentUser(req).id, validated<UpdateMeInput>(req).name));
  };

  const changePassword: RequestHandler = async (req, res) => {
    const { currentPassword, newPassword } = validated<ChangePasswordInput>(req);
    res.json(await account.changePassword(currentUser(req).id, currentPassword, newPassword));
  };

  const requestEmailChange: RequestHandler = async (req, res) => {
    const { newEmail, currentPassword } = validated<ChangeEmailInput>(req);
    await account.requestEmailChange(currentUser(req).id, newEmail, currentPassword);
    res.status(204).end();
  };

  const confirmEmailChange: RequestHandler = async (req, res) => {
    const { code } = validated<ConfirmEmailInput>(req);
    res.json(await account.confirmEmailChange(currentUser(req).id, code));
  };

  /** Managers invite field workers; admins may also use this (docs/07 §3). */
  const invite: RequestHandler = async (req, res) => {
    const { id, role } = currentUser(req);
    res.status(201).json(await userAdmin.invite({ id, role }, validated<InviteUserInput>(req)));
  };

  const router = Router();
  router.get('/me', authenticate(deps), me);
  router.patch('/me', authenticate(deps), validate(updateMeSchema), updateMe);
  // Rate-limited like login: both check the current password.
  router.post(
    '/me/password',
    authenticate(deps),
    loginRateLimiter(deps.config),
    validate(changePasswordSchema),
    changePassword,
  );
  router.post(
    '/me/email',
    authenticate(deps),
    loginRateLimiter(deps.config),
    validate(changeEmailSchema),
    requestEmailChange,
  );
  router.post(
    '/me/email/confirm',
    authenticate(deps),
    loginRateLimiter(deps.config),
    validate(confirmEmailSchema),
    confirmEmailChange,
  );
  router.post(
    '/invitations',
    authenticate(deps),
    requireRole(...TASK_MANAGING_ROLES),
    validate(inviteUserSchema),
    invite,
  );
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
