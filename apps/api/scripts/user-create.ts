import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { ROLES, FIELD_LIMITS, type Role } from '@fieldmate/shared';
import { createDb } from '../src/db/client.js';
import { users } from '../src/db/schema.js';
import { hashPassword } from '../src/utils/password.js';
import { fail, rootCauseMessage } from './script-utils.js';

/**
 * Creates a user account. There is no self-registration (docs/02 §3 F-001):
 *   npm run user:create -w @fieldmate/api -- --email a@b.co --name "Anita Rao" --role MANAGER
 */
const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string' },
  },
});

const email = values.email?.trim().toLowerCase();
const name = values.name?.trim();
const role = values.role?.trim().toUpperCase() as Role | undefined;

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
  fail('--email must be a valid email address.');
if (!name || name.length > FIELD_LIMITS.userName) {
  fail(`--name is required and must be at most ${FIELD_LIMITS.userName} characters.`);
}
if (!role || !ROLES.includes(role)) fail(`--role must be one of: ${ROLES.join(', ')}`);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) fail('DATABASE_URL is not set.');

/**
 * Reads passwords without echoing them. One readline interface handles both
 * prompts; when stdin is piped (CI, scripted setup) the lines are read as-is.
 */
async function readPasswords(): Promise<[string, string]> {
  const interactive = Boolean(stdin.isTTY);

  // Piped input (scripted setup): both lines can arrive in one chunk, which a
  // prompt-by-prompt reader would miss, so read everything at once.
  if (!interactive) {
    let data = '';
    for await (const chunk of stdin) data += chunk;
    const [first = '', second = ''] = data.split(/\r?\n/);
    return [first, second];
  }

  const rl = createInterface({ input: stdin, output: stdout, terminal: interactive });
  let muted = false;
  const originalWrite = stdout.write.bind(stdout);

  if (interactive) {
    stdout.write = ((chunk: string | Uint8Array, ...rest: unknown[]) =>
      muted ? true : originalWrite(chunk, ...(rest as []))) as typeof stdout.write;
  }

  const ask = async (question: string): Promise<string> => {
    const answer = rl.question(question);
    muted = true;
    const value = await answer;
    muted = false;
    if (interactive) originalWrite('\n');
    return value;
  };

  try {
    return [await ask('Password: '), await ask('Confirm password: ')];
  } finally {
    stdout.write = originalWrite;
    rl.close();
  }
}

const [password, confirmation] = await readPasswords();

if (password !== confirmation) fail('Passwords do not match.');
if (password.length < FIELD_LIMITS.passwordMin || password.length > FIELD_LIMITS.passwordMax) {
  fail(`Password must be ${FIELD_LIMITS.passwordMin}-${FIELD_LIMITS.passwordMax} characters.`);
}

const { db, close } = createDb(databaseUrl, { max: 1 });
try {
  const passwordHash = await hashPassword(password);
  const [created] = await db
    .insert(users)
    .values({ email, name, role, passwordHash })
    .returning({ id: users.id });
  console.log(`Created ${role} ${email} (${created?.id}).`);
} catch (error) {
  const message = rootCauseMessage(error);
  if (message.includes('users_email_unique')) fail(`A user with ${email} already exists.`);
  if (/relation .* does not exist/.test(message)) {
    fail(`${message}\nApply migrations first: npm run db:migrate -w @fieldmate/api`);
  }
  fail(message);
} finally {
  await close();
}
