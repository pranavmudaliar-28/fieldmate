import type { MailService } from './mail.service.js';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 10_000;

/** Brevo's transactional email API (free tier: a verified sender, no domain needed). */
export function createBrevoMailService(deps: {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}): MailService {
  return {
    async send(message) {
      const response = await fetch(BREVO_URL, {
        method: 'POST',
        headers: {
          'api-key': deps.apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { email: deps.fromEmail, name: deps.fromName },
          to: [{ email: message.to }],
          subject: message.subject,
          textContent: message.text,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        // The body names the problem (unverified sender, bad key) but never the recipient's data.
        throw new Error(`Brevo responded ${response.status}: ${await response.text()}`);
      }
    },
  };
}
