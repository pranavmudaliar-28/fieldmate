import { ApiError } from '../../services/http';
import {
  EMPTY_QUEUE,
  blockFor,
  discardTask,
  enqueue,
  entriesFor,
  pendingCount,
  queuedTaskIds,
  unblock,
} from './queue';
import { replay, type SyncPort } from './sync';
import type { QueuedAction, QueueEntry, QueueState } from './types';

let counter = 0;
const entry = (taskId: string, action: QueuedAction): QueueEntry => ({
  id: `e${(counter += 1)}`,
  taskId,
  queuedAt: new Date(2026, 0, 1, 0, 0, counter).toISOString(),
  action,
});

const queueOf = (...entries: QueueEntry[]): QueueState => entries.reduce(enqueue, EMPTY_QUEUE);

function portThat(behaviour: (entry: QueueEntry) => void | never) {
  const saved: QueueState[] = [];
  const sent: QueueEntry[] = [];
  const forgotten: string[] = [];
  const port: SyncPort = {
    send: async (e) => {
      behaviour(e);
      sent.push(e);
    },
    forgetPhoto: (id) => forgotten.push(id),
    save: async (state) => {
      saved.push(state);
    },
  };
  return { port, saved, sent, forgotten };
}

const accepts = () => portThat(() => undefined);

beforeEach(() => {
  counter = 0;
});

describe('the queue', () => {
  it('keeps a task writes in the order they were made', () => {
    const state = queueOf(
      entry('t1', { kind: 'step', step: 'accept' }),
      entry('t2', { kind: 'step', step: 'accept' }),
      entry('t1', { kind: 'step', step: 'depart' }),
    );

    expect(entriesFor(state, 't1').map((e) => e.action)).toEqual([
      { kind: 'step', step: 'accept' },
      { kind: 'step', step: 'depart' },
    ]);
    expect(queuedTaskIds(state)).toEqual(['t1', 't2']);
    expect(pendingCount(state)).toBe(3);
  });

  it('names the photos it is about to throw away', () => {
    const state = queueOf(
      entry('t1', {
        kind: 'photo',
        photoId: 'p1',
        localUri: 'file:///q/p1',
        mimeType: 'image/jpeg',
        size: 10,
        source: 'CAMERA',
      }),
      entry('t1', { kind: 'note.add', content: 'Done' }),
      entry('t2', {
        kind: 'photo',
        photoId: 'p2',
        localUri: 'file:///q/p2',
        mimeType: 'image/jpeg',
        size: 10,
        source: 'CAMERA',
      }),
    );

    const discarded = discardTask(state)('t1');
    // So the caller can delete the files; nothing else refers to them.
    expect(discarded.photoIds).toEqual(['p1']);
    expect(queuedTaskIds(discarded.state)).toEqual(['t2']);
  });
});

