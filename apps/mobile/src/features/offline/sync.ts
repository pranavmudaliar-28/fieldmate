import { ApiError } from '../../services/http';
import { blockFor, entriesFor, queuedTaskIds, removeEntry, block } from './queue';
import type { QueueEntry, QueueState, SyncOutcome } from './types';

/**
 * What a replay needs to do, injected so the rules can be tested without a
 * network or a device.
 */
export type SyncPort = {
  send(entry: QueueEntry): Promise<void>;
  /** Called after an accepted write so its photo file can be removed. */
  forgetPhoto(photoId: string): void;
  save(state: QueueState): Promise<void>;
};

/**
 * A refusal the queue cannot replay past. The task moved on without the
 * worker, so the write is not late — it is wrong, and so is everything queued
 * behind it.
 */
function movedOn(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;

  // 404 reads as "not yours any more": reassigned away, or rejected and gone.
  if (error.status === 404) {
    return 'This task is no longer assigned to you, so your offline changes were not sent.';
  }
  // 409 is the lifecycle refusing the step: already completed, cancelled, or
  // sent back. The server's wording is written for the worker, so it is used.
  if (error.status === 409) return error.message;
  if (error.status === 403) return error.message;
  // A rejected photo or an empty note is the worker's own write being invalid,
  // which replaying again will not fix either.
  if (error.status === 422) return error.message;
  return null;
}

/**
 * Replays everything queued, one task at a time and in order within a task.
 *
 * A task that is refused stops there and is marked; the others carry on, so
 * one stale job does not strand a day's work. A connection that drops again
 * ends the run with everything still queued — nothing is discarded for being
 * unsent (docs/02 §10).
 */
export async function replay(state: QueueState, port: SyncPort): Promise<SyncOutcome> {
  let current = state;
  let sent = 0;
  const blocked: SyncOutcome['blocked'] = [];
  let interrupted = false;

  for (const taskId of queuedTaskIds(state)) {
    // A task the worker has already been told about waits for their answer.
    if (blockFor(current, taskId)) continue;

    for (const entry of entriesFor(current, taskId)) {
      try {
        await port.send(entry);
        if (entry.action.kind === 'photo') port.forgetPhoto(entry.action.photoId);
        current = removeEntry(current, entry.id);
        sent += 1;
        await port.save(current);
      } catch (error) {
        const reason = movedOn(error);
        if (reason === null) {
          // Still offline, or the server is having a bad day. Everything stays
          // queued exactly as it is and the next reconnect tries again.
          interrupted = true;
          break;
        }

        const record = { taskId, reason, blockedAt: new Date().toISOString() };
        current = block(current, record);
        blocked.push(record);
        await port.save(current);
        break;
      }
    }

    if (interrupted) break;
  }

  return { sent, blocked, interrupted };
}
