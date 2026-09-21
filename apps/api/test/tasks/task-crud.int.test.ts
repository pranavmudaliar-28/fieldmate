import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { TaskDetail } from '@fieldmate/shared';
import request from 'supertest';
import { createTestApp } from '../helpers/app.js';
import { createManager, createWorker, type TestActor } from '../helpers/auth.js';
import { closeTestDb, truncateAll } from '../helpers/db.js';

const app = createTestApp();

let manager: TestActor;
let worker: TestActor;

const validTask = () => ({
  title: 'Replace water meter at Block C',
  description: 'Old meter leaking; replace and photograph the serial number.',
  workerId: worker.id,
  location: { address: '14 Harbour Rd, Unit 3', latitude: -33.8688, longitude: 151.2093 },
});

async function createTask(body: Record<string, unknown> = validTask()) {
  return request(app).post('/api/v1/tasks').auth(manager.token, { type: 'bearer' }).send(body);
}

beforeEach(async () => {
  await truncateAll();
  manager = await createManager();
  worker = await createWorker();
});

afterAll(closeTestDb);

describe('POST /api/v1/tasks', () => {
  it('creates an assigned task with its location and worker', async () => {
    const res = await createTask();

    expect(res.status).toBe(201);
    const task = res.body as TaskDetail;
    expect(task).toMatchObject({
      title: 'Replace water meter at Block C',
      status: 'ASSIGNED',
      completedAt: null,
      location: { address: '14 Harbour Rd, Unit 3', latitude: -33.8688, longitude: 151.2093 },
      assignment: { worker: { id: worker.id, name: worker.name }, rejection: null },
      evidence: [],
      notes: [],
    });
    expect(task.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('accepts a task without coordinates', async () => {
    const res = await createTask({ ...validTask(), location: { address: 'Depot gate' } });
    expect(res.status).toBe(201);
    expect(res.body.location).toEqual({
      address: 'Depot gate',
      addressDetails: null,
      latitude: null,
      longitude: null,
    });
  });

  it('stores the door-level address details alongside the address', async () => {
    const res = await createTask({
      ...validTask(),
      location: {
        address: '14 Harbour Rd',
        addressDetails: 'Flat 3B, rear gate by the blue shutter',
        latitude: -33.8688,
        longitude: 151.2093,
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.location.addressDetails).toBe('Flat 3B, rear gate by the blue shutter');
  });

  it.each([
    ['missing title', { title: undefined }],
    ['blank title', { title: '   ' }],
    ['missing description', { description: undefined }],
    ['missing location', { location: undefined }],
    ['blank address', { location: { address: ' ' } }],
    ['one coordinate only', { location: { address: 'A', latitude: 10 } }],
    ['out-of-range latitude', { location: { address: 'A', latitude: 91, longitude: 0 } }],
    ['client-set status', { status: 'COMPLETED' }],
  ])('rejects %s with 422', async (_case, override) => {
    const res = await createTask({ ...validTask(), ...override });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a worker id that is not a field worker', async () => {
    const other = await createManager();
    const res = await createTask({ ...validTask(), workerId: other.id });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_WORKER');
  });

  it('rejects a worker id that does not exist', async () => {
    const res = await createTask({
      ...validTask(),
      workerId: '00000000-0000-4000-8000-000000000000',
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_WORKER');
  });

  it('forbids workers from creating tasks', async () => {
    const res = await request(app)
      .post('/api/v1/tasks')
      .auth(worker.token, { type: 'bearer' })
      .send(validTask());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/v1/tasks').send(validTask());
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/tasks/:taskId', () => {
  it('returns the full task for a manager', async () => {
    const { body: created } = await createTask();
    const res = await request(app)
      .get(`/api/v1/tasks/${created.id}`)
      .auth(manager.token, { type: 'bearer' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
    expect(res.body.assignment.worker.name).toBe(worker.name);
  });

  it('returns the task to its assigned worker', async () => {
    const { body: created } = await createTask();
    const res = await request(app)
      .get(`/api/v1/tasks/${created.id}`)
      .auth(worker.token, { type: 'bearer' });
    expect(res.status).toBe(200);
  });

  it('hides a task from a worker it is not assigned to', async () => {
    const { body: created } = await createTask();
    const other = await createWorker();
    const res = await request(app)
      .get(`/api/v1/tasks/${created.id}`)
      .auth(other.token, { type: 'bearer' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TASK_NOT_FOUND');
  });

  it('returns 404 for an unknown task and 400 for a malformed id', async () => {
    const missing = await request(app)
      .get('/api/v1/tasks/00000000-0000-4000-8000-000000000000')
      .auth(manager.token, { type: 'bearer' });
    expect(missing.status).toBe(404);

    const malformed = await request(app)
      .get('/api/v1/tasks/not-a-uuid')
      .auth(manager.token, { type: 'bearer' });
    expect(malformed.status).toBe(422);
  });

  it('never exposes storage keys', async () => {
    const { body: created } = await createTask();
    const res = await request(app)
      .get(`/api/v1/tasks/${created.id}`)
      .auth(manager.token, { type: 'bearer' });
    expect(JSON.stringify(res.body)).not.toContain('fileKey');
  });
});

describe('PATCH /api/v1/tasks/:taskId', () => {
  it('updates title, description and location', async () => {
    const { body: created } = await createTask();
    const res = await request(app)
      .patch(`/api/v1/tasks/${created.id}`)
      .auth(manager.token, { type: 'bearer' })
      .send({
        title: 'Replace water meter at Block D',
        location: { address: 'New address', latitude: null, longitude: null },
      });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Replace water meter at Block D');
    expect(res.body.location).toEqual({
      address: 'New address',
      addressDetails: null,
      latitude: null,
      longitude: null,
    });
    expect(res.body.description).toBe(created.description);
    expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThan(
      new Date(created.updatedAt).getTime(),
    );
  });

  it('replaces the whole location, so omitted details are cleared', async () => {
    const { body: created } = await createTask({
      ...validTask(),
      location: { address: '14 Harbour Rd', addressDetails: 'Flat 3B' },
    });

    const withDetails = await request(app)
      .patch(`/api/v1/tasks/${created.id}`)
      .auth(manager.token, { type: 'bearer' })
      .send({ location: { address: '14 Harbour Rd', addressDetails: 'Flat 4A, side door' } });
    expect(withDetails.status).toBe(200);
    expect(withDetails.body.location.addressDetails).toBe('Flat 4A, side door');

    const withoutDetails = await request(app)
      .patch(`/api/v1/tasks/${created.id}`)
      .auth(manager.token, { type: 'bearer' })
      .send({ location: { address: '14 Harbour Rd' } });
    expect(withoutDetails.status).toBe(200);
    expect(withoutDetails.body.location.addressDetails).toBeNull();
  });

  it('leaves updatedAt untouched when nothing actually changes', async () => {
    const { body: created } = await createTask();
    const res = await request(app)
      .patch(`/api/v1/tasks/${created.id}`)
      .auth(manager.token, { type: 'bearer' })
      .send({ title: created.title });

    expect(res.status).toBe(200);
    expect(res.body.updatedAt).toBe(created.updatedAt);
  });

  it('rejects an empty update and unknown fields', async () => {
    const { body: created } = await createTask();
    const empty = await request(app)
      .patch(`/api/v1/tasks/${created.id}`)
      .auth(manager.token, { type: 'bearer' })
      .send({});
    expect(empty.status).toBe(422);

    const unknown = await request(app)
      .patch(`/api/v1/tasks/${created.id}`)
      .auth(manager.token, { type: 'bearer' })
      .send({ status: 'COMPLETED' });
    expect(unknown.status).toBe(422);
  });

  it('forbids workers from editing', async () => {
    const { body: created } = await createTask();
    const res = await request(app)
      .patch(`/api/v1/tasks/${created.id}`)
      .auth(worker.token, { type: 'bearer' })
      .send({ title: 'Nope' });
    expect(res.status).toBe(403);
  });

  it('cannot edit a cancelled task', async () => {
    const { body: created } = await createTask();
    await request(app)
      .post(`/api/v1/tasks/${created.id}/cancel`)
      .auth(manager.token, { type: 'bearer' });

    const res = await request(app)
      .patch(`/api/v1/tasks/${created.id}`)
      .auth(manager.token, { type: 'bearer' })
      .send({ title: 'Too late' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });
});

describe('GET /api/v1/users?role=FIELD_WORKER', () => {
  it('lists field workers by name for the picker', async () => {
    await createWorker({ name: 'Sam Lee' });
    const res = await request(app)
      .get('/api/v1/users?role=FIELD_WORKER')
      .auth(manager.token, { type: 'bearer' });

    expect(res.status).toBe(200);
    const names = res.body.items.map((u: { name: string }) => u.name);
    expect(names).toContain('Priya Nair');
    expect(names).toContain('Sam Lee');
    expect([...names].sort()).toEqual(names);
    expect(JSON.stringify(res.body)).not.toContain('@');
  });

  it('forbids workers and rejects other roles', async () => {
    const forbidden = await request(app)
      .get('/api/v1/users?role=FIELD_WORKER')
      .auth(worker.token, { type: 'bearer' });
    expect(forbidden.status).toBe(403);

    const badRole = await request(app)
      .get('/api/v1/users?role=MANAGER')
      .auth(manager.token, { type: 'bearer' });
    expect(badRole.status).toBe(422);
  });
});
