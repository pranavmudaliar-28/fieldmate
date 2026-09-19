import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import type { Logger } from '../../config/logger.js';
import type { DeviceTokenRepository } from '../../modules/users/device-token.repository.js';
import type { PushMessage, PushService } from './push.service.js';

export function createExpoPushService(deps: {
  tokens: DeviceTokenRepository;
  logger: Logger;
  accessToken?: string | undefined;
}): PushService {
  const expo = new Expo(deps.accessToken ? { accessToken: deps.accessToken } : {});

  return {
    async send(userIds, message: PushMessage) {
      if (userIds.length === 0) return;

      const devices = await deps.tokens.listByUsers(userIds);
      const valid = devices.filter((device) => Expo.isExpoPushToken(device.token));
      if (valid.length === 0) return;

      const messages: ExpoPushMessage[] = valid.map((device) => ({
        to: device.token,
        title: message.title,
        body: message.body,
        data: { type: message.type, taskId: message.taskId },
        sound: 'default',
      }));

      const unregistered: string[] = [];

      for (const chunk of expo.chunkPushNotifications(messages)) {
        try {
          const tickets = await expo.sendPushNotificationsAsync(chunk);
          tickets.forEach((ticket, index) => {
            if (ticket.status !== 'error') return;
            const token = chunk[index]?.to;
            // The app was uninstalled or the token rotated: stop using it.
            if (ticket.details?.error === 'DeviceNotRegistered' && typeof token === 'string') {
              unregistered.push(token);
              return;
            }
            deps.logger.warn({ error: ticket.details?.error }, 'Push notification rejected');
          });
        } catch (error) {
          deps.logger.warn({ err: error }, 'Failed to send push notifications');
        }
      }

      if (unregistered.length > 0) {
        await deps.tokens
          .deleteByTokens(unregistered)
          .catch((error: unknown) =>
            deps.logger.warn({ err: error }, 'Failed to remove stale push tokens'),
          );
      }
    },
  };
}
