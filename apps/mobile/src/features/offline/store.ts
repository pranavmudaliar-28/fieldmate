import { Directory, File, Paths } from 'expo-file-system';
import { EMPTY_QUEUE, type QueueState } from './types';

/**
 * Where the queue and its photos live: the document directory, not the cache.
 * A cache directory is the first thing the system reclaims when storage runs
 * low, and a worker's unsent photos are the one thing that must survive that.
 */
const ROOT = 'offline';
const QUEUE_FILE = 'queue.json';
const PHOTOS = 'photos';

function root(): Directory {
  const dir = new Directory(Paths.document, ROOT);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export function photoDirectory(): Directory {
  const dir = new Directory(root(), PHOTOS);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** The queue is device-only; see `isQueueSupported` in the .web sibling. */
export const isQueueSupported = true;

export async function readQueue(): Promise<QueueState> {
  try {
    const file = new File(root(), QUEUE_FILE);
    if (!file.exists) return EMPTY_QUEUE;
    const parsed = JSON.parse(await file.text()) as Partial<QueueState>;
    // A half-written file is worth nothing, but losing the photos beside it
    // would be worse, so an unreadable queue starts empty rather than throwing.
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
    };
  } catch {
    return EMPTY_QUEUE;
  }
}

export async function writeQueue(state: QueueState): Promise<void> {
  const file = new File(root(), QUEUE_FILE);
  if (!file.exists) file.create({ intermediates: true });
  file.write(JSON.stringify(state));
}

/**
 * Copies a captured photo into the queue's own directory and returns the name
 * it was given. The camera writes to the cache, which the system may clear
 * before the worker is back in signal.
 */
export async function keepPhoto(uri: string, photoId: string): Promise<void> {
  const source = new File(uri);
  const destination = new File(photoDirectory(), photoId);
  if (destination.exists) destination.delete();
  await source.copy(destination);
}

export function queuedPhotoUri(photoId: string): string {
  return new File(photoDirectory(), photoId).uri;
}

export function forgetPhoto(photoId: string): void {
  const file = new File(photoDirectory(), photoId);
  if (file.exists) file.delete();
}
