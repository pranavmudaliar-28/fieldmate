import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import { eq } from 'drizzle-orm';
import { SignJWT } from 'jose';
import request from 'supertest';
import { devicePushTokens, users } from '../../src/db/schema.js';
import { hashPassword } from '../../src/utils/password.js';
import { signAccessToken } from '../../src/utils/jwt.js';
import { testConfig } from '../helpers/config.js';
import { createTestApp } from '../helpers/app.js';
import { closeTestDb, insertUser, testDb, truncateAll, uniqueEmail } from '../helpers/db.js';

const app = createTestApp();
const config = testConfig();
const db = testDb();
const PASSWORD = 'FieldMate-dev-1';

async function createAccount(overrides: Parameters<typeof insertUser>[0] = {}) {
  return insertUser({ passwordHash: await hashPassword(PASSWORD), ...overrides });
}

async function login(email: string, password = PASSWORD) {
  return request(app).post('/api/v1/auth/login').send({ email, password });
}

beforeEach(truncateAll);
afterAll(closeTestDb);

describe('POST /api/v1/auth/login', () => {
  it('returns a token and the user for correct credentials', async () => {
    const email = uniqueEmail('manager');
    const user = await createAccount({ email, name: 'Anita Rao', role: 'MANAGER' });

    const res = await login(email);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: user.id,
      name: 'Anita Rao',
      email,
      role: 'MANAGER',
    });
    expect(typeof res.body.token).toBe('string');
  });

  it('never returns the password hash or token version', async () => {
    const email = uniqueEmail();
    await createAccount({ email });
    const res = await login(email);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('argon2');
    expect(body).not.toContain('passwordHash');
    expect(body).not.toContain('tokenVersion');
  });

  it('accepts an email with different case and surrounding spaces', async () => {
    const email = uniqueEmail('mixed');
    await createAccount({ email });
    const res = await login(`  ${email.toUpperCase()} `);
    expect(res.status).toBe(200);
  });

  it('rejects a wrong password with 401 INVALID_CREDENTIALS', async () => {
    const email = uniqueEmail();
    await createAccount({ email });
    const res = await login(email, 'wrong-password');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' },
    });
  });

  it('gives the same answer for an unknown email (no account enumeration)', async () => {
    const res = await login(uniqueEmail('nobody'));
    expect(res.status).toBe(401);
    expect(res.body.error).toEqual({
      code: 'INVALID_CREDENTIALS',
      message: 'Incorrect email or password.',
    });
  });

  it.each([
    ['missing password', { email: 'a@b.co' }],
    ['missing email', { password: PASSWORD }],
    ['invalid email', { email: 'not-an-email', password: PASSWORD }],
    ['blank password', { email: 'a@b.co', password: '' }],
    ['unknown field', { email: 'a@b.co', password: PASSWORD, role: 'MANAGER' }],
  ])('rejects %s with 422', async (_case, body) => {
    const res = await request(app).post('/api/v1/auth/login').send(body);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('applies the login rate limit when enabled', async () => {
    process.env.RATE_LIMIT_IN_TESTS = 'true';
    const limitedApp = createTestApp();
    const email = uniqueEmail('limited');
    await createAccount({ email });
    try {
      const attempts = [];
      for (let i = 0; i < 11; i += 1) {
        attempts.push(
          await request(limitedApp)
            .post('/api/v1/auth/login')
            .send({ email, password: 'wrong-password' }),
        );
      }
      const last = attempts.at(-1);
      expect(attempts.filter((r) => r.status === 401)).toHaveLength(10);
      expect(last?.status).toBe(429);
      expect(last?.body.error.code).toBe('RATE_LIMITED');
    } finally {
      delete process.env.RATE_LIMIT_IN_TESTS;
    }
  });
});

