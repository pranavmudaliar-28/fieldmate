import type { EvidenceSource, TaskStatus, WorkerStep } from '@fieldmate/shared';

/**
 * A write the worker made while the device could not reach the server.
 *
 * Only a worker's own writes are queued. A manager works from a desk or a car
 * with signal, and their actions — reassigning, cancelling, approving — change
 * what other people see, so replaying one an hour late would be worse than
 * refusing it at the time (docs/02 §10).
 */
export type QueuedAction =
  | { kind: 'step'; step: WorkerStep }
  /** `from` is missing only on entries queued before it was stored. */
  | { kind: 'stepBack'; from?: TaskStatus }
  | { kind: 'reject'; reason: string }
  | { kind: 'complete' }
  /** `noteId` is missing only on entries queued before ids came from the device. */
  | { kind: 'note.add'; noteId?: string; content: string }
  | { kind: 'note.edit'; noteId: string; content: string }
  | { kind: 'note.delete'; noteId: string }
  | {
      kind: 'photo';
      /** Names the file kept under the queue's own directory, not a cache path. */
      photoId: string;
      /**
       * Where that file is, so the worker can see their own photo before it
       * has ever reached the server and been given a presigned URL.
       */
      localUri: string;
      mimeType: 'image/jpeg' | 'image/png';
      size: number;
      source: EvidenceSource;
    };

export type QueueEntry = {
  id: string;
  taskId: string;
  /**
   * Who queued it, so a shared phone never sends one worker's writes under
   * another's session. Missing only on entries queued before this was stored.
   */
  userId?: string;
  /** ISO, so a queue read back after a restart still orders correctly. */
  queuedAt: string;
  action: QueuedAction;
};

/**
 * Why a task's queue stopped. The server refused a write because the task
 * moved on without the worker — reassigned, cancelled, or already finished —
 * and everything queued behind it would be refused for the same reason.
 */
export type QueueBlock = {
  taskId: string;
  /** What the worker is told. Comes from the server where it says anything useful. */
  reason: string;
  blockedAt: string;
};

export type QueueState = {
  entries: QueueEntry[];
  blocks: QueueBlock[];
};

export const EMPTY_QUEUE: QueueState = { entries: [], blocks: [] };

/** Where a replay stopped, and why. */
export type SyncOutcome = {
  /** Entries that reached the server and were accepted. */
  sent: number;
  /** Tasks whose queue stopped because the server refused a write. */
  blocked: QueueBlock[];
  /** True when the run ended early because the connection went away again. */
  interrupted: boolean;
};
