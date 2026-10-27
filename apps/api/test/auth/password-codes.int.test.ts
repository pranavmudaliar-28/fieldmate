import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { userCodes } from '../../src/db/schema.js';
import { createTestApp, testMail } from '../helpers/app.js';
import { createWorker, TEST_PASSWORD, type TestActor } from '../helpers/auth.js';
import { closeTestDb, testDb, truncateAll, uniqueEmail } from '../helpers/db.js';

const app = createTestApp();
const db = testDb();
const NEW_PASSWORD = 'ChosenByMe-42';

let worker: TestActor;

const forgot = (email: string) => request(app).post('/api/v1/auth/password/forgot').send({ email });
const setPassword = (email: string, code: string | undefined, password = NEW_PASSWORD) =>
  request(app).post('/api/v1/auth/password/set').send({ email, code, password });
const wrongCode = (code: string) => (code === '000000' ? '111111' : '000000');

beforeEach(async () => {
  await truncateAll();
  testMail.reset();
  worker = await createWorker();
});

afterAll(closeTestDb);

describe('POST /auth/password/forgot', () => {
  it('answers the same for unknown and known addresses, emailing only the real one', async () => {
    const unknown = await forgot(uniqueEmail('nobody'));
    const known = await forgot(worker.email);

    expect(unknown.status).toBe(204);
    expect(known.status).toBe(204);
    expect(testMail.sent.map((mail) => mail.to)).toEqual([worker.email]);
  });

  it('still answers 204 when the email cannot be sent', async () => {
    testMail.failNext();
    expect((await forgot(worker.email)).status).toBe(204);
  });

  it('only the latest code works', async () => {
    await forgot(worker.email);
    const first = testMail.lastCode(worker.email) as string;
    await forgot(worker.email);
    const second = testMail.lastCode(worker.email) as string;

    if (first !== second) expect((await setPassword(worker.email, first)).status).toBe(422);
    expect((await setPassword(worker.email, second)).status).toBe(200);
  });
});

describe('POST /auth/password/set', () => {
  it('sets the password, signs the user in, and ends their old sessions', async () => {
    await forgot(worker.email);
    const res = await setPassword(worker.email, testMail.lastCode(worker.email));

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: worker.id, email: worker.email });

    const fresh = await request(app)
      .get('/api/v1/users/me')
      .auth(res.body.token, { type: 'bearer' });
    expect(fresh.status).toBe(200);
    const old = await request(app).get('/api/v1/users/me').auth(worker.token, { type: 'bearer' });
    expect(old.status).toBe(401);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: worker.email, password: NEW_PASSWORD });
    expect(login.status).toBe(200);
  });

  it('cannot use the same code twice', async () => {
    await forgot(worker.email);
    const code = testMail.lastCode(worker.email);
    expect((await setPassword(worker.email, code)).status).toBe(200);

    const again = await setPassword(worker.email, code, 'SomethingElse-9');
    expect(again.status).toBe(422);
    expect(again.body.error.code).toBe('INVALID_CODE');
  });

  it('burns the code after five wrong tries', async () => {
    await forgot(worker.email);
    const code = testMail.lastCode(worker.email) as string;

    for (let i = 0; i < 5; i += 1) {
      expect((await setPassword(worker.email, wrongCode(code))).status).toBe(422);
    }
    const right = await setPassword(worker.email, code);
    expect(right.status).toBe(422);
    expect(right.body.error.code).toBe('INVALID_CODE');
  });

  it('refuses an expired code', async () => {
    await forgot(worker.email);
    await db
      .update(userCodes)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(userCodes.userId, worker.id));

    const res = await setPassword(worker.email, testMail.lastCode(worker.email));
    expect(res.status).toBe(422);
  });

  it('gives the same answer for an unknown email as for a wrong code', async () => {
    const res = await setPassword(uniqueEmail('nobody'), '123456');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_CODE');
  });

  it('keeps the password rules', async () => {
    await forgot(worker.email);
    const res = await setPassword(worker.email, testMail.lastCode(worker.email), 'short');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');

    // The rejected attempt did not use up the code.
    expect((await setPassword(worker.email, testMail.lastCode(worker.email))).status).toBe(200);
  });

  it('leaves the old password working until a code is used', async () => {
    await forgot(worker.email);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: worker.email, password: TEST_PASSWORD });
    expect(login.status).toBe(200);
  });
});
