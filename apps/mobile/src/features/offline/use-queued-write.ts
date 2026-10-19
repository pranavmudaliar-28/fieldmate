import type { TaskDetail } from '@fieldmate/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useIsOnline } from '../../hooks/use-network-status';
import { taskKeys } from '../tasks/constants';
import { useOfflineQueue } from './offline-queue';
import { applyLocally } from './optimistic';
import type { QueuedAction } from './types';

/**
 * Turns one of the worker's writes into either a request or a queue entry,
 * depending on whether there is a connection (docs/02 §10).
 *
 * The decision lives here rather than in each hook so that "what happens when
 * the signal is gone" is answered once. A queued write is applied to the
 * cached task straight away: the worker tapped Accept on a job in a basement
 * and the screen has to say Accepted, not sit unchanged until they drive out.
 */
export function useQueuedWrite(taskId: string) {
  const isOnline = useIsOnline();
  const queue = useOfflineQueue();
  const queryClient = useQueryClient();

  return useCallback(
    async <T>(options: {
      action: QueuedAction;
      /** Runs when there is a connection; its result is the mutation's. */
      online: () => Promise<T>;
      /** The photo to keep, for a photo action. */
      photoUri?: string;
    }): Promise<T | null> => {
      const canQueue = queue.supported && !isOnline;
      if (!canQueue) return options.online();

      await queue.add(taskId, options.action, options.photoUri);

      const cached = queryClient.getQueryData<TaskDetail>(taskKeys.detail(taskId));
      if (cached) {
        // Only the worker holding a task can queue a write on it, so the
        // assignee is the author — no need to ask who is signed in.
        queryClient.setQueryData(
          taskKeys.detail(taskId),
          applyLocally(cached, options.action, cached.assignment.worker),
        );
      }
      // Nothing came back from a server that was never asked.
      return null;
    },
    [taskId, isOnline, queue, queryClient],
  );
}
