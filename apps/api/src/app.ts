import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { AppConfig } from './config/env.js';
import type { Logger } from './config/logger.js';
import type { Database } from './db/client.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createAdminRouter } from './modules/admin/admin.routes.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createTaskRouter } from './modules/tasks/task.routes.js';
import { createUsersRouter } from './modules/users/users.routes.js';
import type { PushService } from './services/push/push.service.js';
import type { StorageService } from './services/storage/storage.service.js';

export type AppDeps = {
  config: AppConfig;
  logger: Logger;
  db: Database;
  storage: StorageService;
  push: PushService;
};

export function createApp({ config, logger, db, storage, push }: AppDeps): Express {
  const app = express();

  app.disable('x-powered-by');
  if (config.appEnv === 'staging' || config.appEnv === 'production') {
    // HTTPS is terminated by the host's proxy.
    app.set('trust proxy', 1);
  }

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url === '/health' },
    }),
  );
  app.use(helmet());
  // Native apps send no Origin header; browsers are only allowed from the configured list.
  app.use(cors({ origin: config.corsOrigins.length > 0 ? config.corsOrigins : false }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const api = express.Router();
  api.use('/auth', createAuthRouter({ db, config }));
  api.use('/users', createUsersRouter({ db, config }));
  api.use('/admin', createAdminRouter({ db, config }));
  api.use('/tasks', createTaskRouter({ db, config, storage, logger, push }));
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler(logger));

  return app;
}
