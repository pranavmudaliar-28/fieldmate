import { and, desc, eq, isNull, lt, or, sql, count } from 'drizzle-orm';
import type { NotificationType } from '@fieldmate/shared';
import type { Database } from '../../db/client.js';
import { notifications } from '../../db/schema.js';
import type { TaskCursor } from '../../utils/cursor.js';

export type NotificationRow = {
  id: string;
  type: NotificationType;
  taskId: string;
  title: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
};

export type NewNotification = {
  userId: string;
  taskId: string;
  type: NotificationType;
  title: string;
  body: string;
};

export function createNotificationRepository(db: Database) {
  return {
    /** One row per recipient, in a single statement. */
    async insertMany(rows: NewNotification[]): Promise<void> {
      if (rows.length === 0) return;
      await db.insert(notifications).values(rows);
    },

    /**
     * Newest first, paged by the same keyset shape tasks use so the cursor
     * utility is shared. `createdAt` stands in for `updatedAt`: a notification
     * is never edited, so the two are the same thing here.
     */
    async list(userId: string, limit: number, cursor?: TaskCursor): Promise<NotificationRow[]> {
      const olderThanCursor = cursor
        ? or(
            lt(notifications.createdAt, cursor.updatedAt),
            and(eq(notifications.createdAt, cursor.updatedAt), lt(notifications.id, cursor.id)),
          )
        : undefined;

      return db
        .select({
          id: notifications.id,
          type: notifications.type,
          taskId: notifications.taskId,
          title: notifications.title,
          body: notifications.body,
          readAt: notifications.readAt,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), olderThanCursor))
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(limit);
    },

    async countUnread(userId: string): Promise<number> {
      const [row] = await db
        .select({ value: count() })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
      return row?.value ?? 0;
    },

    /**
     * Scoped to the owner, so one user can never mark another's row read — and
     * a row belonging to someone else is indistinguishable from one that does
     * not exist.
     */
    async markRead(userId: string, id: string): Promise<boolean> {
      const updated = await db
        .update(notifications)
        .set({ readAt: sql`now()` })
        .where(
          and(
            eq(notifications.id, id),
            eq(notifications.userId, userId),
            isNull(notifications.readAt),
          ),
        )
        .returning({ id: notifications.id });

      if (updated.length > 0) return true;

      // Already read is success, not a miss: the caller wanted it read.
      const [existing] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
        .limit(1);
      return existing !== undefined;
    },

    async markAllRead(userId: string): Promise<void> {
      await db
        .update(notifications)
        .set({ readAt: sql`now()` })
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    },
  };
}

export type NotificationRepository = ReturnType<typeof createNotificationRepository>;
