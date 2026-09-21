import type { ListManagedUsersQuery, Role } from '@fieldmate/shared';
import { and, asc, count, eq, ilike, or, sql } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { taskAssignments, taskEvidence, taskNotes, tasks, users } from '../../db/schema.js';

export type ManagedUserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type UserCursor = { name: string; id: string };

const columns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  isActive: users.isActive,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

export function createAdminUserRepository(db: Database) {
  return {
    /** Listed alphabetically, paged with a keyset on (name, id). */
    async list(query: ListManagedUsersQuery, cursor?: UserCursor): Promise<ManagedUserRow[]> {
      const conditions = [];

      if (query.search) {
        const pattern = `%${query.search}%`;
        conditions.push(or(ilike(users.name, pattern), ilike(users.email, pattern)));
      }
      if (query.role) conditions.push(eq(users.role, query.role));
      if (query.isActive !== undefined) conditions.push(eq(users.isActive, query.isActive));
      if (cursor)
        conditions.push(sql`(${users.name}, ${users.id}) > (${cursor.name}, ${cursor.id})`);

      return db
        .select(columns)
        .from(users)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(users.name), asc(users.id))
        .limit(query.limit);
    },

    async findById(userId: string): Promise<ManagedUserRow | undefined> {
      const [user] = await db.select(columns).from(users).where(eq(users.id, userId)).limit(1);
      return user;
    },

    async findByEmail(email: string): Promise<{ id: string } | undefined> {
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      return user;
    },

    async create(input: {
      name: string;
      email: string;
      role: Role;
      passwordHash: string;
    }): Promise<ManagedUserRow> {
      const [user] = await db.insert(users).values(input).returning(columns);
      if (!user) throw new Error('Failed to create user');
      return user;
    },

    async update(
      userId: string,
      fields: Partial<{ name: string; email: string; role: Role; isActive: boolean }>,
    ): Promise<ManagedUserRow | undefined> {
      const [user] = await db
        .update(users)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning(columns);
      return user;
    },

    /** Also ends every session, so a new password or a lockout takes effect at once. */
    async setPassword(userId: string, passwordHash: string): Promise<void> {
      await db
        .update(users)
        .set({
          passwordHash,
          tokenVersion: sql`${users.tokenVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    },

    async delete(userId: string): Promise<void> {
      await db.delete(users).where(eq(users.id, userId));
    },

    /** How many active admins exist, used to keep at least one (docs/07 §2). */
    async countActiveAdmins(): Promise<number> {
      const [row] = await db
        .select({ value: count() })
        .from(users)
        .where(and(eq(users.role, 'ADMIN'), eq(users.isActive, true)));
      return row?.value ?? 0;
    },

    /**
     * True when the user appears anywhere in the task record, in which case the
     * account is deactivated rather than deleted.
     */
    async hasHistory(userId: string): Promise<boolean> {
      const result = await db.execute<{ exists: boolean }>(sql`
        SELECT EXISTS (
          SELECT 1 FROM ${tasks} WHERE ${tasks.createdBy} = ${userId}
          UNION ALL
          SELECT 1 FROM ${taskAssignments} WHERE ${taskAssignments.workerId} = ${userId}
          UNION ALL
          SELECT 1 FROM ${taskEvidence} WHERE ${taskEvidence.uploadedBy} = ${userId}
          UNION ALL
          SELECT 1 FROM ${taskNotes} WHERE ${taskNotes.createdBy} = ${userId}
        ) AS "exists"
      `);
      return Boolean(result.rows[0]?.exists);
    },
  };
}

export type AdminUserRepository = ReturnType<typeof createAdminUserRepository>;
