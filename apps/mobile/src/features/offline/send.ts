import type { WorkerStep } from '@fieldmate/shared';
import { uploadEvidence } from '../evidence/api';
import { apiRequest } from '../../services/http';
import { queuedPhotoUri } from './store';
import type { QueueEntry } from './types';

const STEP_PATHS = {
  accept: 'accept',
  depart: 'depart',
  arrive: 'arrive',
  start: 'start',
} as const satisfies Record<WorkerStep, string>;

/**
 * Performs one queued write, as if the worker had made it just now.
 *
 * It calls the same endpoints the online path does, rather than a batch route
 * of its own: the server's lifecycle rules are what decide whether a late
 * write is still valid, and a second way in would be a second place for them
 * to drift (docs/05 §7.12).
 */
export async function sendQueued(entry: QueueEntry): Promise<void> {
  const { taskId, action } = entry;

  switch (action.kind) {
    case 'step':
      await apiRequest(`/tasks/${taskId}/${STEP_PATHS[action.step]}`, { method: 'POST' });
      return;
    case 'stepBack':
      await apiRequest(`/tasks/${taskId}/step-back`, { method: 'POST' });
      return;
    case 'reject':
      await apiRequest(`/tasks/${taskId}/reject`, {
        method: 'POST',
        body: { reason: action.reason },
      });
      return;
    case 'complete':
      await apiRequest(`/tasks/${taskId}/complete`, { method: 'POST' });
      return;
    case 'note.add':
      await apiRequest(`/tasks/${taskId}/notes`, {
        method: 'POST',
        body: { content: action.content },
      });
      return;
    case 'note.edit':
      await apiRequest(`/tasks/${taskId}/notes/${action.noteId}`, {
        method: 'PATCH',
        body: { content: action.content },
      });
      return;
    case 'note.delete':
      await apiRequest(`/tasks/${taskId}/notes/${action.noteId}`, { method: 'DELETE' });
      return;
    case 'photo':
      await uploadEvidence(taskId, {
        uri: queuedPhotoUri(action.photoId),
        mimeType: action.mimeType,
        size: action.size,
        source: action.source,
      });
      return;
  }
}
