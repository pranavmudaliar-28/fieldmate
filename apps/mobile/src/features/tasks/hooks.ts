import type { CreateTaskInput, TaskDetail, TaskStatus, UpdateTaskInput } from '@fieldmate/shared';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useQueuedWrite } from '../offline/use-queued-write';
import { taskKeys } from './constants';
import * as api from './api';

// Re-exported so every existing caller keeps its import; defined in
// constants.ts, which imports nothing of ours (see the note there).
export { taskKeys };

/** Actions return the updated task, so write it into the cache and refresh lists. */
function applyTaskUpdate(queryClient: QueryClient, task: TaskDetail) {
  queryClient.setQueryData(taskKeys.detail(task.id), task);
  void queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
}

export function useTaskList(statuses?: TaskStatus[], limit?: number) {
  return useInfiniteQuery({
    queryKey: taskKeys.list(statuses),
    queryFn: ({ pageParam }) =>
      api.fetchTasks({
        ...(statuses ? { statuses } : {}),
        ...(limit ? { limit } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useTask(taskId: string) {
  return useQuery({
    queryKey: taskKeys.detail(taskId),
    queryFn: () => api.fetchTask(taskId),
  });
}

export function useFieldWorkers(enabled = true) {
  return useQuery({
    queryKey: taskKeys.workers,
    queryFn: api.fetchFieldWorkers,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => api.createTask(input),
    onSuccess: (task) => applyTaskUpdate(queryClient, task),
  });
}

export function useUpdateTask(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTaskInput) => api.updateTask(taskId, input),
    onSuccess: (task) => applyTaskUpdate(queryClient, task),
  });
}

/** Status changes are never applied optimistically: the server may refuse them. */
export function useTaskAction(
  taskId: string,
  action: 'reassign' | 'cancel' | 'reopen' | 'complete' | 'approve',
) {
  const queryClient = useQueryClient();
  const write = useQueuedWrite(taskId);
  return useMutation({
    mutationFn: (workerId?: string) => {
      switch (action) {
        case 'reassign':
          return api.reassignTask(taskId, workerId ?? '');
        case 'cancel':
          return api.cancelTask(taskId);
        case 'reopen':
          return api.reopenTask(taskId);
        case 'complete':
          // A worker handing work over is queueable; a manager closing a task
          // is not — see useQueuedWrite.
          return write({ action: { kind: 'complete' }, online: () => api.completeTask(taskId) });
        case 'approve':
          return api.approveTask(taskId);
      }
    },
    onSuccess: (task) => {
      if (task) applyTaskUpdate(queryClient, task);
    },
  });
}

/** Handing work back carries a note, so it has its own hook. */
export function useRequestChanges(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note: string) => api.requestChanges(taskId, note),
    onSuccess: (task) => applyTaskUpdate(queryClient, task),
  });
}
