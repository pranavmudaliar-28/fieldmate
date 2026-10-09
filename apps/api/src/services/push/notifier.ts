import type { Logger } from 'pino';
import type { NotificationRepository } from '../../modules/notifications/notification.repository.js';
import type { PushMessage, PushService } from './push.service.js';

/**
 * Tells a set of users that something happened, by push and in the inbox.
 *
 * Both, always. A push is best-effort — it is lost if the device is offline,
 * the token has expired, or the worker declined the permission — so the inbox
 * row is what makes the event durable, and writing one without the other would
 * put the two out of step (docs/02 F-009).
 *
 * Called after the transaction commits, like the push it replaces, so a failed
 * notification can never roll back the action that caused it. The cost is a
 * narrow window in which a committed action's inbox row is lost; it is logged
 * rather than retried, and the task list still shows the truth.
 */
export type Notifier = {
  notify(userIds: string[], taskId: string, message: PushMessage): void;
};

export function createNotifier(deps: {
  push: PushService;
  notifications: NotificationRepository;
  logger: Logger;
}): Notifier {
  const { push, notifications, logger } = deps;

  return {
    notify(userIds, taskId, message) {
      if (userIds.length === 0) return;

      void notifications
        .insertMany(
          userIds.map((userId) => ({
            userId,
            taskId,
            type: message.type,
            title: message.title,
            body: message.body,
          })),
        )
        .catch((error: unknown) =>
          logger.error({ err: error, type: message.type, taskId }, 'Failed to record notification'),
        );

      void push
        .send(userIds, message)
        .catch((error: unknown) =>
          logger.warn({ err: error, type: message.type }, 'Failed to send push notification'),
        );
    },
  };
}
