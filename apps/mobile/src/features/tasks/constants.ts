import { PAGINATION, type TaskStatus } from '@fieldmate/shared';

/**
 * React Query cache keys for tasks.
 *
 * Kept here, in a module that imports nothing but shared types, because both
 * the task hooks and the offline queue need them: when they lived beside the
 * hooks, the queue had to import the hooks to read a key, and the hooks import
 * the queue to decide whether a write is sent or saved — a require cycle, and
 * Metro warns that one can hand back a half-initialised module.
 */
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (statuses?: TaskStatus[]) => [...taskKeys.lists(), statuses ?? 'all'] as const,
  detail: (taskId: string) => [...taskKeys.all, 'detail', taskId] as const,
  workers: ['users', 'workers'] as const,
};

/**
 * Dashboard queries ask for a full page so their counts are exact. The list
 * endpoints return a page rather than a total, and `taskKeys.list` ignores the
 * limit, so every caller of the same statuses must ask for the same size or
 * they would share a cache entry filled by whichever mounted first.
 */
export const TASK_PAGE_LIMIT = PAGINATION.maxLimit;

/** A count that filled the page is shown as a floor, e.g. "50+". */
export function isCapped(count: number, nextCursor: string | null | undefined): boolean {
  return count >= TASK_PAGE_LIMIT || Boolean(nextCursor);
}

/**
 * Work under way, from acceptance to the last photo. A manager reads the
 * travel steps as "in progress" too; leaving them out hid tasks that were
 * moving from every count and every filter.
 */
export const ACTIVE_STATUSES: TaskStatus[] = [
  'ACCEPTED',
  'GOING_TO_LOCATION',
  'REACHED_LOCATION',
  'IN_PROGRESS',
];

/** A list filter. Most are one status; "In progress" is the active group. */
export type TaskFilter =
  'ASSIGNED' | 'IN_PROGRESS' | 'AWAITING_REVIEW' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';

export const TASK_FILTERS: { value: TaskFilter; label: string; statuses: TaskStatus[] }[] = [
  { value: 'AWAITING_REVIEW', label: 'Review', statuses: ['AWAITING_REVIEW'] },
  { value: 'REJECTED', label: 'Rejected', statuses: ['REJECTED'] },
  { value: 'IN_PROGRESS', label: 'In progress', statuses: ACTIVE_STATUSES },
  { value: 'ASSIGNED', label: 'Assigned', statuses: ['ASSIGNED'] },
  { value: 'COMPLETED', label: 'Completed', statuses: ['COMPLETED'] },
  { value: 'CANCELLED', label: 'Cancelled', statuses: ['CANCELLED'] },
];
