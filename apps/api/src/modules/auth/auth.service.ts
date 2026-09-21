import type { LoginResponse, Role } from '@fieldmate/shared';
import type { AppConfig } from '../../config/env.js';
import { AppError } from '../../utils/app-error.js';
import { signAccessToken } from '../../utils/jwt.js';
import { verifyAgainstDummyHash, verifyPassword } from '../../utils/password.js';
import type { AuthRepository } from './auth.repository.js';

const invalidCredentials = () =>
  new AppError('INVALID_CREDENTIALS', 'Incorrect email or password.');

export function createAuthService(deps: { repository: AuthRepository; config: AppConfig }) {
  return {
    /** Same error and similar timing whether the email exists or the password is wrong. */
    async login(email: string, password: string): Promise<LoginResponse> {
      const user = await deps.repository.findByEmail(email);
      if (!user) {
        await verifyAgainstDummyHash(password);
        throw invalidCredentials();
      }

      const passwordMatches = await verifyPassword(user.passwordHash, password);
      if (!passwordMatches) throw invalidCredentials();

      // A deactivated account is refused with the same message, so the response
      // never reveals that the account exists (docs/07 §3).
      if (!user.isActive) throw invalidCredentials();

      const token = await signAccessToken(
        { userId: user.id, tokenVersion: user.tokenVersion },
        deps.config,
      );

      return {
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role as Role },
      };
    },

    async logout(userId: string): Promise<void> {
      await deps.repository.revokeSessions(userId);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
