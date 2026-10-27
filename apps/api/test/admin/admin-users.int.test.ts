import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { devicePushTokens, users } from '../../src/db/schema.js';
import { createAdminUserService } from '../../src/modules/admin/admin-user.service.js';
import { createTestApp, testMail } from '../helpers/app.js';
import { silentLogger, testConfig } from '../helpers/config.js';
import {
  createActor,
  createManager,
  createWorker,
  TEST_PASSWORD,
  type TestActor,
} from '../helpers/auth.js';
import { closeTestDb, testDb, truncateAll, uniqueEmail } from '../helpers/db.js';

const app = createTestApp();
const db = testDb();

let admin: TestActor;
let manager: TestActor;
let worker: TestActor;

const asAdmin = (method: 'get' | 'post' | 'patch' | 'delete', path: string) =>
  request(app)[method](path).auth(admin.token, { type: 'bearer' });

const newUser = () => ({
  name: 'New Person',
  email: uniqueEmail('new'),
  role: 'FIELD_WORKER' as const,
});

beforeEach(async () => {
  await truncateAll();
  testMail.reset();
  admin = await createActor('ADMIN', { name: 'Root Admin' });
  manager = await createManager();
  worker = await createWorker();
});

afterAll(closeTestDb);

describe('access to the admin area', () => {
  it('is refused to managers and workers', async () => {
    for (const actor of [manager, worker]) {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .auth(actor.token, { type: 'bearer' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/v1/admin/users')).status).toBe(401);
  });
});

describe('GET /admin/users', () => {
  it('lists everyone alphabetically with their role and status', async () => {
    const res = await asAdmin('get', '/api/v1/admin/users');

    expect(res.status).toBe(200);
    const names = res.body.items.map((u: { name: string }) => u.name);
    expect([...names].sort()).toEqual(names);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.items[0]).toMatchObject({ isActive: true });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('tokenVersion');
  });

  it('searches by name and email', async () => {
    await createWorker({ name: 'Zoe Unique', email: 'zoe.unique@fieldmate.test' });

    const byName = await asAdmin('get', '/api/v1/admin/users?search=Zoe');
    expect(byName.body.items).toHaveLength(1);

    const byEmail = await asAdmin('get', '/api/v1/admin/users?search=zoe.unique');
    expect(byEmail.body.items[0].name).toBe('Zoe Unique');
  });

  it('filters by role and by active state', async () => {
    const byRole = await asAdmin('get', '/api/v1/admin/users?role=FIELD_WORKER');
    expect(byRole.body.items.every((u: { role: string }) => u.role === 'FIELD_WORKER')).toBe(true);

    await asAdmin('patch', `/api/v1/admin/users/${worker.id}`).send({ isActive: false });

    const inactive = await asAdmin('get', '/api/v1/admin/users?isActive=false');
    expect(inactive.body.items).toHaveLength(1);
    expect(inactive.body.items[0].id).toBe(worker.id);
  });

  it('pages without repeating anyone', async () => {
    const first = await asAdmin('get', '/api/v1/admin/users?limit=2');
    expect(first.body.items).toHaveLength(2);
    expect(first.body.nextCursor).toBeTruthy();

    const second = await asAdmin(
      'get',
      `/api/v1/admin/users?limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`,
    );
    const ids = [...first.body.items, ...second.body.items].map((u: { id: string }) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(second.body.nextCursor).toBeNull();
  });
});

describe('POST /admin/users', () => {
  it('invites the user by email; they set their own password from the code', async () => {
    const input = newUser();
    const res = await asAdmin('post', '/api/v1/admin/users').send(input);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      email: input.email,
      role: 'FIELD_WORKER',
      isActive: true,
      status: 'INVITED',
    });
    expect(testMail.sent.at(-1)?.subject).toMatch(/invited/i);

    const setUp = await request(app)
      .post('/api/v1/auth/password/set')
      .send({
        email: input.email,
        code: testMail.lastCode(input.email),
        password: 'MyOwnPassword1',
      });
    expect(setUp.status).toBe(200);
    expect(setUp.body.user.email).toBe(input.email);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: input.email, password: 'MyOwnPassword1' });
    expect(login.status).toBe(200);

    const detail = await asAdmin('get', `/api/v1/admin/users/${res.body.id}`);
    expect(detail.body.status).toBe('ACTIVE');
  });

  it('refuses to sign in a pending invitation, whatever the password', async () => {
    const input = newUser();
    await asAdmin('post', '/api/v1/admin/users').send(input);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: input.email, password: 'anything-at-all' });
    expect(login.status).toBe(401);
    expect(login.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('keeps the account pending and says so when the email fails', async () => {
    const input = newUser();
    testMail.failNext();
    const res = await asAdmin('post', '/api/v1/admin/users').send(input);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('EMAIL_FAILED');

    const [row] = await db.select().from(users).where(eq(users.email, input.email));
    expect(row?.passwordSetAt).toBeNull();

    const resend = await asAdmin('post', `/api/v1/admin/users/${row?.id}/invite`);
    expect(resend.status).toBe(204);
    expect(testMail.lastCode(input.email)).toMatch(/^\d{6}$/);
  });

  it('accepts no password: nobody types one for someone else', async () => {
    const res = await asAdmin('post', '/api/v1/admin/users').send({
      ...newUser(),
      password: 'StrongPassword1',
    });
    expect(res.status).toBe(422);
  });

  it('can create another admin', async () => {
    const res = await asAdmin('post', '/api/v1/admin/users').send({
      ...newUser(),
      role: 'ADMIN',
    });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('ADMIN');
  });

  it('refuses a duplicate email', async () => {
    const res = await asAdmin('post', '/api/v1/admin/users').send({
      ...newUser(),
      email: manager.email,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it.each([
    ['missing name', { name: undefined }],
    ['invalid email', { email: 'nope' }],
    ['unknown role', { role: 'SUPERUSER' }],
  ])('rejects %s', async (_case, override) => {
    const res = await asAdmin('post', '/api/v1/admin/users').send({ ...newUser(), ...override });
    expect(res.status).toBe(422);
  });
});

describe('PATCH /admin/users/:id', () => {
  it('edits name, email and role', async () => {
    const email = uniqueEmail('renamed');
    const res = await asAdmin('patch', `/api/v1/admin/users/${worker.id}`).send({
      name: 'Renamed Worker',
      email,
      role: 'MANAGER',
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Renamed Worker', email, role: 'MANAGER' });
  });

  it('ends the sessions of a user whose role changes', async () => {
    await asAdmin('patch', `/api/v1/admin/users/${worker.id}`).send({ role: 'MANAGER' });

    const res = await request(app).get('/api/v1/users/me').auth(worker.token, { type: 'bearer' });
    expect(res.status).toBe(401);
  });

  it('deactivates a user: no login, no access, and hidden from the worker picker', async () => {
    const res = await asAdmin('patch', `/api/v1/admin/users/${worker.id}`).send({
      isActive: false,
    });
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: worker.email, password: TEST_PASSWORD });
    expect(login.status).toBe(401);
    expect(login.body.error.code).toBe('INVALID_CREDENTIALS');

    const session = await request(app)
      .get('/api/v1/users/me')
      .auth(worker.token, { type: 'bearer' });
    expect(session.status).toBe(401);

    const picker = await request(app)
      .get('/api/v1/users?role=FIELD_WORKER')
      .auth(manager.token, { type: 'bearer' });
    expect(picker.body.items.map((u: { id: string }) => u.id)).not.toContain(worker.id);
  });

  it('reactivates a user, who can then sign in again', async () => {
    await asAdmin('patch', `/api/v1/admin/users/${worker.id}`).send({ isActive: false });
    await asAdmin('patch', `/api/v1/admin/users/${worker.id}`).send({ isActive: true });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: worker.email, password: TEST_PASSWORD });
    expect(login.status).toBe(200);
  });

  it('refuses a duplicate email and an empty update', async () => {
    const duplicate = await asAdmin('patch', `/api/v1/admin/users/${worker.id}`).send({
      email: manager.email,
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('EMAIL_TAKEN');

    expect((await asAdmin('patch', `/api/v1/admin/users/${worker.id}`).send({})).status).toBe(422);
  });

  it('returns 404 for an unknown user', async () => {
    const res = await asAdmin(
      'patch',
      '/api/v1/admin/users/00000000-0000-4000-8000-000000000000',
    ).send({
      name: 'Nobody',
    });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });
});

describe('guardrails', () => {
  it('stops an admin deactivating or deleting themselves', async () => {
    const deactivate = await asAdmin('patch', `/api/v1/admin/users/${admin.id}`).send({
      isActive: false,
    });
    expect(deactivate.status).toBe(409);
    expect(deactivate.body.error.code).toBe('SELF_ACTION');

    const remove = await asAdmin('delete', `/api/v1/admin/users/${admin.id}`);
    expect(remove.status).toBe(409);
    expect(remove.body.error.code).toBe('SELF_ACTION');
  });

  it('stops an admin demoting themselves', async () => {
    const res = await asAdmin('patch', `/api/v1/admin/users/${admin.id}`).send({ role: 'MANAGER' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SELF_ACTION');
  });

  it('keeps at least one active admin', async () => {
    const second = await createActor('ADMIN', { name: 'Second Admin' });

    // Another admin exists, so this one may be deactivated.
    const ok = await asAdmin('patch', `/api/v1/admin/users/${second.id}`).send({ isActive: false });
    expect(ok.status).toBe(200);

    // Now only the acting admin is left; a third admin cannot remove them either.
    const third = await createActor('ADMIN', { name: 'Third Admin' });
    const demoteOther = await request(app)
      .patch(`/api/v1/admin/users/${admin.id}`)
      .auth(third.token, { type: 'bearer' })
      .send({ isActive: false });
    expect(demoteOther.status).toBe(200); // two active admins existed at that moment

    const lastOne = await request(app)
      .patch(`/api/v1/admin/users/${third.id}`)
      .auth(third.token, { type: 'bearer' })
      .send({ isActive: false });
    expect(lastOne.status).toBe(409);
    expect(['SELF_ACTION', 'LAST_ADMIN']).toContain(lastOne.body.error.code);
  });

  it('keeps one admin when the last two deactivate each other at once', async () => {
    const second = await createActor('ADMIN', { name: 'Second Admin' });

    // Straight to the service: over HTTP the loser can fail at sign-in instead,
    // and the test would pass without the lock it is here to check.
    // Repeated because a single try often runs the two one after the other.
    const service = createAdminUserService({
      db,
      config: testConfig(),
      mail: testMail,
      logger: silentLogger,
    });
    for (let round = 0; round < 20; round += 1) {
      await db.update(users).set({ isActive: true }).where(eq(users.role, 'ADMIN'));
      const results = await Promise.allSettled([
        service.update(admin.id, second.id, { isActive: false }),
        service.update(second.id, admin.id, { isActive: false }),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const refused = results.find((result) => result.status === 'rejected');
      expect((refused as PromiseRejectedResult).reason).toMatchObject({ code: 'LAST_ADMIN' });
    }
  });

  it('refuses to delete a user who appears in task history', async () => {
    await request(app)
      .post('/api/v1/tasks')
      .auth(manager.token, { type: 'bearer' })
      .send({
        title: 'Has history',
        description: 'Creates history for both users.',
        workerId: worker.id,
        location: { address: 'Depot' },
      });

    for (const id of [manager.id, worker.id]) {
      const res = await asAdmin('delete', `/api/v1/admin/users/${id}`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('USER_HAS_HISTORY');
      expect(res.body.error.message).toMatch(/Deactivate/);
    }
  });

  it('deletes a user with no history', async () => {
    const { body: created } = await asAdmin('post', '/api/v1/admin/users').send(newUser());

    const res = await asAdmin('delete', `/api/v1/admin/users/${created.id}`);
    expect(res.status).toBe(204);

    const rows = await db.select().from(users).where(eq(users.id, created.id));
    expect(rows).toHaveLength(0);
  });
});

describe('passwords and sessions', () => {
  it('emails a reset code; the new password ends the old sessions', async () => {
    const res = await asAdmin('post', `/api/v1/admin/users/${worker.id}/password-reset`);
    expect(res.status).toBe(204);
    expect(testMail.sent.at(-1)?.subject).toMatch(/reset/i);

    // Nothing changes until the user acts on the email.
    const stillSignedIn = await request(app)
      .get('/api/v1/users/me')
      .auth(worker.token, { type: 'bearer' });
    expect(stillSignedIn.status).toBe(200);

    await request(app)
      .post('/api/v1/auth/password/set')
      .send({
        email: worker.email,
        code: testMail.lastCode(worker.email),
        password: 'BrandNewPassword9',
      });

    const oldSession = await request(app)
      .get('/api/v1/users/me')
      .auth(worker.token, { type: 'bearer' });
    expect(oldSession.status).toBe(401);

    const oldPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: worker.email, password: TEST_PASSWORD });
    expect(oldPassword.status).toBe(401);
  });

  it('stops pushes to the old devices once the password is reset', async () => {
    await request(app)
      .post('/api/v1/users/me/push-tokens')
      .auth(worker.token, { type: 'bearer' })
      .send({ token: 'ExponentPushToken[lost-phone]', platform: 'android' });

    await asAdmin('post', `/api/v1/admin/users/${worker.id}/password-reset`);
    await request(app)
      .post('/api/v1/auth/password/set')
      .send({
        email: worker.email,
        code: testMail.lastCode(worker.email),
        password: 'BrandNewPassword9',
      });

    const tokens = await db
      .select()
      .from(devicePushTokens)
      .where(eq(devicePushTokens.userId, worker.id));
    expect(tokens).toHaveLength(0);
  });

  it('no longer lets an admin type someone else’s password', async () => {
    const res = await asAdmin('post', `/api/v1/admin/users/${worker.id}/password`).send({
      password: 'BrandNewPassword9',
    });
    expect(res.status).toBe(404);
  });

  it('resends an invitation only while it is pending', async () => {
    const res = await asAdmin('post', `/api/v1/admin/users/${worker.id}/invite`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_ACTIVE');
  });

  it('forces a sign-out without changing the password', async () => {
    const res = await asAdmin('post', `/api/v1/admin/users/${worker.id}/sessions/revoke`);
    expect(res.status).toBe(204);

    const oldSession = await request(app)
      .get('/api/v1/users/me')
      .auth(worker.token, { type: 'bearer' });
    expect(oldSession.status).toBe(401);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: worker.email, password: TEST_PASSWORD });
    expect(login.status).toBe(200);
  });
});

describe('admins and tasks', () => {
  it('can do everything a manager can', async () => {
    const created = await request(app)
      .post('/api/v1/tasks')
      .auth(admin.token, { type: 'bearer' })
      .send({
        title: 'Created by an admin',
        description: 'Admins have manager powers.',
        workerId: worker.id,
        location: { address: 'Depot' },
      });
    expect(created.status).toBe(201);

    const list = await request(app).get('/api/v1/tasks').auth(admin.token, { type: 'bearer' });
    expect(list.body.items).toHaveLength(1);

    const edited = await request(app)
      .patch(`/api/v1/tasks/${created.body.id}`)
      .auth(admin.token, { type: 'bearer' })
      .send({ title: 'Edited by an admin' });
    expect(edited.status).toBe(200);

    const cancelled = await request(app)
      .post(`/api/v1/tasks/${created.body.id}/cancel`)
      .auth(admin.token, { type: 'bearer' });
    expect(cancelled.status).toBe(200);
  });

  it('still cannot do worker-only actions', async () => {
    const { body: task } = await request(app)
      .post('/api/v1/tasks')
      .auth(admin.token, { type: 'bearer' })
      .send({
        title: 'Worker actions stay with workers',
        description: 'Admins do not start or reject.',
        workerId: worker.id,
        location: { address: 'Depot' },
      });

    for (const action of ['start', 'reject']) {
      const res = await request(app)
        .post(`/api/v1/tasks/${task.id}/${action}`)
        .auth(admin.token, { type: 'bearer' })
        .send({ reason: 'No' });
      expect(res.status).toBe(403);
    }
  });

  it('cannot assign work to a deactivated worker', async () => {
    await asAdmin('patch', `/api/v1/admin/users/${worker.id}`).send({ isActive: false });

    const res = await request(app)
      .post('/api/v1/tasks')
      .auth(admin.token, { type: 'bearer' })
      .send({
        title: 'To a deactivated worker',
        description: 'Should be refused.',
        workerId: worker.id,
        location: { address: 'Depot' },
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_WORKER');
    expect(res.body.error.message).toMatch(/deactivated/i);
  });
});
