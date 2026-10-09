import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createTestApp, testPush } from '../helpers/app.js';
import { createManager, createWorker, type TestActor } from '../helpers/auth.js';
import { closeTestDb, forceStatus, truncateAll } from '../helpers/db.js';

const app = createTestApp();

let manager: TestActor;
let worker: TestActor;
let otherWorker: TestActor;

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(32).fill(7)]);

async function createTask(): Promise<string> {
  const res = await request(app)
    .post('/api/v1/tasks')
    .auth(manager.token, { type: 'bearer' })
    .send({
      title: 'Replace water meter',
      description: 'Old meter leaking.',
      workerId: worker.id,
      location: { address: '14 Harbour Rd' },
    });
  return res.body.id as string;
}

const post = (actor: TestActor, taskId: string, action: string, body?: object) => {
  const req = request(app)
    .post(`/api/v1/tasks/${taskId}/${action}`)
    .auth(actor.token, { type: 'bearer' });
  return body ? req.send(body) : req;
};

const get = (actor: TestActor, taskId: string) =>
  request(app).get(`/api/v1/tasks/${taskId}`).auth(actor.token, { type: 'bearer' });

/** A task in progress with the one photo completion requires. */
async function submittable(): Promise<string> {
  const taskId = await createTask();
  await forceStatus(taskId, 'IN_PROGRESS');
  await request(app)
    .post(`/api/v1/tasks/${taskId}/evidence`)
    .auth(worker.token, { type: 'bearer' })
    .attach('photo', JPEG, 'photo.jpg');
  return taskId;
}

async function submitted(): Promise<string> {
  const taskId = await submittable();
  await post(worker, taskId, 'complete');
  return taskId;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

beforeEach(async () => {
  await truncateAll();
  testPush.reset();
  manager = await createManager({ name: 'Anita Rao' });
  worker = await createWorker({ name: 'Priya Nair' });
  otherWorker = await createWorker({ name: 'Sam Lee' });
});

afterAll(closeTestDb);

describe('manager review (F-008)', () => {
  it('still needs a photo before the work can be handed over', async () => {
    const taskId = await createTask();
    await forceStatus(taskId, 'IN_PROGRESS');

    const res = await post(worker, taskId, 'complete');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EVIDENCE_REQUIRED');
  });

  it('approves submitted work', async () => {
    const taskId = await submitted();

    const res = await post(manager, taskId, 'approve');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.completedAt).not.toBeNull();
    expect(res.body.review).toMatchObject({ note: null });
    expect(res.body.review.reviewedBy).toMatchObject({ id: manager.id, name: 'Anita Rao' });
    expect(res.body.review.reviewedAt).not.toBeNull();
  });

  it('hands work back to in progress with the reason', async () => {
    const taskId = await submitted();

    const res = await post(manager, taskId, 'request-changes', {
      note: 'The serial number is not readable.',
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_PROGRESS');
    expect(res.body.completedAt).toBeNull();
    expect(res.body.review.note).toBe('The serial number is not readable.');

    // The worker can read what was asked, and act on it again.
    const forWorker = await get(worker, taskId);
    expect(forWorker.body.review.note).toBe('The serial number is not readable.');

    const note = await post(worker, taskId, 'notes', { content: 'Retaken, serial visible.' });
    expect(note.status).toBe(201);
  });

  it('keeps the note through a resubmission, then clears it on approval', async () => {
    const taskId = await submitted();
    await post(manager, taskId, 'request-changes', { note: 'Retake the photo.' });

    const resubmitted = await post(worker, taskId, 'complete');
    expect(resubmitted.status).toBe(200);
    expect(resubmitted.body.status).toBe('AWAITING_REVIEW');
    // Cleared on submit: the review it belonged to is over.
    expect(resubmitted.body.review.note).toBeNull();

    const approved = await post(manager, taskId, 'approve');
    expect(approved.body.review.note).toBeNull();
  });

  it('will not review work nobody has submitted', async () => {
    const taskId = await submittable();

    expect((await post(manager, taskId, 'approve')).status).toBe(409);
    expect((await post(manager, taskId, 'request-changes', { note: 'x' })).status).toBe(409);
  });

  it('will not review the same work twice', async () => {
    const taskId = await submitted();
    await post(manager, taskId, 'approve');

    expect((await post(manager, taskId, 'approve')).status).toBe(409);
  });

  it('requires a reason when handing work back', async () => {
    const taskId = await submitted();

    for (const body of [{}, { note: '   ' }]) {
      const res = await post(manager, taskId, 'request-changes', body);
      expect(res.status).toBe(422);
    }
  });

  it('is closed to workers', async () => {
    const taskId = await submitted();

    expect((await post(worker, taskId, 'approve')).status).toBe(403);
    expect((await post(worker, taskId, 'request-changes', { note: 'x' })).status).toBe(403);
    // And to a worker who does not hold the task at all.
    expect((await post(otherWorker, taskId, 'approve')).status).toBe(403);
  });

  it('stops the worker changing work they have handed over', async () => {
    const taskId = await submitted();

    expect((await post(worker, taskId, 'notes', { content: 'late' })).status).toBe(409);
    const photo = await request(app)
      .post(`/api/v1/tasks/${taskId}/evidence`)
      .auth(worker.token, { type: 'bearer' })
      .attach('photo', JPEG, 'photo.jpg');
    expect(photo.status).toBe(409);
    expect((await post(worker, taskId, 'complete')).status).toBe(409);
  });

  it('lets a manager finish the work themselves without a review', async () => {
    const taskId = await submittable();

    const res = await post(manager, taskId, 'complete');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.review.submittedAt).toBeNull();
  });

  it('clears the review when the task is reassigned', async () => {
    const taskId = await submitted();
    await post(manager, taskId, 'request-changes', { note: 'Retake the photo.' });

    const res = await request(app)
      .post(`/api/v1/tasks/${taskId}/assignment`)
      .auth(manager.token, { type: 'bearer' })
      .send({ workerId: otherWorker.id });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ASSIGNED');
    // The new worker inherits no judgement of someone else's attempt.
    expect(res.body.review).toMatchObject({
      submittedAt: null,
      reviewedAt: null,
      reviewedBy: null,
      note: null,
    });
  });

  it('can still be cancelled while it waits', async () => {
    const taskId = await submitted();

    const res = await post(manager, taskId, 'cancel');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  it('tells the worker when the work comes back, and when it is accepted', async () => {
    const taskId = await submitted();
    testPush.reset();

    await post(manager, taskId, 'request-changes', { note: 'Retake the photo.' });
    await settle();
    expect(testPush.sent[0]?.userIds).toEqual([worker.id]);
    expect(testPush.sent[0]?.message).toMatchObject({
      type: 'TASK_CHANGES_REQUESTED',
      title: 'Changes requested',
      body: 'Replace water meter · Retake the photo.',
    });

    await post(worker, taskId, 'complete');
    testPush.reset();
    await post(manager, taskId, 'approve');
    await settle();
    expect(testPush.sent[0]?.userIds).toEqual([worker.id]);
    expect(testPush.sent[0]?.message.type).toBe('TASK_COMPLETED');
  });
});
