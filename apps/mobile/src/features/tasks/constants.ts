import { PAGINATION } from '@fieldmate/shared';

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
