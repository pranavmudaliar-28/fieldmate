import { forgotPasswordSchema, loginSchema, setPasswordWithCodeSchema } from '@fieldmate/shared';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { loginRateLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { createAuthController } from './auth.controller.js';
import { createAuthServiceFor, type AuthDeps } from './auth.service.js';

export function createAuthRouter(deps: AuthDeps): Router {
  const controller = createAuthController(createAuthServiceFor(deps));

  const router = Router();
  router.post('/login', loginRateLimiter(deps.config), validate(loginSchema), controller.login);
  router.post('/logout', authenticate(deps), controller.logout);
  // Each has its own limiter, keyed on IP + email like login: guessing a
  // code is as limited as guessing a password.
  router.post(
    '/password/forgot',
    loginRateLimiter(deps.config),
    validate(forgotPasswordSchema),
    controller.forgotPassword,
  );
  router.post(
    '/password/set',
    loginRateLimiter(deps.config),
    validate(setPasswordWithCodeSchema),
    controller.setPassword,
  );
  return router;
}
