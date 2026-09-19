import type { AppConfig } from '../../src/config/env.js';
import { createLogger } from '../../src/config/logger.js';

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    appEnv: 'test',
    port: 0,
    logLevel: 'silent',
    databaseUrl: 'postgres://fieldmate:fieldmate@localhost:5432/fieldmate_test',
    authSecret: 'test-secret-that-is-at-least-32-characters-long',
    corsOrigins: [],
    storage: {
      endpoint: 'http://localhost:9000',
      region: 'us-east-1',
      bucket: 'fieldmate-test',
      accessKeyId: 'test',
      secretAccessKey: 'test',
      forcePathStyle: true,
    },
    push: { expoAccessToken: undefined },
    ...overrides,
  };
}

export const silentLogger = createLogger('silent');
