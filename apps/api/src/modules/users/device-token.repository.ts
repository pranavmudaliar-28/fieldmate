import type { PushPlatform } from '@fieldmate/shared';
import { eq, inArray } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { devicePushTokens, users } from '../../db/schema.js';

export function createDeviceTokenRepository(db: Database) {
  return {
    /**
     * Upserts on the token itself, so a shared device stops receiving pushes
     * for whoever used it before (docs/05 §2.8).
     */
    async register(userId: string, token: string, platform: PushPlatform): Promise<void> {
      await db
        .insert(devicePushTokens)
        .values({ userId, token, platform })
        .onConflictDoUpdate({
          target: devicePushTokens.token,
          set: { userId, platform, createdAt: new Date() },
        });
    },

    async listByUsers(userIds: string[]): Promise<{ userId: string; token: string }[]> {
      if (userIds.length === 0) return [];
      return db
        .select({ userId: devicePushTokens.userId, token: devicePushTokens.token })
        .from(devicePushTokens)
        .where(inArray(devicePushTokens.userId, userIds));
    },

    async deleteByTokens(tokens: string[]): Promise<void> {
      if (tokens.length === 0) return;
      await db.delete(devicePushTokens).where(inArray(devicePushTokens.token, tokens));
    },

    /** Recipients of the "task completed" push. */
    async listManagerIds(): Promise<string[]> {
      const rows = await db.select({ id: users.id }).from(users).where(eq(users.role, 'MANAGER'));
      return rows.map((row) => row.id);
    },
  };
}

export type DeviceTokenRepository = ReturnType<typeof createDeviceTokenRepository>;
