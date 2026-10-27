import type { ForgotPasswordInput, LoginInput, SetPasswordWithCodeInput } from '@fieldmate/shared';
import type { RequestHandler } from 'express';
import { validated } from '../../middleware/validate.js';
import { AppError } from '../../utils/app-error.js';
import type { AuthService } from './auth.service.js';

export function createAuthController(service: AuthService) {
  const login: RequestHandler = async (req, res) => {
    const { email, password } = validated<LoginInput>(req);
    res.json(await service.login(email, password));
  };

  const logout: RequestHandler = async (req, res) => {
    if (!req.user) throw new AppError('UNAUTHENTICATED', 'Authentication is required.');
    await service.logout(req.user.id);
    res.status(204).end();
  };

  const forgotPassword: RequestHandler = async (req, res) => {
    await service.forgotPassword(validated<ForgotPasswordInput>(req).email);
    res.status(204).end();
  };

  const setPassword: RequestHandler = async (req, res) => {
    const { email, code, password } = validated<SetPasswordWithCodeInput>(req);
    res.json(await service.setPasswordWithCode(email, code, password));
  };

  return { login, logout, forgotPassword, setPassword };
}
