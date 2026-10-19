import { EMPTY_QUEUE, type QueueBlock, type QueueEntry, type QueueState } from './types';

/**
 * The rules of the queue, kept apart from how it is stored so they can be
 * tested without a device. Every function takes a state and returns a new one.
 */

/** Entries for one task, oldest first — the order they must be replayed in. */
export function entriesFor(state: QueueState, taskId: string): QueueEntry[] {
  return state.entries.filter((entry) => entry.taskId === taskId);
}

export function blockFor(state: QueueState, taskId: string): QueueBlock | undefined {
  return state.blocks.find((block) => block.taskId === taskId);
}

export function pendingCount(state: QueueState): number {
  return state.entries.length;
}

/**
 * Adds a write to the back of the queue.
 *
 * A note that is edited and then deleted while offline still replays as both:
 * collapsing them would be guessing at the worker's intent, and the second
 * write would silently depend on the first having been accepted.
 */
export function enqueue(state: QueueState, entry: QueueEntry): QueueState {
  return { ...state, entries: [...state.entries, entry] };
}

export function removeEntry(state: QueueState, entryId: string): QueueState {
  return { ...state, entries: state.entries.filter((entry) => entry.id !== entryId) };
}

/**
 * Stops a task's queue after the server refused one of its writes. Everything
 * queued behind it was built on a task that has since moved on, so it stays
 * put rather than being replayed into a state nobody asked for.
 */
export function block(state: QueueState, block_: QueueBlock): QueueState {
  return {
    ...state,
    blocks: [...state.blocks.filter((b) => b.taskId !== block_.taskId), block_],
  };
}

/**
 * Throws away a blocked task's queue once the worker has seen it. Photos are
 * named here so the caller can delete the files too: the entries are going,
 * and nothing else refers to them.
 */
export function discardTask(state: QueueState): (taskId: string) => {
  state: QueueState;
  photoIds: string[];
} {
  return (taskId: string) => {
    const going = entriesFor(state, taskId);
    return {
      state: {
        entries: state.entries.filter((entry) => entry.taskId !== taskId),
        blocks: state.blocks.filter((b) => b.taskId !== taskId),
      },
      photoIds: going
        .map((entry) => (entry.action.kind === 'photo' ? entry.action.photoId : null))
        .filter((id): id is string => id !== null),
    };
  };
}

/** Lets a blocked task be tried again, without clearing what is queued. */
export function unblock(state: QueueState, taskId: string): QueueState {
  return { ...state, blocks: state.blocks.filter((b) => b.taskId !== taskId) };
}

/** Tasks with something waiting, in the order they were first written to. */
export function queuedTaskIds(state: QueueState): string[] {
  return [...new Set(state.entries.map((entry) => entry.taskId))];
}

export { EMPTY_QUEUE };
