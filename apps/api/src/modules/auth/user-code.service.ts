import { and, eq, inArray, sql } from 'drizzle-orm';
import type { AppConfig } from '../../config/env.js';
import type { Logger } from '../../config/logger.js';
import type { Database } from '../../db/client.js';
import { userCodes } from '../../db/schema.js';
import {
  mailMessages,
  type MailMessage,
  type MailService,
} from '../../services/mail/mail.service.js';
import { AppError } from '../../utils/app-error.js';
import { codeMatches, generateCode, hashCode } from '../../utils/user-code.js';

export type CodePurpose = (typeof userCodes.purpose.enumValues)[number];

/** How long each kind of code works (docs/07 §3). */
export const CODE_LIFETIME_MINUTES: Record<CodePurpose, number> = {
  INVITE: 7 * 24 * 60,
  PASSWORD_RESET: 30,
  EMAIL_CHANGE: 30,
};

/** The fifth wrong guess burns the code: a million combinations, five tries. */
const MAX_ATTEMPTS = 5;

/** One message for wrong, expired and used codes, so none of them can be told apart. */
export const invalidCode = () =>
  new AppError(
    'INVALID_CODE',
    'That code is not valid. Check the latest email, or ask for a new code.',
  );

type Recipient = { id: string; name: string; email: string };

/** One-time codes sent by email: issued, mailed, and consumed exactly once. */
export function createUserCodeService(deps: {
  db: Database;
  config: AppConfig;
  mail: MailService;
  logger: Logger;
}) {
  const { db, config } = deps;

  /** Replaces any earlier code for the same purpose, so only the latest email works. */
  async function issue(userId: string, purpose: CodePurpose, newEmail?: string): Promise<string> {
    const code = generateCode();
    const values = {
      codeHash: hashCode(code, config.authSecret),
      newEmail: newEmail ?? null,
      attempts: 0,
      expiresAt: new Date(Date.now() + CODE_LIFETIME_MINUTES[purpose] * 60_000),
      createdAt: new Date(),
    };
    await db
      .insert(userCodes)
      .values({ userId, purpose, ...values })
      .onConflictDoUpdate({ target: [userCodes.userId, userCodes.purpose], set: values });
    return code;
  }

  async function send(message: MailMessage): Promise<void> {
    try {
      await deps.mail.send(message);
    } catch (error) {
      deps.logger.error({ err: error, subject: message.subject }, 'Failed to send email');
      throw new AppError('EMAIL_FAILED', 'The email could not be sent. Try again in a moment.');
    }
  }

  async function issueAndSend(
    user: Recipient,
    purpose: CodePurpose,
    build: (code: string, minutes: number) => MailMessage,
    newEmail?: string,
  ): Promise<void> {
    const code = await issue(user.id, purpose, newEmail);
    await send(build(code, CODE_LIFETIME_MINUTES[purpose]));
  }

  return {
    sendInvite: (user: Recipient) =>
      issueAndSend(user, 'INVITE', (code, minutes) =>
        mailMessages.invite(user.email, user.name, code, minutes),
      ),

    sendPasswordReset: (user: Recipient) =>
      issueAndSend(user, 'PASSWORD_RESET', (code, minutes) =>
        mailMessages.passwordReset(user.email, user.name, code, minutes),
      ),

    /** Goes to the new address: receiving the code is what proves the user owns it. */
    sendEmailChange: (user: Recipient, newEmail: string) =>
      issueAndSend(
        user,
        'EMAIL_CHANGE',
        (code, minutes) => mailMessages.emailChange(newEmail, user.name, code, minutes),
        newEmail,
      ),

    /**
     * Checks `code` against the user's live codes for any of `purposes` and
     * deletes the one that matches, so it can never be used twice. A miss
     * counts against every candidate code; expired ones are cleared on sight.
     */
    async consume(
      userId: string,
      purposes: CodePurpose[],
      code: string,
    ): Promise<{ purpose: CodePurpose; newEmail: string | null }> {
      const candidates = await db
        .select()
        .from(userCodes)
        .where(and(eq(userCodes.userId, userId), inArray(userCodes.purpose, purposes)));

      const now = Date.now();
      const live = candidates.filter((row) => row.expiresAt.getTime() > now);
      const expired = candidates.filter((row) => row.expiresAt.getTime() <= now);
      if (expired.length > 0) {
        await db.delete(userCodes).where(
          inArray(
            userCodes.id,
            expired.map((row) => row.id),
          ),
        );
      }

      const match = live.find((row) => codeMatches(row.codeHash, code, config.authSecret));
      if (match) {
        // Deleting with RETURNING settles a race between two submissions of the same code.
        const [claimed] = await db
          .delete(userCodes)
          .where(eq(userCodes.id, match.id))
          .returning({ id: userCodes.id });
        if (!claimed) throw invalidCode();
        return { purpose: match.purpose, newEmail: match.newEmail };
      }

      if (live.length > 0) {
        const ids = live.map((row) => row.id);
        await db
          .update(userCodes)
          .set({ attempts: sql`${userCodes.attempts} + 1` })
          .where(inArray(userCodes.id, ids));
        await db
          .delete(userCodes)
          .where(and(inArray(userCodes.id, ids), sql`${userCodes.attempts} >= ${MAX_ATTEMPTS}`));
      }
      throw invalidCode();
    },
  };
}

export type UserCodeService = ReturnType<typeof createUserCodeService>;
