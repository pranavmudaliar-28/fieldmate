import type { Express } from 'express';
import type { AppConfig } from '../../src/config/env.js';
import { createApp } from '../../src/app.js';
import { createFakePushService } from '../../src/services/push/fake-push.service.js';
import { createInMemoryStorageService } from '../../src/services/storage/in-memory-storage.service.js';
import { silentLogger, testConfig } from './config.js';
import { testDb } from './db.js';

export const testStorage = createInMemoryStorageService();
export const testPush = createFakePushService();

export function createTestApp(overrides: Partial<AppConfig> = {}): Express {
  return createApp({
    config: testConfig(overrides),
    logger: silentLogger,
    db: testDb(),
    storage: testStorage,
    push: testPush,
  });
}
