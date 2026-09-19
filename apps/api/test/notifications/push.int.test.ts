import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { devicePushTokens } from '../../src/db/schema.js';
import { createTestApp, testPush } from '../helpers/app.js';
import { createManager, createWorker, type TestActor } from '../helpers/auth.js';
import { closeTestDb, forceStatus, testDb, truncateAll } from '../helpers/db.js';

const app = createTestApp();
const db = testDb();

let manager: TestActor;
let otherManager: TestActor;
let worker: TestActor;
let otherWorker: TestActor;

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(32).fill(7)]);

async function createTask(assignee: TestActor = worker): Promise<string> {
  const res = await request(app)
    .post('/api/v1/tasks')
    .auth(manager.token, { type: 'bearer' })
    .send({
      title: 'Replace water meter',
      description: 'Old meter leaking.',
      workerId: assignee.id,
      location: { address: '14 Harbour Rd' },
    });
  return res.body.id as string;
}

/** Pushes are sent after the response, so wait for the queued work to run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(async () => {
  await truncateAll();
  testPush.reset();
  manager = await createManager({ name: 'Anita Rao' });
  otherManager = await createManager({ name: 'Ravi Shah' });
  worker = await createWorker({ name: 'Priya Nair' });
  otherWorker = await createWorker({ name: 'Sam Lee' });
});

afterAll(closeTestDb);

describe('POST /api/v1/users/me/push-tokens', () => {
  it('registers a device for the signed-in user', async () => {
    const res = await request(app)
      .post('/api/v1/users/me/push-tokens')
      .auth(worker.token, { type: 'bearer' })
      .send({ token: 'ExponentPushToken[worker-device]', platform: 'android' });

    expect(res.status).toBe(204);
    const rows = await db
      .select()
      .from(devicePushTokens)
      .where(eq(devicePushTokens.userId, worker.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.platform).toBe('android');
  });

  it('moves a shared device to whoever logs in last', async () => {
    const token = 'ExponentPushToken[shared-phone]';
    await request(app)
      .post('/api/v1/users/me/push-tokens')
      .auth(worker.token, { type: 'bearer' })
      .send({ token, platform: 'android' });
    await request(app)
      .post('/api/v1/users/me/push-tokens')
      .auth(otherWorker.token, { type: 'bearer' })
      .send({ token, platform: 'android' });

    const rows = await db.select().from(devicePushTokens).where(eq(devicePushTokens.token, token));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(otherWorker.id);
  });

  it('registering the same device twice does not duplicate it', async () => {
    const token = 'ExponentPushToken[same-device]';
    for (let i = 0; i < 2; i += 1) {
      await request(app)
        .post('/api/v1/users/me/push-tokens')
        .auth(worker.token, { type: 'bearer' })
        .send({ token, platform: 'ios' });
    }
    const rows = await db.select().from(devicePushTokens);
    expect(rows).toHaveLength(1);
  });

  it.each([
    ['not an Expo token', { token: 'abc123', platform: 'android' }],
    ['unknown platform', { token: 'ExponentPushToken[x]', platform: 'web' }],
    ['missing platform', { token: 'ExponentPushToken[x]' }],
  ])('rejects %s', async (_case, body) => {
    const res = await request(app)
      .post('/api/v1/users/me/push-tokens')
      .auth(worker.token, { type: 'bearer' })
      .send(body);
    expect(res.status).toBe(422);
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/v1/users/me/push-tokens')
      .send({ token: 'ExponentPushToken[x]', platform: 'ios' });
    expect(res.status).toBe(401);
  });
});

describe('push triggers', () => {
  it('notifies the worker when a task is assigned to them', async () => {
    const taskId = await createTask();
    await settle();

    expect(testPush.sent).toHaveLength(1);
    expect(testPush.sent[0]).toMatchObject({
      userIds: [worker.id],
      message: {
        type: 'TASK_ASSIGNED',
        taskId,
        title: 'New task assigned',
        body: 'Replace water meter',
      },
    });
  });

  it('notifies the new worker on reassignment', async () => {
    const taskId = await createTask();
    testPush.reset();

    await request(app)
      .post(`/api/v1/tasks/${taskId}/assignment`)
      .auth(manager.token, { type: 'bearer' })
      .send({ workerId: otherWorker.id });
    await settle();

    expect(testPush.sent).toHaveLength(1);
    expect(testPush.sent[0]).toMatchObject({
      userIds: [otherWorker.id],
      message: { type: 'TASK_ASSIGNED' },
    });
  });

  it('notifies the assigned worker when the manager edits the task', async () => {
    const taskId = await createTask();
    testPush.reset();

    await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .auth(manager.token, { type: 'bearer' })
      .send({ title: 'Replace water meter at Block D' });
    await settle();

    expect(testPush.sent).toHaveLength(1);
    expect(testPush.sent[0]).toMatchObject({
      userIds: [worker.id],
      message: {
        type: 'TASK_UPDATED',
        title: 'Task updated',
        body: 'Replace water meter at Block D',
      },
    });
  });

  it('sends nothing when an edit changes nothing', async () => {
    const taskId = await createTask();
    testPush.reset();

    await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .auth(manager.token, { type: 'bearer' })
      .send({ title: 'Replace water meter' });
    await settle();

    expect(testPush.sent).toHaveLength(0);
  });

  it('does not notify about an edit to a rejected task', async () => {
    const taskId = await createTask();
    await request(app)
      .post(`/api/v1/tasks/${taskId}/reject`)
      .auth(worker.token, { type: 'bearer' })
      .send({ reason: 'Site locked' });
    testPush.reset();

    await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .auth(manager.token, { type: 'bearer' })
      .send({ title: 'Updated while rejected' });
    await settle();

    expect(testPush.sent).toHaveLength(0);
  });

  it('notifies every other manager when a worker completes a task', async () => {
    const taskId = await createTask();
    await request(app).post(`/api/v1/tasks/${taskId}/start`).auth(worker.token, { type: 'bearer' });
    await request(app)
      .post(`/api/v1/tasks/${taskId}/evidence`)
      .auth(worker.token, { type: 'bearer' })
      .attach('photo', JPEG, 'photo.jpg');
    testPush.reset();

    await request(app)
      .post(`/api/v1/tasks/${taskId}/complete`)
      .auth(worker.token, { type: 'bearer' });
    await settle();

    expect(testPush.sent).toHaveLength(1);
    const sent = testPush.sent[0]!;
    expect(sent.userIds.sort()).toEqual([manager.id, otherManager.id].sort());
    expect(sent.message).toMatchObject({
      type: 'TASK_COMPLETED',
      title: 'Task completed',
      body: 'Replace water meter · by Priya Nair',
    });
  });

  it('does not notify the manager who completed the task themselves', async () => {
    const taskId = await createTask();
    await forceStatus(taskId, 'IN_PROGRESS');
    await request(app)
      .post(`/api/v1/tasks/${taskId}/evidence`)
      .auth(worker.token, { type: 'bearer' })
      .attach('photo', JPEG, 'photo.jpg')
      .catch(() => undefined);
    testPush.reset();

    await request(app)
      .post(`/api/v1/tasks/${taskId}/complete`)
      .auth(manager.token, { type: 'bearer' });
    await settle();

    expect(testPush.sent[0]?.userIds).toEqual([otherManager.id]);
  });

  it.each([
    [
      'cancel',
      async (taskId: string) =>
        request(app).post(`/api/v1/tasks/${taskId}/cancel`).auth(manager.token, { type: 'bearer' }),
    ],
    [
      'start',
      async (taskId: string) =>
        request(app).post(`/api/v1/tasks/${taskId}/start`).auth(worker.token, { type: 'bearer' }),
    ],
    [
      'reject',
      async (taskId: string) =>
        request(app)
          .post(`/api/v1/tasks/${taskId}/reject`)
          .auth(worker.token, { type: 'bearer' })
          .send({ reason: 'No access' }),
    ],
  ])('sends no push for %s', async (_action, run) => {
    const taskId = await createTask();
    testPush.reset();

    await run(taskId);
    await settle();

    expect(testPush.sent).toHaveLength(0);
  });

  it('a failing push never fails the action that triggered it', async () => {
    testPush.failNext();

    const res = await request(app)
      .post('/api/v1/tasks')
      .auth(manager.token, { type: 'bearer' })
      .send({
        title: 'Push service is down',
        description: 'The task must still be created.',
        workerId: worker.id,
        location: { address: 'Depot' },
      });
    await settle();

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ASSIGNED');
  });
});
