import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { taskAssignments, taskEvidence } from '../../src/db/schema.js';
import { createTestApp, testStorage } from '../helpers/app.js';
import { createManager, createWorker, type TestActor } from '../helpers/auth.js';
import { closeTestDb, forceStatus, testDb, truncateAll } from '../helpers/db.js';

const app = createTestApp();
const db = testDb();

let manager: TestActor;
let worker: TestActor;
let otherWorker: TestActor;

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(64).fill(0x2a)]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(1)]);
const GIF = Buffer.from('GIF89a-not-a-real-photo');

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

/** Walks the worker's lifecycle: accept → depart → arrive → start. */
async function walk(taskId: string, assignee: TestActor, ...steps: string[]): Promise<void> {
  for (const step of steps) {
    await request(app)
      .post(`/api/v1/tasks/${taskId}/${step}`)
      .auth(assignee.token, { type: 'bearer' });
  }
}

/** A task the worker has accepted, travelled to and begun working on. */
async function startedTask(assignee: TestActor = worker): Promise<string> {
  const taskId = await createTask(assignee);
  await walk(taskId, assignee, 'accept', 'depart', 'arrive', 'start');
  return taskId;
}

/** A task parked at the given status, for testing one step at a time. */
async function taskAt(status: string, assignee: TestActor = worker): Promise<string> {
  const taskId = await createTask(assignee);
  const steps = ['accept', 'depart', 'arrive', 'start'];
  const upTo = { ACCEPTED: 1, GOING_TO_LOCATION: 2, REACHED_LOCATION: 3, IN_PROGRESS: 4 }[status];
  if (upTo === undefined) throw new Error('Unsupported status: ' + status);
  await walk(taskId, assignee, ...steps.slice(0, upTo));
  return taskId;
}

const uploadPhoto = (actor: TestActor, taskId: string, photo = JPEG, filename = 'photo.jpg') =>
  request(app)
    .post(`/api/v1/tasks/${taskId}/evidence`)
    .auth(actor.token, { type: 'bearer' })
    .attach('photo', photo, filename);

beforeEach(async () => {
  await truncateAll();
  testStorage.objects.clear();
  manager = await createManager();
  worker = await createWorker({ name: 'Priya Nair' });
  otherWorker = await createWorker({ name: 'Sam Lee' });
});

afterAll(closeTestDb);

