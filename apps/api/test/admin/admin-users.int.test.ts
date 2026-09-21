import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { users } from '../../src/db/schema.js';
import { createTestApp } from '../helpers/app.js';
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
  password: 'StrongPassword1',
});

beforeEach(async () => {
  await truncateAll();
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
  it('creates a user who can sign in straight away', async () => {
    const input = newUser();
    const res = await asAdmin('post', '/api/v1/admin/users').send(input);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: input.email, role: 'FIELD_WORKER', isActive: true });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: input.email, password: input.password });
    expect(login.status).toBe(200);
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
    ['short password', { password: 'short' }],
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
  it('sets a new password and ends the old sessions', async () => {
    const res = await asAdmin('post', `/api/v1/admin/users/${worker.id}/password`).send({
      password: 'BrandNewPassword9',
    });
    expect(res.status).toBe(204);

    const oldSession = await request(app)
      .get('/api/v1/users/me')
      .auth(worker.token, { type: 'bearer' });
    expect(oldSession.status).toBe(401);

    const oldPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: worker.email, password: TEST_PASSWORD });
    expect(oldPassword.status).toBe(401);

    const newPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: worker.email, password: 'BrandNewPassword9' });
    expect(newPassword.status).toBe(200);
  });

  it('rejects a weak password', async () => {
    const res = await asAdmin('post', `/api/v1/admin/users/${worker.id}/password`).send({
      password: 'short',
    });
    expect(res.status).toBe(422);
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
