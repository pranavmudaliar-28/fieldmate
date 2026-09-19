import type { Role } from '@fieldmate/shared';
import { signAccessToken } from '../../src/utils/jwt.js';
import { hashPassword } from '../../src/utils/password.js';
import { testConfig } from './config.js';
import { insertUser, uniqueEmail } from './db.js';

export const TEST_PASSWORD = 'FieldMate-dev-1';

export type TestActor = {
  id: string;
  name: string;
  email: string;
  role: Role;
  token: string;
  /** Supertest auth shorthand: `.set(...actor.auth)` is avoided; use `.auth(actor.token, ...)`. */
};

/** Creates a user and a valid bearer token for them. */
export async function createActor(
  role: Role,
  overrides: { name?: string; email?: string } = {},
): Promise<TestActor> {
  const user = await insertUser({
    role,
    name: overrides.name ?? (role === 'MANAGER' ? 'Anita Rao' : 'Priya Nair'),
    email: overrides.email ?? uniqueEmail(role.toLowerCase()),
    passwordHash: await hashPassword(TEST_PASSWORD),
  });

  const token = await signAccessToken(
    { userId: user.id, tokenVersion: user.tokenVersion },
    testConfig(),
  );

  return { id: user.id, name: user.name, email: user.email, role, token };
}

export const createManager = (overrides?: { name?: string; email?: string }) =>
  createActor('MANAGER', overrides);

export const createWorker = (overrides?: { name?: string; email?: string }) =>
  createActor('FIELD_WORKER', overrides);
