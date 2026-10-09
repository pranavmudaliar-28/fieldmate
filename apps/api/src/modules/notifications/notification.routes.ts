import {
  listNotificationsQuerySchema,
  type ListNotificationsQuery,
  type Notification,
  type Paginated,
  type UnreadCount,
} from '@fieldmate/shared';
import { Router, type Request, type RequestHandler } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../../config/env.js';
import type { Database } from '../../db/client.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate, validated } from '../../middleware/validate.js';
import { AppError } from '../../utils/app-error.js';
import { decodeCursor, encodeCursor } from '../../utils/cursor.js';
import { createNotificationRepository, type NotificationRow } from './notification.repository.js';

const paramsSchema = z.strictObject({ notificationId: z.uuid('Notification was not found.') });

function actorId(req: Request): string {
  if (!req.user) throw new AppError('UNAUTHENTICATED', 'Authentication is required.');
  return req.user.id;
}

function toDto(row: NotificationRow): Notification {
  return {
    id: row.id,
    type: row.type,
    taskId: row.taskId,
    title: row.title,
    body: row.body,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** The in-app inbox (docs/02 F-009). Every route is scoped to the caller. */
export function createNotificationRouter(deps: { db: Database; config: AppConfig }): Router {
  const repository = createNotificationRepository(deps.db);

  const list: RequestHandler = async (req, res) => {
    const { limit, cursor } = validated<ListNotificationsQuery>(req, 'query');
    // One extra row answers "is there another page" without a second count.
    const rows = await repository.list(
      actorId(req),
      limit + 1,
      cursor ? decodeCursor(cursor) : undefined,
    );

    const items = rows.slice(0, limit);
    const last = items.at(-1);
    const body: Paginated<Notification> = {
      items: items.map(toDto),
      nextCursor:
        rows.length > limit && last
          ? encodeCursor({ updatedAt: last.createdAt, id: last.id })
          : null,
    };
    res.json(body);
  };

  const unreadCount: RequestHandler = async (req, res) => {
    const body: UnreadCount = { unread: await repository.countUnread(actorId(req)) };
    res.json(body);
  };

  const markRead: RequestHandler = async (req, res) => {
    const { notificationId } = validated<{ notificationId: string }>(req, 'params');
    const found = await repository.markRead(actorId(req), notificationId);
    // Someone else's row is reported as missing, never as forbidden, so the
    // inbox cannot be used to probe for other people's notifications.
    if (!found) throw new AppError('NOT_FOUND', 'Notification was not found.');
    res.status(204).end();
  };

  const markAllRead: RequestHandler = async (req, res) => {
    await repository.markAllRead(actorId(req));
    res.status(204).end();
  };

  const router = Router();
  router.use(authenticate(deps));
  router.get('/', validate(listNotificationsQuerySchema, 'query'), list);
  router.get('/unread-count', unreadCount);
  router.post('/read-all', markAllRead);
  router.post('/:notificationId/read', validate(paramsSchema, 'params'), markRead);
  return router;
}
