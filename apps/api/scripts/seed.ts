import { inArray } from 'drizzle-orm';
import { createDb } from '../src/db/client.js';
import { users } from '../src/db/schema.js';
import { hashPassword } from '../src/utils/password.js';
import { runScript } from './script-utils.js';

/**
 * Development-only demo accounts (docs/05 §4). Safe to run repeatedly:
 * existing emails are skipped.
 */
const appEnv = process.env.APP_ENV;
if (appEnv !== 'development' && appEnv !== 'test') {
  console.error(
    `Refusing to seed: APP_ENV is "${appEnv ?? 'unset'}". Seeding is for development and test only.`,
  );
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const password = process.env.SEED_PASSWORD ?? 'FieldMate-dev-1';

const accounts = [
  { email: 'admin@fieldmate.dev', name: 'Root Admin', role: 'ADMIN' as const },
  { email: 'manager@fieldmate.dev', name: 'Anita Rao', role: 'MANAGER' as const },
  { email: 'worker1@fieldmate.dev', name: 'Priya Nair', role: 'FIELD_WORKER' as const },
  { email: 'worker2@fieldmate.dev', name: 'Sam Lee', role: 'FIELD_WORKER' as const },
];

const { db, close } = createDb(databaseUrl, { max: 1 });
await runScript(async () => {
  try {
    const existing: { email: string }[] = await db
      .select({ email: users.email })
      .from(users)
      .where(
        inArray(
          users.email,
          accounts.map((a) => a.email),
        ),
      );
    const existingEmails = new Set(existing.map((row) => row.email));
    const missing = accounts.filter((account) => !existingEmails.has(account.email));

    if (missing.length > 0) {
      const passwordHash = await hashPassword(password);
      await db.insert(users).values(missing.map((account) => ({ ...account, passwordHash })));
    }

    for (const account of accounts) {
      const status = existingEmails.has(account.email) ? 'exists' : 'created';
      console.log(`${status.padEnd(8)} ${account.role.padEnd(12)} ${account.email}`);
    }
    console.log(`\nPassword for seeded accounts: ${password}`);
  } finally {
    await close();
  }
});
