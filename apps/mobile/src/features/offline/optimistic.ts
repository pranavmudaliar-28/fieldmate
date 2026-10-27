import { nextStatus, previousStatus, type TaskDetail } from '@fieldmate/shared';
import { localId } from './id';
import type { QueuedAction } from './types';

/**
 * Applies a queued write to the task the worker is looking at, so the screen
 * shows what they just did rather than what the server last said.
 *
 * It mirrors the server's rules rather than inventing its own: the status a
 * step leads to comes from the shared transition table, which is the same
 * table the API enforces. Where the two could disagree the server wins — the
 * real task is refetched after a replay, and a write the server refuses stops
 * the queue and tells the worker (docs/02 §10).
 */
export function applyLocally(
  task: TaskDetail,
  action: QueuedAction,
  author: { id: string; name: string },
): TaskDetail {
  const now = new Date().toISOString();

  switch (action.kind) {
    case 'step': {
      const to = nextStatus(action.step);
      return to ? { ...task, status: to, updatedAt: now } : task;
    }
    case 'stepBack': {
      const to = previousStatus(task.status);
      return to ? { ...task, status: to, updatedAt: now } : task;
    }
    case 'complete': {
      // A worker completing hands the work over; only a manager can close it.
      const to = nextStatus('submitForReview');
      return to
        ? { ...task, status: to, updatedAt: now, review: { ...task.review, submittedAt: now } }
        : task;
    }
    case 'reject': {
      const to = nextStatus('reject');
      return to ? { ...task, status: to, updatedAt: now } : task;
    }
    case 'note.add':
      return {
        ...task,
        updatedAt: now,
        notes: [
          ...task.notes,
          {
            // The id the server will store it under, so an edit or delete
            // queued behind it names a note the server will know.
            id: action.noteId ?? localId('note'),
            content: action.content,
            createdBy: author,
            createdAt: now,
            updatedAt: null,
          },
        ],
      };
    case 'note.edit':
      return {
        ...task,
        updatedAt: now,
        notes: task.notes.map((note) =>
          note.id === action.noteId ? { ...note, content: action.content, updatedAt: now } : note,
        ),
      };
    case 'note.delete':
      return {
        ...task,
        updatedAt: now,
        notes: task.notes.filter((note) => note.id !== action.noteId),
      };
    case 'photo':
      return {
        ...task,
        updatedAt: now,
        evidence: [
          ...task.evidence,
          {
            id: action.photoId,
            // The file on this device. There is no presigned URL to show until
            // the upload happens, and the worker should still see their photo.
            url: action.localUri,
            fileType: action.mimeType,
            source: action.source,
            uploadedBy: author,
            createdAt: now,
          },
        ],
      };
  }
}
