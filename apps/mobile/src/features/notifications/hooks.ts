import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './api';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
  unread: () => [...notificationKeys.all, 'unread'] as const,
};

/** How often the badge re-checks while the app is open. */
const UNREAD_POLL_MS = 60_000;

export function useNotifications() {
  return useInfiniteQuery({
    queryKey: notificationKeys.list(),
    queryFn: ({ pageParam }) => api.fetchNotifications(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

/**
 * The badge. Polled rather than pushed: a push can be declined or lost, and the
 * count would then sit stale behind a bell the user is looking straight at.
 */
export function useUnreadCount() {
  const query = useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: api.fetchUnreadCount,
    refetchInterval: UNREAD_POLL_MS,
    refetchOnWindowFocus: true,
  });
  return query.data?.unread ?? 0;
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
