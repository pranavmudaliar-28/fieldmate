import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from '../helpers/app.js';
import { createManager, createWorker, type TestActor } from '../helpers/auth.js';
import { closeTestDb, truncateAll } from '../helpers/db.js';

const app = createTestApp();

let manager: TestActor;
let worker: TestActor;
let otherWorker: TestActor;

async function createTask(assignee: TestActor, title = 'Replace water meter'): Promise<string> {
  const res = await request(app)
    .post('/api/v1/tasks')
    .auth(manager.token, { type: 'bearer' })
    .send({
      title,
      description: 'Old meter leaking.',
      workerId: assignee.id,
      location: { address: '14 Harbour Rd' },
    });
  return res.body.id as string;
}

/** Notifications are written after the response, like the push beside them. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

const inbox = (actor: TestActor, query = '') =>
  request(app).get(`/api/v1/notifications${query}`).auth(actor.token, { type: 'bearer' });

const unread = (actor: TestActor) =>
  request(app).get('/api/v1/notifications/unread-count').auth(actor.token, { type: 'bearer' });

beforeEach(async () => {
  await truncateAll();
  manager = await createManager({ name: 'Anita Rao' });
  worker = await createWorker({ name: 'Priya Nair' });
  otherWorker = await createWorker({ name: 'Sam Lee' });
});

afterAll(closeTestDb);

describe('the inbox', () => {
  it('records an assignment for the worker it was assigned to', async () => {
    await createTask(worker);
    await settle();

    const res = await inbox(worker);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      type: 'TASK_ASSIGNED',
      title: 'New task assigned',
      body: 'Replace water meter',
      readAt: null,
    });
  });

  it('shows nobody else the notification', async () => {
    await createTask(worker);
    await settle();

    expect((await inbox(otherWorker)).body.items).toHaveLength(0);
    expect((await inbox(manager)).body.items).toHaveLength(0);
  });

  it('survives a push the device never receives', async () => {
    // The inbox is written whether or not the push lands, which is the whole
    // reason it exists: this worker has registered no device at all.
    await createTask(worker);
    await settle();

    expect((await unread(worker)).body).toEqual({ unread: 1 });
  });

  it('counts only what is unread', async () => {
    await createTask(worker, 'First');
    await createTask(worker, 'Second');
    await settle();

    expect((await unread(worker)).body).toEqual({ unread: 2 });

    const [first] = (await inbox(worker)).body.items;
    const read = await request(app)
      .post(`/api/v1/notifications/${first.id}/read`)
      .auth(worker.token, { type: 'bearer' });
    expect(read.status).toBe(204);

    expect((await unread(worker)).body).toEqual({ unread: 1 });
    const after = (await inbox(worker)).body.items.find((n: { id: string }) => n.id === first.id);
    expect(after.readAt).not.toBeNull();
  });

  it('marks everything read at once', async () => {
    await createTask(worker, 'First');
    await createTask(worker, 'Second');
    await settle();

    const res = await request(app)
      .post('/api/v1/notifications/read-all')
      .auth(worker.token, { type: 'bearer' });
    expect(res.status).toBe(204);
    expect((await unread(worker)).body).toEqual({ unread: 0 });
  });

  it('reports someone else notification as missing, not forbidden', async () => {
    await createTask(worker);
    await settle();
    const [mine] = (await inbox(worker)).body.items;

    // Not 403: the inbox must not confirm that another user's row exists.
    const res = await request(app)
      .post(`/api/v1/notifications/${mine.id}/read`)
      .auth(otherWorker.token, { type: 'bearer' });
    expect(res.status).toBe(404);

    expect((await unread(worker)).body).toEqual({ unread: 1 });
  });

  it('needs a token', async () => {
    expect((await request(app).get('/api/v1/notifications')).status).toBe(401);
    expect((await request(app).get('/api/v1/notifications/unread-count')).status).toBe(401);
  });

  it('pages newest first without repeating a row', async () => {
    for (const title of ['First', 'Second', 'Third']) await createTask(worker, title);
    await settle();

    const page1 = await inbox(worker, '?limit=2');
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.items[0].body).toBe('Third');
    expect(page1.body.nextCursor).toEqual(expect.any(String));

    const page2 = await inbox(
      worker,
      `?limit=2&cursor=${encodeURIComponent(page1.body.nextCursor)}`,
    );
    expect(page2.body.items).toHaveLength(1);
    expect(page2.body.items[0].body).toBe('First');
    expect(page2.body.nextCursor).toBeNull();

    const ids = [...page1.body.items, ...page2.body.items].map((n: { id: string }) => n.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('rejects a bad cursor and an absurd limit', async () => {
    expect((await inbox(worker, '?cursor=garbage')).status).toBe(400);
    expect((await inbox(worker, '?limit=9999')).status).toBe(422);
  });

  it('records a cancellation for the worker and a rejection for the manager', async () => {
    const cancelled = await createTask(worker, 'Cancelled job');
    await request(app)
      .post(`/api/v1/tasks/${cancelled}/cancel`)
      .auth(manager.token, { type: 'bearer' });

    const rejected = await createTask(worker, 'Rejected job');
    await request(app)
      .post(`/api/v1/tasks/${rejected}/reject`)
      .auth(worker.token, { type: 'bearer' })
      .send({ reason: 'No access' });
    await settle();

    const workerTypes = (await inbox(worker)).body.items.map((n: { type: string }) => n.type);
    expect(workerTypes).toContain('TASK_CANCELLED');

    const managerItems = (await inbox(manager)).body.items;
    expect(managerItems).toHaveLength(1);
    expect(managerItems[0]).toMatchObject({ type: 'TASK_REJECTED', taskId: rejected });
  });
});
