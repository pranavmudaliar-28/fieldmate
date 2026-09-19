import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { taskAssignments, taskEvidence } from '../../src/db/schema.js';
import { createTestApp } from '../helpers/app.js';
import { createManager, createWorker, type TestActor } from '../helpers/auth.js';
import { closeTestDb, forceStatus, testDb, truncateAll } from '../helpers/db.js';

const app = createTestApp();
const db = testDb();

let manager: TestActor;
let worker: TestActor;
let otherWorker: TestActor;

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

const post = (actor: TestActor, taskId: string, action: string, body?: object) =>
  request(app)
    .post(`/api/v1/tasks/${taskId}/${action}`)
    .auth(actor.token, { type: 'bearer' })
    .send(body ?? {});

/** Puts a task into IN_PROGRESS with one photo (worker routes arrive in 6E). */
async function makeCompletable(taskId: string): Promise<void> {
  await db.insert(taskEvidence).values({
    taskId,
    uploadedBy: worker.id,
    fileKey: `tasks/${taskId}/evidence/${crypto.randomUUID()}.jpg`,
    fileType: 'image/jpeg',
  });
}

beforeEach(async () => {
  await truncateAll();
  manager = await createManager();
  worker = await createWorker({ name: 'Priya Nair' });
  otherWorker = await createWorker({ name: 'Sam Lee' });
});

afterAll(closeTestDb);

describe('POST /tasks/:id/assignment (reassign)', () => {
  it('moves the task to another worker and back to ASSIGNED', async () => {
    const taskId = await createTask();
    const res = await post(manager, taskId, 'assignment', { workerId: otherWorker.id });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ASSIGNED');
    expect(res.body.assignment.worker).toEqual({ id: otherWorker.id, name: 'Sam Lee' });
  });

  it('keeps exactly one open assignment and preserves the history', async () => {
    const taskId = await createTask();
    await post(manager, taskId, 'assignment', { workerId: otherWorker.id });

    const rows = await db.select().from(taskAssignments).where(eq(taskAssignments.taskId, taskId));

    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.endedAt === null)).toHaveLength(1);
  });

  it('rejects reassigning to the current worker', async () => {
    const taskId = await createTask();
    const res = await post(manager, taskId, 'assignment', { workerId: worker.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SAME_WORKER');
  });

  it('rejects a worker who is not a field worker', async () => {
    const taskId = await createTask();
    const res = await post(manager, taskId, 'assignment', { workerId: manager.id });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_WORKER');
  });

  it('forbids workers from reassigning', async () => {
    const taskId = await createTask();
    const res = await post(worker, taskId, 'assignment', { workerId: otherWorker.id });
    expect(res.status).toBe(403);
  });

  it('reassigns an in-progress task, sending it back to ASSIGNED', async () => {
    const taskId = await createTask();
    await forceStatus(taskId, 'IN_PROGRESS');

    const res = await post(manager, taskId, 'assignment', { workerId: otherWorker.id });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ASSIGNED');
  });

  it('allows reassigning a rejected task to the same worker', async () => {
    const taskId = await createTask();
    await forceStatus(taskId, 'REJECTED');

    const res = await post(manager, taskId, 'assignment', { workerId: worker.id });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ASSIGNED');
  });

  it.each(['COMPLETED', 'CANCELLED'] as const)('cannot reassign a %s task', async (status) => {
    const taskId = await createTask();
    await forceStatus(taskId, status);

    const res = await post(manager, taskId, 'assignment', { workerId: otherWorker.id });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });
});

describe('POST /tasks/:id/cancel', () => {
  it('cancels an assigned task', async () => {
    const taskId = await createTask();
    const res = await post(manager, taskId, 'cancel');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
    expect(res.body.completedAt).toBeNull();
  });

  it('is final: a cancelled task cannot be cancelled, edited or reopened', async () => {
    const taskId = await createTask();
    await post(manager, taskId, 'cancel');

    for (const action of ['cancel', 'reopen', 'complete']) {
      const res = await post(manager, taskId, action);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    }
  });

  it('forbids workers from cancelling', async () => {
    const taskId = await createTask();
    expect((await post(worker, taskId, 'cancel')).status).toBe(403);
  });

  it('returns 404 when a worker cancels a task that is not theirs', async () => {
    const taskId = await createTask();
    const res = await post(otherWorker, taskId, 'cancel');
    // Role check runs first, so this is a permission error rather than a leak.
    expect(res.status).toBe(403);
  });
});

describe('POST /tasks/:id/complete', () => {
  it('completes an in-progress task that has a photo', async () => {
    const taskId = await createTask();
    await forceStatus(taskId, 'IN_PROGRESS');
    await makeCompletable(taskId);

    const res = await post(worker, taskId, 'complete');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.completedAt).not.toBeNull();
  });

  it('lets a manager complete on the worker behalf', async () => {
    const taskId = await createTask();
    await forceStatus(taskId, 'IN_PROGRESS');
    await makeCompletable(taskId);

    const res = await post(manager, taskId, 'complete');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
  });

  it('refuses to complete without at least one photo, for managers too', async () => {
    const taskId = await createTask();
    await forceStatus(taskId, 'IN_PROGRESS');

    for (const actor of [worker, manager]) {
      const res = await post(actor, taskId, 'complete');
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EVIDENCE_REQUIRED');
    }
  });

  it('refuses to complete a task that is not in progress', async () => {
    const taskId = await createTask();
    await makeCompletable(taskId);

    const res = await post(manager, taskId, 'complete');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('requires authentication', async () => {
    const taskId = await createTask();
    const res = await request(app).post(`/api/v1/tasks/${taskId}/complete`);
    expect(res.status).toBe(401);
  });

  it('hides another worker task behind 404', async () => {
    const taskId = await createTask();
    const res = await post(otherWorker, taskId, 'complete');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TASK_NOT_FOUND');
  });
});

describe('POST /tasks/:id/reopen', () => {
  it('sends a completed task back to ASSIGNED with the same worker and clears completedAt', async () => {
    const taskId = await createTask();
    await forceStatus(taskId, 'IN_PROGRESS');
    await makeCompletable(taskId);
    await post(manager, taskId, 'complete');

    const res = await post(manager, taskId, 'reopen');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ASSIGNED');
    expect(res.body.completedAt).toBeNull();
    expect(res.body.assignment.worker.id).toBe(worker.id);
    // Photos taken before the reopen are kept.
    expect(res.body.evidence).toHaveLength(1);
  });

  it('cannot reopen a task that is not completed', async () => {
    const taskId = await createTask();
    const res = await post(manager, taskId, 'reopen');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('forbids workers from reopening', async () => {
    const taskId = await createTask();
    expect((await post(worker, taskId, 'reopen')).status).toBe(403);
  });
});

describe('unknown tasks', () => {
  it.each(['cancel', 'reopen', 'complete'])(
    'returns 404 for %s on a missing task',
    async (action) => {
      const res = await post(manager, '00000000-0000-4000-8000-000000000000', action);
      expect(res.status).toBe(404);
    },
  );
});
