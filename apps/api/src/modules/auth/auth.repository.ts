import type { Role } from '@fieldmate/shared';
import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { devicePushTokens, users } from '../../db/schema.js';

export type AuthUserRecord = {
  id: string;
  name: string;
  email: string;
  role: Role;
  passwordHash: string;
  isActive: boolean;
  tokenVersion: number;
  /** Null while an invitation is pending. */
  passwordSetAt: Date | null;
};

const columns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  passwordHash: users.passwordHash,
  isActive: users.isActive,
  tokenVersion: users.tokenVersion,
  passwordSetAt: users.passwordSetAt,
};

export function createAuthRepository(db: Database) {
  return {
    async findByEmail(email: string): Promise<AuthUserRecord | undefined> {
      const [user] = await db.select(columns).from(users).where(eq(users.email, email)).limit(1);
      return user;
    },

    async findById(userId: string): Promise<AuthUserRecord | undefined> {
      const [user] = await db.select(columns).from(users).where(eq(users.id, userId)).limit(1);
      return user;
    },

    /**
     * Ends every session for the user: bumps token_version (invalidating issued
     * JWTs) and removes their push tokens so no device keeps receiving pushes.
     */
    async revokeSessions(userId: string): Promise<number> {
      return db.transaction(async (tx) => {
        const [updated] = await tx
          .update(users)
          .set({ tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: new Date() })
          .where(eq(users.id, userId))
          .returning({ tokenVersion: users.tokenVersion });
        await tx.delete(devicePushTokens).where(eq(devicePushTokens.userId, userId));
        return updated?.tokenVersion ?? 0;
      });
    },

    /**
     * Stores a password the user chose and ends every existing session, the
     * same way `revokeSessions` does. Returns the new token version, so the
     * caller can hand this device a fresh token.
     */
    async setPassword(userId: string, passwordHash: string): Promise<number> {
      return db.transaction(async (tx) => {
        const now = new Date();
        const [updated] = await tx
          .update(users)
          .set({
            passwordHash,
            passwordSetAt: now,
            tokenVersion: sql`${users.tokenVersion} + 1`,
            updatedAt: now,
          })
          .where(eq(users.id, userId))
          .returning({ tokenVersion: users.tokenVersion });
        await tx.delete(devicePushTokens).where(eq(devicePushTokens.userId, userId));
        return updated?.tokenVersion ?? 0;
      });
    },

    async update(userId: string, fields: { name?: string; email?: string }): Promise<void> {
      await db
        .update(users)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(users.id, userId));
    },
  };
}

export type AuthRepository = ReturnType<typeof createAuthRepository>;
