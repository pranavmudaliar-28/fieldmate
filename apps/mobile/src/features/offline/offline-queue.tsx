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
import { useAuth } from '../auth/auth-context';
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
  /** Photos for this task that are on the phone but have not reached the server. */
  photosPendingFor(taskId: string): number;
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
 * The queue is read once at start-up and kept in a ref from then on; every
 * change is written through to disk immediately, because the next thing that
 * happens to a phone in a basement may be its battery running out.
 *
 * Every change goes through `save`, one at a time and after the first read,
 * so a photo queued while a replay is running, or before the file was read,
 * is never overwritten by an older copy of the queue.
 *
 * The queue holds every worker's writes who has used this phone, but only the
 * signed-in worker's are counted or sent.
 */
export function OfflineQueueProvider({ children }: PropsWithChildren) {
  const isOnline = useIsOnline();
  const queryClient = useQueryClient();
  const { status, user } = useAuth();
  const userId = status === 'signedIn' ? (user?.id ?? null) : null;
  const [state, setState] = useState<QueueState>(EMPTY_QUEUE);
  const [syncing, setSyncing] = useState(false);
  // Guards against a second run starting while the first is still going: the
  // network listener fires more than once on a flaky connection.
  const running = useRef(false);
  const latest = useRef<QueueState>(EMPTY_QUEUE);
  const writes = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    if (!isQueueSupported) return;
    writes.current = readQueue().then((read) => {
      latest.current = read;
      setState(read);
    });
  }, []);

  const save = useCallback((change: (state: QueueState) => QueueState) => {
    const run = writes.current.then(async () => {
      latest.current = change(latest.current);
      setState(latest.current);
      await writeQueue(latest.current);
    });
    writes.current = run.catch(() => undefined);
    return run;
  }, []);

  // shortcut: entries queued before userId was stored belong to whoever signs in next; drop once old builds are gone.
  const mine = useCallback(
    (s: QueueState): QueueState => ({
      ...s,
      entries: s.entries.filter((entry) => !entry.userId || entry.userId === userId),
    }),
    [userId],
  );
  const own = useMemo(() => mine(state), [mine, state]);

  const add = useCallback<OfflineQueue['add']>(
    async (taskId, action, photoUri) => {
      const entry = {
        id: localId('q'),
        taskId,
        ...(userId ? { userId } : {}),
        queuedAt: new Date().toISOString(),
        action,
      };
      // The file is kept before the entry is, so the queue never points at a
      // photo that was never copied.
      if (action.kind === 'photo' && photoUri) await keepPhoto(photoUri, action.photoId);
      await save((s) => enqueue(s, entry));
    },
    [userId, save],
  );

  const sync = useCallback(async () => {
    // Nobody to send as yet: replaying before the session is restored would
    // be refused, and a 401 signs the worker out.
    if (running.current || !userId) return;
    running.current = true;
    setSyncing(true);
    try {
      await writes.current;
      const pending = mine(latest.current);
      if (pending.entries.length === 0) return;

      const outcome = await replay(pending, { send: sendQueued, forgetPhoto, save });

      // Anything that reached the server changed a task, so the screens
      // showing those tasks are now out of date.
      if (outcome.sent > 0) {
        await queryClient.invalidateQueries({ queryKey: taskKeys.all });
      }
    } finally {
      running.current = false;
      setSyncing(false);
    }
  }, [queryClient, userId, mine, save]);

  useEffect(() => {
    if (!isQueueSupported || !isOnline) return;
    void sync();
  }, [isOnline, sync]);

  const value = useMemo<OfflineQueue>(
    () => ({
      supported: isQueueSupported,
      pending: pendingCount(own),
      pendingFor: (taskId) => entriesFor(own, taskId).length,
      photosPendingFor: (taskId) =>
        entriesFor(own, taskId).filter((entry) => entry.action.kind === 'photo').length,
      blockedFor: (taskId) => blockFor(own, taskId),
      add,
      discard: async (taskId) => {
        let going: string[] = [];
        await save((s) => {
          const { state: next, photoIds } = discardTask(s)(taskId);
          going = photoIds;
          return next;
        });
        for (const photoId of going) forgetPhoto(photoId);
      },
      retry: async (taskId) => {
        await save((s) => unblock(s, taskId));
        await sync();
      },
      syncing,
    }),
    [own, mine, add, save, sync, syncing],
  );

  return <OfflineQueueContext.Provider value={value}>{children}</OfflineQueueContext.Provider>;
}

export function useOfflineQueue(): OfflineQueue {
  const value = useContext(OfflineQueueContext);
  if (!value) throw new Error('useOfflineQueue must be used inside OfflineQueueProvider');
  return value;
}