describe('GET /api/v1/users/me', () => {
  it('returns the authenticated user', async () => {
    const email = uniqueEmail('worker');
    await createAccount({ email, name: 'Priya Nair', role: 'FIELD_WORKER' });
    const { body } = await login(email);

    const res = await request(app).get('/api/v1/users/me').auth(body.token, { type: 'bearer' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: body.user.id,
      name: 'Priya Nair',
      email,
      role: 'FIELD_WORKER',
    });
  });

  it.each([
    ['no header', undefined],
    ['wrong scheme', 'Basic abc'],
    ['garbage token', 'Bearer not.a.token'],
  ])('rejects a request with %s', async (_case, header) => {
    const req = request(app).get('/api/v1/users/me');
    if (header) req.set('Authorization', header);
    const res = await req;
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects an expired token', async () => {
    const user = await createAccount();
    const expired = await new SignJWT({ ver: user.tokenVersion })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer('fieldmate-api')
      .setAudience('fieldmate-mobile:test')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 8 * 86_400)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 86_400)
      .sign(new TextEncoder().encode(config.authSecret));

    const res = await request(app).get('/api/v1/users/me').auth(expired, { type: 'bearer' });
    expect(res.status).toBe(401);
  });

  it('rejects a token from another environment', async () => {
    const user = await createAccount();
    const stagingToken = await signAccessToken(
      { userId: user.id, tokenVersion: user.tokenVersion },
      testConfig({ appEnv: 'staging' }),
    );
    const res = await request(app).get('/api/v1/users/me').auth(stagingToken, { type: 'bearer' });
    expect(res.status).toBe(401);
  });

  it('rejects a token whose user no longer exists', async () => {
    const user = await createAccount();
    const token = await signAccessToken(
      { userId: user.id, tokenVersion: user.tokenVersion },
      config,
    );
    await db.delete(users).where(eq(users.id, user.id));

    const res = await request(app).get('/api/v1/users/me').auth(token, { type: 'bearer' });
    expect(res.status).toBe(401);
  });

  it('reflects a role change from the database, not the token', async () => {
    const email = uniqueEmail('promoted');
    const user = await createAccount({ email, role: 'FIELD_WORKER' });
    const { body } = await login(email);

    await db.update(users).set({ role: 'MANAGER' }).where(eq(users.id, user.id));

    const res = await request(app).get('/api/v1/users/me').auth(body.token, { type: 'bearer' });
    expect(res.body.role).toBe('MANAGER');
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(401);
  });

  it('ends the session and invalidates the token everywhere', async () => {
    const email = uniqueEmail('logout');
    const user = await createAccount({ email });
    const { body } = await login(email);

    const res = await request(app).post('/api/v1/auth/logout').auth(body.token, { type: 'bearer' });
    expect(res.status).toBe(204);

    const reuse = await request(app).get('/api/v1/users/me').auth(body.token, { type: 'bearer' });
    expect(reuse.status).toBe(401);

    const [after] = await db
      .select({ tokenVersion: users.tokenVersion })
      .from(users)
      .where(eq(users.id, user.id));
    expect(after?.tokenVersion).toBe(user.tokenVersion + 1);
  });

  it('invalidates tokens issued to other devices too', async () => {
    const email = uniqueEmail('multi-device');
    await createAccount({ email });
    const phone = (await login(email)).body.token;
    const tablet = (await login(email)).body.token;

    await request(app).post('/api/v1/auth/logout').auth(phone, { type: 'bearer' });

    const res = await request(app).get('/api/v1/users/me').auth(tablet, { type: 'bearer' });
    expect(res.status).toBe(401);
  });

  it('removes the user push tokens', async () => {
    const email = uniqueEmail('push');
    const user = await createAccount({ email });
    await db
      .insert(devicePushTokens)
      .values({ userId: user.id, token: 'ExponentPushToken[logout]', platform: 'android' });
    const { body } = await login(email);

    await request(app).post('/api/v1/auth/logout').auth(body.token, { type: 'bearer' });

    const remaining = await db
      .select()
      .from(devicePushTokens)
      .where(eq(devicePushTokens.userId, user.id));
    expect(remaining).toHaveLength(0);
  });

  it('lets the user log in again after logging out', async () => {
    const email = uniqueEmail('relogin');
    await createAccount({ email });
    const first = (await login(email)).body.token;
    await request(app).post('/api/v1/auth/logout').auth(first, { type: 'bearer' });

    const second = await login(email);
    expect(second.status).toBe(200);
    const res = await request(app)
      .get('/api/v1/users/me')
      .auth(second.body.token, { type: 'bearer' });
    expect(res.status).toBe(200);
  });
});
