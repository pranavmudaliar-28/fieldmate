import type { LoginResponse, Role, User } from '@fieldmate/shared';
import type { AppConfig } from '../../config/env.js';
import type { Logger } from '../../config/logger.js';
import type { Database } from '../../db/client.js';
import type { MailService } from '../../services/mail/mail.service.js';
import { AppError } from '../../utils/app-error.js';
import { signAccessToken } from '../../utils/jwt.js';
import { hashPassword, verifyAgainstDummyHash, verifyPassword } from '../../utils/password.js';
import {
  createAuthRepository,
  type AuthRepository,
  type AuthUserRecord,
} from './auth.repository.js';
import { createUserCodeService, invalidCode, type UserCodeService } from './user-code.service.js';

const invalidCredentials = () =>
  new AppError('INVALID_CREDENTIALS', 'Incorrect email or password.');

const wrongCurrentPassword = () =>
  new AppError('INVALID_CREDENTIALS', 'Your current password is not correct.');

const toUser = (user: AuthUserRecord): User => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role as Role,
});

export function createAuthService(deps: {
  repository: AuthRepository;
  codes: UserCodeService;
  config: AppConfig;
  logger: Logger;
}) {
  const { repository, codes } = deps;

  async function signedIn(user: AuthUserRecord, tokenVersion: number): Promise<LoginResponse> {
    const token = await signAccessToken({ userId: user.id, tokenVersion }, deps.config);
    return { token, user: toUser(user) };
  }

  /** The signed-in user's own record, with the hash needed to check their password. */
  async function self(userId: string): Promise<AuthUserRecord> {
    const user = await repository.findById(userId);
    if (!user || !user.isActive)
      throw new AppError('UNAUTHENTICATED', 'Authentication is required.');
    return user;
  }

  return {
    /** Same error and similar timing whether the email exists or the password is wrong. */
    async login(email: string, password: string): Promise<LoginResponse> {
      const user = await repository.findByEmail(email);
      if (!user) {
        await verifyAgainstDummyHash(password);
        throw invalidCredentials();
      }

      const passwordMatches = await verifyPassword(user.passwordHash, password);
      if (!passwordMatches) throw invalidCredentials();

      // A deactivated account, or an invitation not yet accepted, is refused
      // with the same message, so the response never reveals that the account
      // exists (docs/07 §3).
      if (!user.isActive || !user.passwordSetAt) throw invalidCredentials();

      return signedIn(user, user.tokenVersion);
    },

    async logout(userId: string): Promise<void> {
      await repository.revokeSessions(userId);
    },

    /**
     * Emails a reset code if the address belongs to an active account. Says
     * nothing either way, so it cannot be used to discover who has an account;
     * a pending invitation gets its invite code sent again instead.
     */
    async forgotPassword(email: string): Promise<void> {
      const user = await repository.findByEmail(email);
      if (!user || !user.isActive) return;
      try {
        if (user.passwordSetAt) await codes.sendPasswordReset(user);
        else await codes.sendInvite(user);
      } catch (error) {
        // Already logged by the code service; the reply must not differ.
        deps.logger.warn({ err: error }, 'Password reset email was not sent');
      }
    },

    /** Finishes an invitation or a reset: the code proves the user owns the email. */
    async setPasswordWithCode(
      email: string,
      code: string,
      password: string,
    ): Promise<LoginResponse> {
      const user = await repository.findByEmail(email);
      if (!user || !user.isActive) throw invalidCode();
      await codes.consume(user.id, ['INVITE', 'PASSWORD_RESET'], code);

      const tokenVersion = await repository.setPassword(user.id, await hashPassword(password));
      return signedIn(user, tokenVersion);
    },

    async updateName(userId: string, name: string): Promise<User> {
      const user = await self(userId);
      await repository.update(userId, { name: name.trim() });
      return { ...toUser(user), name: name.trim() };
    },

    /** Signs out every other device; this one gets a fresh token. */
    async changePassword(
      userId: string,
      currentPassword: string,
      newPassword: string,
    ): Promise<LoginResponse> {
      const user = await self(userId);
      if (!(await verifyPassword(user.passwordHash, currentPassword))) throw wrongCurrentPassword();

      const tokenVersion = await repository.setPassword(userId, await hashPassword(newPassword));
      return signedIn(user, tokenVersion);
    },

    /** The new address only replaces the old one once its emailed code is entered. */
    async requestEmailChange(
      userId: string,
      newEmail: string,
      currentPassword: string,
    ): Promise<void> {
      const user = await self(userId);
      if (!(await verifyPassword(user.passwordHash, currentPassword))) throw wrongCurrentPassword();
      if (newEmail === user.email) {
        throw new AppError('VALIDATION_ERROR', 'That is already your email address.');
      }
      if (await repository.findByEmail(newEmail)) {
        throw new AppError('EMAIL_TAKEN', 'Another account already uses that email address.');
      }
      await codes.sendEmailChange(user, newEmail);
    },

    async confirmEmailChange(userId: string, code: string): Promise<User> {
      const user = await self(userId);
      const { newEmail } = await codes.consume(userId, ['EMAIL_CHANGE'], code);
      if (!newEmail) throw invalidCode();

      try {
        await repository.update(userId, { email: newEmail });
      } catch (error) {
        // Someone else took the address between the request and the confirmation:
        // Postgres reports unique_violation (23505), which Drizzle wraps in `cause`.
        if ((error as { cause?: { code?: string } }).cause?.code === '23505') {
          throw new AppError('EMAIL_TAKEN', 'Another account already uses that email address.');
        }
        throw error;
      }
      return { ...toUser(user), email: newEmail };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;

export type AuthDeps = { db: Database; config: AppConfig; mail: MailService; logger: Logger };

/** Wires the service to its repository and code store; shared by /auth and /users/me. */
export function createAuthServiceFor(deps: AuthDeps): AuthService {
  return createAuthService({
    repository: createAuthRepository(deps.db),
    codes: createUserCodeService(deps),
    config: deps.config,
    logger: deps.logger,
  });
}
