import type { Logger } from '../../config/logger.js';
import type { MailMessage, MailService } from './mail.service.js';

export type FakeMailService = MailService & {
  sent: MailMessage[];
  reset(): void;
  /** Makes the next send fail, to prove how each flow handles an email outage. */
  failNext(): void;
  /** The 6-digit code in the last email sent to `to`. */
  lastCode(to: string): string | undefined;
};

/**
 * Test double, and the development fallback when no Brevo key is set: with a
 * logger it prints each email, so a local invite can be finished from the log.
 */
export function createFakeMailService(logger?: Logger): FakeMailService {
  const sent: MailMessage[] = [];
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
    lastCode(to) {
      const message = sent.findLast((mail) => mail.to === to);
      return message?.text.match(/\b\d{6}\b/)?.[0];
    },
    async send(message) {
      if (shouldFail) {
        shouldFail = false;
        throw new Error('Mail service unavailable');
      }
      sent.push(message);
      logger?.info({ mail: message }, 'Email not sent (no BREVO_API_KEY); contents logged instead');
    },
  };
}
