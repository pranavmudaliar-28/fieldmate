import { EMPTY_QUEUE, type QueueState } from './types';

/**
 * Queuing is a device feature, and on web it is off.
 *
 * The queue's job is to hold a worker's writes through a dead spot on a job,
 * then replay them. A browser could hold the text actions in localStorage, but
 * not the photos: a captured image is a blob in the page, and persisting those
 * across a reload means IndexedDB and a second storage path to keep correct.
 *
 * Half a queue is worse than none — a worker would be told their work was
 * saved and lose the photographs, which are the actual evidence. So on web the
 * app keeps today's behaviour and refuses writes while offline, which is
 * honest about what it can promise (docs/02 F-006).
 */
export const isQueueSupported = false;

export async function readQueue(): Promise<QueueState> {
  return EMPTY_QUEUE;
}

export async function writeQueue(_state: QueueState): Promise<void> {
  // Nothing is queued here, so there is nothing to persist.
}

export async function keepPhoto(_uri: string, _photoId: string): Promise<void> {
  throw new Error('Photos are not queued on web.');
}

export function queuedPhotoUri(photoId: string): string {
  return photoId;
}

export function forgetPhoto(_photoId: string): void {
  // No file was ever kept.
}