describe('the worker lifecycle', () => {
  it('walks assigned → accepted → going → reached → in progress', async () => {
    const taskId = await createTask();
    const post = (step: string) =>
      request(app).post(`/api/v1/tasks/${taskId}/${step}`).auth(worker.token, { type: 'bearer' });

    expect((await post('accept')).body.status).toBe('ACCEPTED');
    expect((await post('depart')).body.status).toBe('GOING_TO_LOCATION');
    expect((await post('arrive')).body.status).toBe('REACHED_LOCATION');

    const started = await post('start');
    expect(started.status).toBe(200);
    expect(started.body.status).toBe('IN_PROGRESS');
  });

  /** The rule this lifecycle exists to enforce. */
  it.each(['ASSIGNED', 'ACCEPTED', 'GOING_TO_LOCATION'])(
    'refuses to start work from %s',
    async (status) => {
      const taskId = status === 'ASSIGNED' ? await createTask() : await taskAt(status);
      const res = await request(app)
        .post(`/api/v1/tasks/${taskId}/start`)
        .auth(worker.token, { type: 'bearer' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    },
  );

  it('records when each step happened', async () => {
    const taskId = await taskAt('IN_PROGRESS');
    const res = await request(app)
      .get(`/api/v1/tasks/${taskId}`)
      .auth(worker.token, { type: 'bearer' });

    const { acceptedAt, departedAt, arrivedAt, startedAt } = res.body.progress;
    for (const stamp of [acceptedAt, departedAt, arrivedAt, startedAt]) {
      expect(typeof stamp).toBe('string');
    }
    // The database clock stamps them, so they can only run forwards.
    expect(new Date(departedAt).getTime()).toBeGreaterThanOrEqual(new Date(acceptedAt).getTime());
    expect(new Date(arrivedAt).getTime()).toBeGreaterThanOrEqual(new Date(departedAt).getTime());
    expect(new Date(startedAt).getTime()).toBeGreaterThanOrEqual(new Date(arrivedAt).getTime());
  });

  it('undoes one step and clears the stamp it set', async () => {
    const taskId = await taskAt('REACHED_LOCATION');
    const res = await request(app)
      .post(`/api/v1/tasks/${taskId}/step-back`)
      .auth(worker.token, { type: 'bearer' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('GOING_TO_LOCATION');
    expect(res.body.progress.arrivedAt).toBeNull();
    expect(res.body.progress.departedAt).not.toBeNull();
  });

  it('cannot undo once the work has started', async () => {
    const taskId = await taskAt('IN_PROGRESS');
    const res = await request(app)
      .post(`/api/v1/tasks/${taskId}/step-back`)
      .auth(worker.token, { type: 'bearer' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('cannot start twice', async () => {
    const taskId = await startedTask();
    const res = await request(app)
      .post(`/api/v1/tasks/${taskId}/start`)
      .auth(worker.token, { type: 'bearer' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('forbids managers and hides the task from other workers', async () => {
    const taskId = await taskAt('REACHED_LOCATION');

    const asManager = await request(app)
      .post(`/api/v1/tasks/${taskId}/start`)
      .auth(manager.token, { type: 'bearer' });
    expect(asManager.status).toBe(403);

    const asOther = await request(app)
      .post(`/api/v1/tasks/${taskId}/start`)
      .auth(otherWorker.token, { type: 'bearer' });
    expect(asOther.status).toBe(404);
  });
});

describe('POST /tasks/:id/reject', () => {
  it('records the reason, hides the task from the worker and shows it to the manager', async () => {
    const taskId = await createTask();

    const res = await request(app)
      .post(`/api/v1/tasks/${taskId}/reject`)
      .auth(worker.token, { type: 'bearer' })
      .send({ reason: 'Site locked, no key' });
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});

    const forWorker = await request(app)
      .get(`/api/v1/tasks/${taskId}`)
      .auth(worker.token, { type: 'bearer' });
    expect(forWorker.status).toBe(200); // still the current assignee
    expect(forWorker.body.status).toBe('REJECTED');

    const list = await request(app).get('/api/v1/tasks').auth(worker.token, { type: 'bearer' });
    expect(list.body.items).toHaveLength(0);

    const forManager = await request(app)
      .get(`/api/v1/tasks/${taskId}`)
      .auth(manager.token, { type: 'bearer' });
    expect(forManager.body.assignment.rejection).toMatchObject({ reason: 'Site locked, no key' });
  });

  it('requires a reason', async () => {
    const taskId = await createTask();
    for (const body of [{}, { reason: '   ' }]) {
      const res = await request(app)
        .post(`/api/v1/tasks/${taskId}/reject`)
        .auth(worker.token, { type: 'bearer' })
        .send(body);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('cannot reject a task that has been started', async () => {
    const taskId = await startedTask();
    const res = await request(app)
      .post(`/api/v1/tasks/${taskId}/reject`)
      .auth(worker.token, { type: 'bearer' })
      .send({ reason: 'Changed my mind' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('forbids managers from rejecting', async () => {
    const taskId = await createTask();
    const res = await request(app)
      .post(`/api/v1/tasks/${taskId}/reject`)
      .auth(manager.token, { type: 'bearer' })
      .send({ reason: 'Nope' });
    expect(res.status).toBe(403);
  });
});

describe('POST /tasks/:id/evidence', () => {
  it('stores a JPEG and returns it with a link', async () => {
    const taskId = await startedTask();
    const res = await uploadPhoto(worker, taskId);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      fileType: 'image/jpeg',
      uploadedBy: { id: worker.id, name: 'Priya Nair' },
    });
    expect(res.body.url).toContain('https://storage.test/');
    expect(JSON.stringify(res.body)).not.toContain('fileKey');
    expect(testStorage.objects.size).toBe(1);
  });

  it('accepts a PNG', async () => {
    const taskId = await startedTask();
    const res = await uploadPhoto(worker, taskId, PNG, 'photo.png');
    expect(res.status).toBe(201);
    expect(res.body.fileType).toBe('image/png');
  });

  it('shows the photo on the task detail', async () => {
    const taskId = await startedTask();
    await uploadPhoto(worker, taskId);

    const res = await request(app)
      .get(`/api/v1/tasks/${taskId}`)
      .auth(manager.token, { type: 'bearer' });
    expect(res.body.evidence).toHaveLength(1);
    expect(res.body.evidence[0].uploadedBy.name).toBe('Priya Nair');
  });

  it('rejects a file that is not really an image, whatever it is called', async () => {
    const taskId = await startedTask();
    const res = await uploadPhoto(worker, taskId, GIF, 'photo.jpg');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_FILE');
    expect(testStorage.objects.size).toBe(0);
  });

  it('rejects a request with no file', async () => {
    const taskId = await startedTask();
    const res = await request(app)
      .post(`/api/v1/tasks/${taskId}/evidence`)
      .auth(worker.token, { type: 'bearer' })
      .field('note', 'no photo here');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_FILE');
  });

  it('rejects a photo larger than 10 MB', async () => {
    const taskId = await startedTask();
    const large = Buffer.concat([JPEG, Buffer.alloc(10 * 1024 * 1024)]);
    const res = await uploadPhoto(worker, taskId, large);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_FILE');
    expect(res.body.error.message).toMatch(/10 MB/);
  });

  it('only allows the assigned worker while the task is in progress', async () => {
    const assignedOnly = await createTask();
    const notStarted = await uploadPhoto(worker, assignedOnly);
    expect(notStarted.status).toBe(409);

    const started = await startedTask();
    expect((await uploadPhoto(manager, started)).status).toBe(403);
    expect((await uploadPhoto(otherWorker, started)).status).toBe(404);
  });

  it('cannot add photos once the task is completed', async () => {
    const taskId = await startedTask();
    await uploadPhoto(worker, taskId);
    await request(app)
      .post(`/api/v1/tasks/${taskId}/complete`)
      .auth(worker.token, { type: 'bearer' });

    const res = await uploadPhoto(worker, taskId);
    expect(res.status).toBe(409);
  });
});

describe('DELETE /tasks/:id/evidence/:evidenceId', () => {
  it('deletes the worker own photo and removes the stored object', async () => {
    const taskId = await startedTask();
    const { body: photo } = await uploadPhoto(worker, taskId);

    const res = await request(app)
      .delete(`/api/v1/tasks/${taskId}/evidence/${photo.id}`)
      .auth(worker.token, { type: 'bearer' });

    expect(res.status).toBe(204);
    expect(testStorage.objects.size).toBe(0);
    const rows = await db.select().from(taskEvidence).where(eq(taskEvidence.taskId, taskId));
    expect(rows).toHaveLength(0);
  });

  it('refuses to delete a photo taken by someone else', async () => {
    const taskId = await startedTask();
    const { body: photo } = await uploadPhoto(worker, taskId);

    // The task moves to the other worker, who may not delete the first worker's photo.
    await request(app)
      .post(`/api/v1/tasks/${taskId}/assignment`)
      .auth(manager.token, { type: 'bearer' })
      .send({ workerId: otherWorker.id });
    await walk(taskId, otherWorker, 'accept', 'depart', 'arrive', 'start');

    const res = await request(app)
      .delete(`/api/v1/tasks/${taskId}/evidence/${photo.id}`)
      .auth(otherWorker.token, { type: 'bearer' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 for an unknown photo or one from another task', async () => {
    const taskId = await startedTask();
    const otherTaskId = await startedTask(otherWorker);
    const { body: otherPhoto } = await uploadPhoto(otherWorker, otherTaskId);

    const unknown = await request(app)
      .delete(`/api/v1/tasks/${taskId}/evidence/00000000-0000-4000-8000-000000000000`)
      .auth(worker.token, { type: 'bearer' });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('EVIDENCE_NOT_FOUND');

    const crossTask = await request(app)
      .delete(`/api/v1/tasks/${taskId}/evidence/${otherPhoto.id}`)
      .auth(worker.token, { type: 'bearer' });
    expect(crossTask.status).toBe(404);
  });

  it('cannot delete a photo after the task is completed', async () => {
    const taskId = await startedTask();
    const { body: photo } = await uploadPhoto(worker, taskId);
    await request(app)
      .post(`/api/v1/tasks/${taskId}/complete`)
      .auth(worker.token, { type: 'bearer' });

    const res = await request(app)
      .delete(`/api/v1/tasks/${taskId}/evidence/${photo.id}`)
      .auth(worker.token, { type: 'bearer' });

    expect(res.status).toBe(409);
    expect(testStorage.objects.size).toBe(1);
  });

  it('forbids managers from deleting photos', async () => {
    const taskId = await startedTask();
    const { body: photo } = await uploadPhoto(worker, taskId);

    const res = await request(app)
      .delete(`/api/v1/tasks/${taskId}/evidence/${photo.id}`)
      .auth(manager.token, { type: 'bearer' });
    expect(res.status).toBe(403);
  });
});

describe('POST /tasks/:id/notes', () => {
  it('adds a note and shows it on the task', async () => {
    const taskId = await startedTask();
    const res = await request(app)
      .post(`/api/v1/tasks/${taskId}/notes`)
      .auth(worker.token, { type: 'bearer' })
      .send({ content: '  Replaced valve first.  ' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      content: 'Replaced valve first.',
      createdBy: { id: worker.id, name: 'Priya Nair' },
    });

    const detail = await request(app)
      .get(`/api/v1/tasks/${taskId}`)
      .auth(manager.token, { type: 'bearer' });
    expect(detail.body.notes).toHaveLength(1);
  });

  it('keeps several notes in order', async () => {
    const taskId = await startedTask();
    for (const content of ['First note', 'Second note', 'Third note']) {
      await request(app)
        .post(`/api/v1/tasks/${taskId}/notes`)
        .auth(worker.token, { type: 'bearer' })
        .send({ content });
    }

    const detail = await request(app)
      .get(`/api/v1/tasks/${taskId}`)
      .auth(worker.token, { type: 'bearer' });
    expect(detail.body.notes.map((n: { content: string }) => n.content)).toEqual([
      'First note',
      'Second note',
      'Third note',
    ]);
  });

  it('rejects blank or oversized content', async () => {
    const taskId = await startedTask();
    for (const content of ['', '   ', 'x'.repeat(5001)]) {
      const res = await request(app)
        .post(`/api/v1/tasks/${taskId}/notes`)
        .auth(worker.token, { type: 'bearer' })
        .send({ content });
      expect(res.status).toBe(422);
    }
  });

  it('only the assigned worker may add notes, and only while in progress', async () => {
    const assignedOnly = await createTask();
    const notStarted = await request(app)
      .post(`/api/v1/tasks/${assignedOnly}/notes`)
      .auth(worker.token, { type: 'bearer' })
      .send({ content: 'Too early' });
    expect(notStarted.status).toBe(409);

    const taskId = await startedTask();
    const asManager = await request(app)
      .post(`/api/v1/tasks/${taskId}/notes`)
      .auth(manager.token, { type: 'bearer' })
      .send({ content: 'Managers cannot add notes' });
    expect(asManager.status).toBe(403);

    const asOther = await request(app)
      .post(`/api/v1/tasks/${taskId}/notes`)
      .auth(otherWorker.token, { type: 'bearer' })
      .send({ content: 'Not my task' });
    expect(asOther.status).toBe(404);
  });
});

describe('worker completion flow end to end', () => {
  it('accept → travel → start → photo → note → complete', async () => {
    const taskId = await createTask();
    await walk(taskId, worker, 'accept', 'depart', 'arrive');

    expect(
      (
        await request(app)
          .post(`/api/v1/tasks/${taskId}/start`)
          .auth(worker.token, { type: 'bearer' })
      ).status,
    ).toBe(200);

    const tooEarly = await request(app)
      .post(`/api/v1/tasks/${taskId}/complete`)
      .auth(worker.token, { type: 'bearer' });
    expect(tooEarly.status).toBe(409);
    expect(tooEarly.body.error.code).toBe('EVIDENCE_REQUIRED');

    await uploadPhoto(worker, taskId);
    await request(app)
      .post(`/api/v1/tasks/${taskId}/notes`)
      .auth(worker.token, { type: 'bearer' })
      .send({ content: 'Meter replaced; serial in the photo.' });

    const completed = await request(app)
      .post(`/api/v1/tasks/${taskId}/complete`)
      .auth(worker.token, { type: 'bearer' });

    expect(completed.status).toBe(200);
    expect(completed.body.status).toBe('COMPLETED');
    expect(completed.body.completedAt).not.toBeNull();
    expect(completed.body.evidence).toHaveLength(1);
    expect(completed.body.notes).toHaveLength(1);

    // The completed task stays visible to its worker.
    const list = await request(app)
      .get('/api/v1/tasks?status=COMPLETED')
      .auth(worker.token, { type: 'bearer' });
    expect(list.body.items).toHaveLength(1);
  });

  it('a reopened task starts the journey over and keeps its photos', async () => {
    const taskId = await startedTask();
    await uploadPhoto(worker, taskId);
    await request(app)
      .post(`/api/v1/tasks/${taskId}/complete`)
      .auth(worker.token, { type: 'bearer' });
    const reopened = await request(app)
      .post(`/api/v1/tasks/${taskId}/reopen`)
      .auth(manager.token, { type: 'bearer' });

    // The worker walks the lifecycle again, so the old stamps are cleared.
    expect(reopened.body.status).toBe('ASSIGNED');
    expect(reopened.body.progress).toEqual({
      acceptedAt: null,
      departedAt: null,
      arrivedAt: null,
      startedAt: null,
    });

    await walk(taskId, worker, 'accept', 'depart', 'arrive');
    const restarted = await request(app)
      .post(`/api/v1/tasks/${taskId}/start`)
      .auth(worker.token, { type: 'bearer' });

    expect(restarted.status).toBe(200);
    expect(restarted.body.status).toBe('IN_PROGRESS');
    expect(restarted.body.evidence).toHaveLength(1);
  });

  it('reassigning clears the previous worker progress', async () => {
    const taskId = await createTask();
    await walk(taskId, worker, 'accept', 'depart');

    const reassigned = await request(app)
      .post(`/api/v1/tasks/${taskId}/assignment`)
      .auth(manager.token, { type: 'bearer' })
      .send({ workerId: otherWorker.id });

    expect(reassigned.body.status).toBe('ASSIGNED');
    expect(reassigned.body.progress.acceptedAt).toBeNull();
    expect(reassigned.body.progress.departedAt).toBeNull();
  });

  it('a cancelled task refuses every worker action', async () => {
    const taskId = await startedTask();
    await forceStatus(taskId, 'CANCELLED');

    expect((await uploadPhoto(worker, taskId)).status).toBe(409);
    const note = await request(app)
      .post(`/api/v1/tasks/${taskId}/notes`)
      .auth(worker.token, { type: 'bearer' })
      .send({ content: 'Still working?' });
    expect(note.status).toBe(409);
  });

  it('a reassigned worker loses the ability to act on the task', async () => {
    const taskId = await startedTask();
    await request(app)
      .post(`/api/v1/tasks/${taskId}/assignment`)
      .auth(manager.token, { type: 'bearer' })
      .send({ workerId: otherWorker.id });

    expect((await uploadPhoto(worker, taskId)).status).toBe(404);
    const rows = await db.select().from(taskAssignments).where(eq(taskAssignments.taskId, taskId));
    expect(rows.filter((row) => row.endedAt === null)).toHaveLength(1);
  });
});
