import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { Paginated, TaskListItem } from '@fieldmate/shared';
import request from 'supertest';
import { createTestApp } from '../helpers/app.js';
import { createManager, createWorker, type TestActor } from '../helpers/auth.js';
import { closeTestDb, recordRejection, truncateAll } from '../helpers/db.js';

const app = createTestApp();

let manager: TestActor;
let worker: TestActor;
let otherWorker: TestActor;

async function createTask(title: string, assignee: TestActor = worker) {
  const res = await request(app)
    .post('/api/v1/tasks')
    .auth(manager.token, { type: 'bearer' })
    .send({
      title,
      description: 'Task description.',
      workerId: assignee.id,
      location: { address: `${title} address` },
    });
  return res.body as { id: string };
}

async function list(actor: TestActor, query = ''): Promise<Paginated<TaskListItem>> {
  const res = await request(app).get(`/api/v1/tasks${query}`).auth(actor.token, { type: 'bearer' });
  expect(res.status).toBe(200);
  return res.body;
}

const titles = (page: Paginated<TaskListItem>) => page.items.map((item) => item.title);

beforeEach(async () => {
  await truncateAll();
  manager = await createManager();
  worker = await createWorker({ name: 'Priya Nair' });
  otherWorker = await createWorker({ name: 'Sam Lee' });
});

afterAll(closeTestDb);

describe('GET /api/v1/tasks as a manager', () => {
  it('lists every task, newest update first', async () => {
    await createTask('First');
    await createTask('Second');
    const third = await createTask('Third');

    const page = await list(manager);

    expect(titles(page)).toEqual(['Third', 'Second', 'First']);
    expect(page.nextCursor).toBeNull();
    expect(page.items[0]).toMatchObject({
      id: third.id,
      status: 'ASSIGNED',
      address: 'Third address',
      worker: { id: worker.id, name: 'Priya Nair' },
      rejection: null,
    });
  });

  it('shows tasks assigned to any worker', async () => {
    await createTask('For Priya', worker);
    await createTask('For Sam', otherWorker);

    expect(titles(await list(manager)).sort()).toEqual(['For Priya', 'For Sam']);
  });

  it('filters by a single status and by several', async () => {
    const cancelled = await createTask('Cancelled task');
    await createTask('Assigned task');
    await request(app)
      .post(`/api/v1/tasks/${cancelled.id}/cancel`)
      .auth(manager.token, { type: 'bearer' });

    expect(titles(await list(manager, '?status=CANCELLED'))).toEqual(['Cancelled task']);
    expect(titles(await list(manager, '?status=ASSIGNED'))).toEqual(['Assigned task']);
    expect(titles(await list(manager, '?status=ASSIGNED,CANCELLED')).sort()).toEqual([
      'Assigned task',
      'Cancelled task',
    ]);
  });

  it('returns an empty page rather than an error when nothing matches', async () => {
    await createTask('Only task');
    const page = await list(manager, '?status=COMPLETED');
    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });

  it('pages through results with the cursor without repeating tasks', async () => {
    for (const title of ['T1', 'T2', 'T3', 'T4', 'T5']) await createTask(title);

    const first = await list(manager, '?limit=2');
    expect(titles(first)).toEqual(['T5', 'T4']);
    expect(first.nextCursor).toBeTruthy();

    const second = await list(manager, `?limit=2&cursor=${encodeURIComponent(first.nextCursor!)}`);
    expect(titles(second)).toEqual(['T3', 'T2']);

    const third = await list(manager, `?limit=2&cursor=${encodeURIComponent(second.nextCursor!)}`);
    expect(titles(third)).toEqual(['T1']);
    expect(third.nextCursor).toBeNull();
  });

  it('rejects an invalid cursor and an out-of-range limit', async () => {
    const badCursor = await request(app)
      .get('/api/v1/tasks?cursor=not-a-cursor')
      .auth(manager.token, { type: 'bearer' });
    expect(badCursor.status).toBe(400);
    expect(badCursor.body.error.code).toBe('INVALID_REQUEST');

    const badLimit = await request(app)
      .get('/api/v1/tasks?limit=100')
      .auth(manager.token, { type: 'bearer' });
    expect(badLimit.status).toBe(422);
  });

  it('shows the rejection reason on a rejected task', async () => {
    const task = await createTask('Rejected task');
    await recordRejection(task.id, 'Site locked, no key');

    const page = await list(manager, '?status=REJECTED');

    expect(page.items[0]?.rejection).toMatchObject({ reason: 'Site locked, no key' });
    expect(page.items[0]?.status).toBe('REJECTED');
  });
});

describe('GET /api/v1/tasks as a field worker', () => {
  it('returns only tasks currently assigned to them', async () => {
    await createTask('Mine', worker);
    await createTask('Not mine', otherWorker);

    expect(titles(await list(worker))).toEqual(['Mine']);
  });

  it('hides a task after it is reassigned to someone else', async () => {
    const task = await createTask('Moves away', worker);
    await request(app)
      .post(`/api/v1/tasks/${task.id}/assignment`)
      .auth(manager.token, { type: 'bearer' })
      .send({ workerId: otherWorker.id });

    expect(titles(await list(worker))).toEqual([]);
    expect(titles(await list(otherWorker))).toEqual(['Moves away']);
  });

  it('hides cancelled tasks even when asked for them', async () => {
    const task = await createTask('Cancelled', worker);
    await request(app)
      .post(`/api/v1/tasks/${task.id}/cancel`)
      .auth(manager.token, { type: 'bearer' });

    expect(titles(await list(worker))).toEqual([]);
    expect(titles(await list(worker, '?status=CANCELLED'))).toEqual([]);
  });

  it('hides a rejected task from the worker who rejected it', async () => {
    const task = await createTask('Rejected', worker);
    await recordRejection(task.id, 'Site locked');

    expect(titles(await list(worker))).toEqual([]);
    expect(titles(await list(manager, '?status=REJECTED'))).toEqual(['Rejected']);
  });
});
