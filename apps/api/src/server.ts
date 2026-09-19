import { createApp } from './app.js';
import { ConfigError, loadConfig } from './config/env.js';
import { createLogger } from './config/logger.js';
import { createDb } from './db/client.js';
import { createDeviceTokenRepository } from './modules/users/device-token.repository.js';
import { createExpoPushService } from './services/push/expo-push.service.js';
import { createS3StorageService } from './services/storage/s3-storage.service.js';

function main(): void {
  let config;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  const logger = createLogger(config.logLevel);
  const { db, close: closeDb } = createDb(config.databaseUrl);
  const storage = createS3StorageService(config);
  const push = createExpoPushService({
    tokens: createDeviceTokenRepository(db),
    logger,
    accessToken: config.push.expoAccessToken,
  });
  const app = createApp({ config, logger, db, storage, push });

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, appEnv: config.appEnv }, 'FieldMate API listening');
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close(async (err) => {
      await closeDb().catch((dbErr: unknown) => logger.error({ err: dbErr }, 'Error closing pool'));
      if (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
