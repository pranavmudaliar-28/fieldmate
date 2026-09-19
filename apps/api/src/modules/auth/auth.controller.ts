import type { LoginInput } from '@fieldmate/shared';
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

  return { login, logout };
}
