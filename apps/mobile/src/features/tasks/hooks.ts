import type { CreateTaskInput, TaskDetail, TaskStatus, UpdateTaskInput } from '@fieldmate/shared';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import * as api from './api';

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (statuses?: TaskStatus[]) => [...taskKeys.lists(), statuses ?? 'all'] as const,
  detail: (taskId: string) => [...taskKeys.all, 'detail', taskId] as const,
  workers: ['users', 'workers'] as const,
};

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
  action: 'reassign' | 'cancel' | 'reopen' | 'complete',
) {
  const queryClient = useQueryClient();
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
          return api.completeTask(taskId);
      }
    },
    onSuccess: (task) => applyTaskUpdate(queryClient, task),
  });
}
