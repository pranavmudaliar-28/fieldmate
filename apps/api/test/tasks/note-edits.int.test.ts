import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from '../helpers/app.js';
import { createManager, createWorker, type TestActor } from '../helpers/auth.js';
import { closeTestDb, forceStatus, truncateAll } from '../helpers/db.js';

const app = createTestApp();

let manager: TestActor;
let worker: TestActor;
let otherWorker: TestActor;

async function inProgressTask(assignee: TestActor): Promise<string> {
  const res = await request(app)
    .post('/api/v1/tasks')
    .auth(manager.token, { type: 'bearer' })
    .send({
      title: 'Replace water meter',
      description: 'Old meter leaking.',
      workerId: assignee.id,
      location: { address: '14 Harbour Rd' },
    });
  const taskId = res.body.id as string;
  await forceStatus(taskId, 'IN_PROGRESS');
  return taskId;
}

const addNote = (actor: TestActor, taskId: string, content: string) =>
  request(app)
    .post(`/api/v1/tasks/${taskId}/notes`)
    .auth(actor.token, { type: 'bearer' })
    .send({ content });

const editNote = (actor: TestActor, taskId: string, noteId: string, content: string) =>
  request(app)
    .patch(`/api/v1/tasks/${taskId}/notes/${noteId}`)
    .auth(actor.token, { type: 'bearer' })
    .send({ content });

const deleteNote = (actor: TestActor, taskId: string, noteId: string) =>
  request(app).delete(`/api/v1/tasks/${taskId}/notes/${noteId}`).auth(actor.token, {
    type: 'bearer',
  });

const notesOf = async (taskId: string) =>
  (await request(app).get(`/api/v1/tasks/${taskId}`).auth(manager.token, { type: 'bearer' })).body
    .notes;

beforeEach(async () => {
  await truncateAll();
  manager = await createManager({ name: 'Anita Rao' });
  worker = await createWorker({ name: 'Priya Nair' });
  otherWorker = await createWorker({ name: 'Sam Lee' });
});

afterAll(closeTestDb);

describe('editing and deleting notes (F-007)', () => {
  it('keeps a note sent twice under the same id only once', async () => {
    const taskId = await inProgressTask(worker);
    const id = '0b6e1c9a-2f43-4d1e-9a6b-5c7d8e9f0a1b';
    const send = () =>
      request(app)
        .post(`/api/v1/tasks/${taskId}/notes`)
        .auth(worker.token, { type: 'bearer' })
        .send({ id, content: 'Meter replaced.' });

    expect((await send()).status).toBe(201);
    const again = await send();

    expect(again.status).toBe(201);
    expect(again.body.id).toBe(id);
    expect(await notesOf(taskId)).toHaveLength(1);
  });

  it('edits a note by the id the app gave it, as an offline edit does', async () => {
    const taskId = await inProgressTask(worker);
    const id = '0b6e1c9a-2f43-4d1e-9a6b-5c7d8e9f0a1c';
    await request(app)
      .post(`/api/v1/tasks/${taskId}/notes`)
      .auth(worker.token, { type: 'bearer' })
      .send({ id, content: 'Meter replaced.' });

    const res = await editNote(worker, taskId, id, 'Meter and valve replaced.');

    expect(res.status).toBe(200);
  });

  it('will not let another worker reuse a note id', async () => {
    const taskId = await inProgressTask(worker);
    const otherTask = await inProgressTask(otherWorker);
    const id = '0b6e1c9a-2f43-4d1e-9a6b-5c7d8e9f0a1d';
    await request(app)
      .post(`/api/v1/tasks/${taskId}/notes`)
      .auth(worker.token, { type: 'bearer' })
      .send({ id, content: 'Mine.' });

    const res = await request(app)
      .post(`/api/v1/tasks/${otherTask}/notes`)
      .auth(otherWorker.token, { type: 'bearer' })
      .send({ id, content: 'Theirs.' });

    expect(res.status).toBe(400);
  });

  it('leaves a new note marked as never edited', async () => {
    const taskId = await inProgressTask(worker);

    const res = await addNote(worker, taskId, 'Meter replaced.');
    expect(res.status).toBe(201);
    expect(res.body.updatedAt).toBeNull();
  });

  it('edits the author own note and says that it changed', async () => {
    const taskId = await inProgressTask(worker);
    const { body: note } = await addNote(worker, taskId, 'Meter replced.');

    const res = await editNote(worker, taskId, note.id, 'Meter replaced.');
    expect(res.status).toBe(200);
    expect(res.body.content).toBe('Meter replaced.');
    // Notes were append-only so the record could not be quietly rewritten; the
    // timestamp is what keeps an edit visible as one.
    expect(res.body.updatedAt).not.toBeNull();
    expect(res.body.createdAt).toBe(note.createdAt);

    const [stored] = await notesOf(taskId);
    expect(stored.content).toBe('Meter replaced.');
    expect(stored.updatedAt).not.toBeNull();
  });

  it('deletes the author own note', async () => {
    const taskId = await inProgressTask(worker);
    const { body: note } = await addNote(worker, taskId, 'Added by mistake.');

    expect((await deleteNote(worker, taskId, note.id)).status).toBe(204);
    expect(await notesOf(taskId)).toHaveLength(0);
  });

  it('reports another worker note as missing, never as forbidden', async () => {
    const mine = await inProgressTask(worker);
    const theirs = await inProgressTask(otherWorker);
    const { body: note } = await addNote(otherWorker, theirs, 'Theirs.');

    // Through their own task, which this worker cannot see at all.
    expect((await editNote(worker, theirs, note.id, 'Mine now')).status).toBe(404);
    // And through a task they do hold, where the note simply is not theirs.
    expect((await editNote(worker, mine, note.id, 'Mine now')).status).toBe(404);
    expect((await deleteNote(worker, mine, note.id)).status).toBe(404);

    const [untouched] = await notesOf(theirs);
    expect(untouched.content).toBe('Theirs.');
  });

  it('is closed to managers, who have no notes of their own', async () => {
    const taskId = await inProgressTask(worker);
    const { body: note } = await addNote(worker, taskId, 'Meter replaced.');

    expect((await editNote(manager, taskId, note.id, 'Edited')).status).toBe(403);
    expect((await deleteNote(manager, taskId, note.id)).status).toBe(403);
  });

  it('stops once the work is handed over', async () => {
    const taskId = await inProgressTask(worker);
    const { body: note } = await addNote(worker, taskId, 'Meter replaced.');
    await forceStatus(taskId, 'AWAITING_REVIEW');

    expect((await editNote(worker, taskId, note.id, 'Edited')).status).toBe(409);
    expect((await deleteNote(worker, taskId, note.id)).status).toBe(409);
  });

  it('will not accept an empty edit', async () => {
    const taskId = await inProgressTask(worker);
    const { body: note } = await addNote(worker, taskId, 'Meter replaced.');

    for (const content of ['', '   ']) {
      expect((await editNote(worker, taskId, note.id, content)).status).toBe(422);
    }
  });

  it('404s on a note that does not exist', async () => {
    const taskId = await inProgressTask(worker);
    const missing = '00000000-0000-4000-8000-000000000000';

    expect((await editNote(worker, taskId, missing, 'Edited')).status).toBe(404);
    expect((await deleteNote(worker, taskId, missing)).status).toBe(404);
  });
});
