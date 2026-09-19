import { parseArgs } from 'node:util';
import { eq } from 'drizzle-orm';
import { createDb } from '../src/db/client.js';
import { users } from '../src/db/schema.js';
import { createAuthRepository } from '../src/modules/auth/auth.repository.js';
import { fail, runScript } from './script-utils.js';

/**
 * Ends every session for a user (e.g. a lost phone): bumps token_version and
 * deletes their push tokens.
 *   npm run user:revoke-sessions -w @fieldmate/api -- --email a@b.co
 */
const { values } = parseArgs({ options: { email: { type: 'string' } } });
const email = values.email?.trim().toLowerCase();

if (!email) fail('--email is required.');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) fail('DATABASE_URL is not set.');

const { db, close } = createDb(databaseUrl, { max: 1 });
await runScript(async () => {
  try {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (!user) fail(`No user with email ${email}.`);
    const tokenVersion = await createAuthRepository(db).revokeSessions(user.id);
    console.log(`Sessions revoked for ${email} (token_version is now ${tokenVersion}).`);
  } finally {
    await close();
  }
});
