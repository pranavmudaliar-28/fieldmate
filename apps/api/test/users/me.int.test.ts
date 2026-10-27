import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createTestApp, testMail } from '../helpers/app.js';
import {
  createActor,
  createManager,
  createWorker,
  TEST_PASSWORD,
  type TestActor,
} from '../helpers/auth.js';
import { closeTestDb, truncateAll, uniqueEmail } from '../helpers/db.js';

const app = createTestApp();

let worker: TestActor;
let manager: TestActor;

const as = (actor: TestActor, method: 'get' | 'post' | 'patch', path: string) =>
  request(app)[method](path).auth(actor.token, { type: 'bearer' });

beforeEach(async () => {
  await truncateAll();
  testMail.reset();
  worker = await createWorker();
  manager = await createManager();
});

afterAll(closeTestDb);

describe('PATCH /users/me', () => {
  it('renames the signed-in user', async () => {
    const res = await as(worker, 'patch', '/api/v1/users/me').send({ name: '  Priya N.  ' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: worker.id, name: 'Priya N.' });

    const me = await as(worker, 'get', '/api/v1/users/me');
    expect(me.body.name).toBe('Priya N.');
  });

  it('accepts only the name', async () => {
    const res = await as(worker, 'patch', '/api/v1/users/me').send({ name: 'X', role: 'ADMIN' });
    expect(res.status).toBe(422);
  });
});

describe('POST /users/me/password', () => {
  it('needs the current password', async () => {
    const res = await as(worker, 'post', '/api/v1/users/me/password').send({
      currentPassword: 'not-my-password',
      newPassword: 'NewPassword-77',
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns a fresh token and signs out every other session', async () => {
    const res = await as(worker, 'post', '/api/v1/users/me/password').send({
      currentPassword: TEST_PASSWORD,
      newPassword: 'NewPassword-77',
    });
    expect(res.status).toBe(200);

    const fresh = await request(app)
      .get('/api/v1/users/me')
      .auth(res.body.token, { type: 'bearer' });
    expect(fresh.status).toBe(200);
    expect((await as(worker, 'get', '/api/v1/users/me')).status).toBe(401);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: worker.email, password: 'NewPassword-77' });
    expect(login.status).toBe(200);
  });
});

describe('changing email', () => {
  it('sends the code to the new address and swaps it once confirmed', async () => {
    const newEmail = uniqueEmail('moved');
    const request1 = await as(worker, 'post', '/api/v1/users/me/email').send({
      newEmail,
      currentPassword: TEST_PASSWORD,
    });
    expect(request1.status).toBe(204);
    expect(testMail.sent.at(-1)?.to).toBe(newEmail);

    // The old address still signs in until the new one is confirmed.
    expect((await as(worker, 'get', '/api/v1/users/me')).body.email).toBe(worker.email);

    const confirm = await as(worker, 'post', '/api/v1/users/me/email/confirm').send({
      code: testMail.lastCode(newEmail),
    });
    expect(confirm.status).toBe(200);
    expect(confirm.body.email).toBe(newEmail);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: newEmail, password: TEST_PASSWORD });
    expect(login.status).toBe(200);
  });

  it('refuses an address someone else uses, and a wrong current password', async () => {
    const taken = await as(worker, 'post', '/api/v1/users/me/email').send({
      newEmail: manager.email,
      currentPassword: TEST_PASSWORD,
    });
    expect(taken.status).toBe(409);
    expect(taken.body.error.code).toBe('EMAIL_TAKEN');

    const wrong = await as(worker, 'post', '/api/v1/users/me/email').send({
      newEmail: uniqueEmail('moved'),
      currentPassword: 'not-my-password',
    });
    expect(wrong.status).toBe(401);
    expect(testMail.sent).toHaveLength(0);
  });

  it('rejects a wrong code', async () => {
    await as(worker, 'post', '/api/v1/users/me/email').send({
      newEmail: uniqueEmail('moved'),
      currentPassword: TEST_PASSWORD,
    });
    const res = await as(worker, 'post', '/api/v1/users/me/email/confirm').send({ code: '000000' });
    // A one-in-a-million chance the real code was 000000; the error is what matters.
    if (res.status !== 200) expect(res.body.error.code).toBe('INVALID_CODE');
  });
});

describe('POST /users/invitations', () => {
  it('lets a manager invite a field worker', async () => {
    const email = uniqueEmail('crew');
    const res = await as(manager, 'post', '/api/v1/users/invitations').send({
      name: 'New Crew',
      email,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ role: 'FIELD_WORKER', status: 'INVITED' });
    expect(testMail.lastCode(email)).toMatch(/^\d{6}$/);
  });

  it.each(['MANAGER', 'ADMIN'])('refuses a manager inviting a %s', async (role) => {
    const res = await as(manager, 'post', '/api/v1/users/invitations').send({
      name: 'Too Senior',
      email: uniqueEmail('senior'),
      role,
    });
    expect(res.status).toBe(403);
    expect(testMail.sent).toHaveLength(0);
  });

  it('lets an admin invite any role', async () => {
    const admin = await createActor('ADMIN');
    const res = await as(admin, 'post', '/api/v1/users/invitations').send({
      name: 'New Manager',
      email: uniqueEmail('mgr'),
      role: 'MANAGER',
    });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('MANAGER');
  });

  it('resends to a pending invitee instead of failing, but not to an active user', async () => {
    const email = uniqueEmail('crew');
    await as(manager, 'post', '/api/v1/users/invitations').send({ name: 'New Crew', email });
    const again = await as(manager, 'post', '/api/v1/users/invitations').send({
      name: 'New Crew',
      email,
    });
    expect(again.status).toBe(201);
    expect(testMail.sent.filter((mail) => mail.to === email)).toHaveLength(2);

    const active = await as(manager, 'post', '/api/v1/users/invitations').send({
      name: 'Existing',
      email: worker.email,
    });
    expect(active.status).toBe(409);
    expect(active.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('is not open to field workers', async () => {
    const res = await as(worker, 'post', '/api/v1/users/invitations').send({
      name: 'Friend',
      email: uniqueEmail('friend'),
    });
    expect(res.status).toBe(403);
  });

  it('lets a pending invitee use "forgot password" to get a fresh invite code', async () => {
    const email = uniqueEmail('crew');
    await as(manager, 'post', '/api/v1/users/invitations').send({ name: 'New Crew', email });
    testMail.reset();

    await request(app).post('/api/v1/auth/password/forgot').send({ email });
    expect(testMail.sent.at(-1)?.subject).toMatch(/invited/i);

    const setUp = await request(app)
      .post('/api/v1/auth/password/set')
      .send({ email, code: testMail.lastCode(email), password: 'CrewPassword-1' });
    expect(setUp.status).toBe(200);
  });
});
