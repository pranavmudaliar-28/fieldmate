import type { PushMessage, PushService } from './push.service.js';

export type SentPush = { userIds: string[]; message: PushMessage };

export type FakePushService = PushService & {
  sent: SentPush[];
  reset(): void;
  /** Makes the next send fail, to prove a push failure never fails the action. */
  failNext(): void;
};

/** Test double for the Expo push service. */
export function createFakePushService(): FakePushService {
  const sent: SentPush[] = [];
  let shouldFail = false;

  return {
    sent,
    reset() {
      sent.length = 0;
      shouldFail = false;
    },
    failNext() {
      shouldFail = true;
    },
    async send(userIds, message) {
      if (shouldFail) {
        shouldFail = false;
        throw new Error('Push service unavailable');
      }
      sent.push({ userIds, message });
    },
  };
}
