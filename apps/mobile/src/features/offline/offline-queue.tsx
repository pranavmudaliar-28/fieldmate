import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { useIsOnline } from '../../hooks/use-network-status';
import { localId } from './id';
import { taskKeys } from '../tasks/constants';
import {
  EMPTY_QUEUE,
  blockFor,
  discardTask,
  enqueue,
  entriesFor,
  pendingCount,
  unblock,
} from './queue';
import { sendQueued } from './send';
import { forgetPhoto, isQueueSupported, keepPhoto, readQueue, writeQueue } from './store';
import { replay } from './sync';
import type { QueueBlock, QueuedAction, QueueState } from './types';

type OfflineQueue = {
  /** False on web, where nothing is queued — see store.web.ts. */
  supported: boolean;
  pending: number;
  /** Writes waiting for this particular task. */
  pendingFor(taskId: string): number;
  blockedFor(taskId: string): QueueBlock | undefined;
  /** Puts a write in the queue. The photo file, if any, is copied first. */
  add(taskId: string, action: QueuedAction, photoUri?: string): Promise<void>;
  /** Throws away a blocked task's queue once the worker has read why. */
  discard(taskId: string): Promise<void>;
  /** Tries a blocked task again — useful once a manager has put it right. */
  retry(taskId: string): Promise<void>;
  syncing: boolean;
};

const OfflineQueueContext = createContext<OfflineQueue | null>(null);

/**
 * Holds the worker's unsent writes and replays them when the signal comes
 * back (docs/02 §10).
 *
 * The queue is read once at start-up and kept in state from then on; every
 * change is written through to disk immediately, because the next thing that
 * happens to a phone in a basement may be its battery running out.
 */
export function OfflineQueueProvider({ children }: PropsWithChildren) {
  const isOnline = useIsOnline();
  const queryClient = useQueryClient();
  const [state, setState] = useState<QueueState>(EMPTY_QUEUE);
  const [syncing, setSyncing] = useState(false);
  // Guards against a second run starting while the first is still going: the
  // network listener fires more than once on a flaky connection.
  const running = useRef(false);

  useEffect(() => {
    if (!isQueueSupported) return;
    void readQueue().then(setState);
  }, []);

  const save = useCallback(async (next: QueueState) => {
    setState(next);
    await writeQueue(next);
  }, []);

  const add = useCallback<OfflineQueue['add']>(
    async (taskId, action, photoUri) => {
      const entry = {
        id: localId('q'),
        taskId,
        queuedAt: new Date().toISOString(),
        action,
      };
      // The file is kept before the entry is, so the queue never points at a
      // photo that was never copied.
      if (action.kind === 'photo' && photoUri) await keepPhoto(photoUri, action.photoId);
      await save(enqueue(state, entry));
    },
    [state, save],
  );

  const sync = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setSyncing(true);
    try {
      const latest = await readQueue();
      if (latest.entries.length === 0) return;

      const outcome = await replay(latest, {
        send: sendQueued,
        forgetPhoto,
        save: async (next) => {
          setState(next);
          await writeQueue(next);
        },
      });

      // Anything that reached the server changed a task, so the screens
      // showing those tasks are now out of date.
      if (outcome.sent > 0) {
        await queryClient.invalidateQueries({ queryKey: taskKeys.all });
      }
    } finally {
      running.current = false;
      setSyncing(false);
    }
  }, [queryClient]);

  useEffect(() => {
    if (!isQueueSupported || !isOnline) return;
    void sync();
  }, [isOnline, sync]);

  const value = useMemo<OfflineQueue>(
    () => ({
      supported: isQueueSupported,
      pending: pendingCount(state),
      pendingFor: (taskId) => entriesFor(state, taskId).length,
      blockedFor: (taskId) => blockFor(state, taskId),
      add,
      discard: async (taskId) => {
        const { state: next, photoIds } = discardTask(state)(taskId);
        for (const photoId of photoIds) forgetPhoto(photoId);
        await save(next);
      },
      retry: async (taskId) => {
        await save(unblock(state, taskId));
        await sync();
      },
      syncing,
    }),
    [state, add, save, sync, syncing],
  );

  return <OfflineQueueContext.Provider value={value}>{children}</OfflineQueueContext.Provider>;
}

export function useOfflineQueue(): OfflineQueue {
  const value = useContext(OfflineQueueContext);
  if (!value) throw new Error('useOfflineQueue must be used inside OfflineQueueProvider');
  return value;
}
