import { loginSchema } from '@fieldmate/shared';
import { Router } from 'express';
import type { AppConfig } from '../../config/env.js';
import type { Database } from '../../db/client.js';
import { authenticate } from '../../middleware/authenticate.js';
import { loginRateLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { createAuthController } from './auth.controller.js';
import { createAuthRepository } from './auth.repository.js';
import { createAuthService } from './auth.service.js';

export function createAuthRouter(deps: { db: Database; config: AppConfig }): Router {
  const controller = createAuthController(
    createAuthService({ repository: createAuthRepository(deps.db), config: deps.config }),
  );

  const router = Router();
  router.post('/login', loginRateLimiter(deps.config), validate(loginSchema), controller.login);
  router.post('/logout', authenticate(deps), controller.logout);
  return router;
}