describe('replaying what was queued offline', () => {
  it('sends everything and empties the queue', async () => {
    const state = queueOf(
      entry('t1', { kind: 'step', step: 'accept' }),
      entry('t1', { kind: 'note.add', content: 'Done' }),
    );
    const { port, saved, sent } = accepts();

    const outcome = await replay(state, port);

    expect(outcome).toMatchObject({ sent: 2, blocked: [], interrupted: false });
    expect(sent).toHaveLength(2);
    expect(pendingCount(saved.at(-1)!)).toBe(0);
  });

  it('deletes a photo file only once the server has it', async () => {
    const state = queueOf(
      entry('t1', {
        kind: 'photo',
        photoId: 'p1',
        localUri: 'file:///q/p1',
        mimeType: 'image/jpeg',
        size: 10,
        source: 'GALLERY',
      }),
    );
    const { port, forgotten } = accepts();

    await replay(state, port);

    expect(forgotten).toEqual(['p1']);
  });

  it('keeps the photo when the upload fails', async () => {
    const state = queueOf(
      entry('t1', {
        kind: 'photo',
        photoId: 'p1',
        localUri: 'file:///q/p1',
        mimeType: 'image/jpeg',
        size: 10,
        source: 'CAMERA',
      }),
    );
    const { port, forgotten, saved } = portThat(() => {
      throw new ApiError('NETWORK_ERROR', 'Offline');
    });

    const outcome = await replay(state, port);

    // The photograph is the work. It is never dropped for being unsent.
    expect(forgotten).toEqual([]);
    expect(outcome.interrupted).toBe(true);
    expect(saved).toHaveLength(0);
  });

  it('stops a task whose work the server will not take, and says why', async () => {
    const state = queueOf(
      entry('t1', { kind: 'step', step: 'accept' }),
      entry('t1', { kind: 'note.add', content: 'Never sent' }),
    );
    const { port, sent } = portThat(() => {
      throw new ApiError('INVALID_STATUS_TRANSITION', 'This task can no longer be updated.', 409);
    });

    const outcome = await replay(state, port);

    expect(sent).toHaveLength(0);
    expect(outcome.blocked).toHaveLength(1);
    expect(outcome.blocked[0]).toMatchObject({
      taskId: 't1',
      reason: 'This task can no longer be updated.',
    });
  });

  it('explains a task that was taken away rather than repeating a 404', async () => {
    const state = queueOf(entry('t1', { kind: 'step', step: 'start' }));
    const { port } = portThat(() => {
      throw new ApiError('TASK_NOT_FOUND', 'Task was not found.', 404);
    });

    const outcome = await replay(state, port);

    expect(outcome.blocked[0]?.reason).toBe(
      'This task is no longer assigned to you, so your offline changes were not sent.',
    );
  });

  it('leaves the other tasks alone when one is refused', async () => {
    const state = queueOf(
      entry('stale', { kind: 'step', step: 'accept' }),
      entry('fine', { kind: 'note.add', content: 'Done' }),
    );
    const { port, sent } = portThat((e) => {
      if (e.taskId === 'stale') {
        throw new ApiError('INVALID_STATUS_TRANSITION', 'Already cancelled.', 409);
      }
    });

    const outcome = await replay(state, port);

    // One stale job must not strand a day's work.
    expect(outcome.sent).toBe(1);
    expect(sent.map((e) => e.taskId)).toEqual(['fine']);
    expect(outcome.blocked.map((b) => b.taskId)).toEqual(['stale']);
  });

  it('stops the whole run when the connection goes again', async () => {
    const state = queueOf(
      entry('t1', { kind: 'step', step: 'accept' }),
      entry('t2', { kind: 'note.add', content: 'Done' }),
    );
    const { port, sent } = portThat(() => {
      throw new ApiError('NETWORK_ERROR', "Couldn't connect.");
    });

    const outcome = await replay(state, port);

    expect(sent).toHaveLength(0);
    expect(outcome).toMatchObject({ sent: 0, blocked: [], interrupted: true });
  });

  it('does not try a task the worker has already been told about', async () => {
    let state = queueOf(entry('t1', { kind: 'step', step: 'accept' }));
    const refusing = portThat(() => {
      throw new ApiError('INVALID_STATUS_TRANSITION', 'Already cancelled.', 409);
    });
    await replay(state, refusing.port);
    state = refusing.saved.at(-1)!;
    expect(blockFor(state, 't1')).toBeDefined();

    const second = accepts();
    const outcome = await replay(state, second.port);

    expect(second.sent).toHaveLength(0);
    expect(outcome.sent).toBe(0);
  });

  it('tries again once the worker clears the block', async () => {
    const blocked = queueOf(entry('t1', { kind: 'step', step: 'accept' }));
    const refusing = portThat(() => {
      throw new ApiError('INVALID_STATUS_TRANSITION', 'Already cancelled.', 409);
    });
    await replay(blocked, refusing.port);

    const retried = unblock(refusing.saved.at(-1)!, 't1');
    const { port, sent } = accepts();
    await replay(retried, port);

    expect(sent).toHaveLength(1);
  });

  it('saves after each write, so a crash mid-replay does not resend', async () => {
    const state = queueOf(
      entry('t1', { kind: 'step', step: 'accept' }),
      entry('t1', { kind: 'step', step: 'depart' }),
    );
    const { port, saved } = accepts();

    await replay(state, port);

    expect(saved).toHaveLength(2);
    expect(pendingCount(saved[0]!)).toBe(1);
    expect(pendingCount(saved[1]!)).toBe(0);
  });
});
