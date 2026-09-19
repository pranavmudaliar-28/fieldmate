import type {
  CreateTaskInput,
  ListResponse,
  Paginated,
  TaskDetail,
  TaskListItem,
  TaskStatus,
  UpdateTaskInput,
  UserSummary,
} from '@fieldmate/shared';
import { apiRequest } from '../../services/http';

export type TaskListQuery = {
  statuses?: TaskStatus[];
  limit?: number;
  cursor?: string;
};

function taskListPath({ statuses, limit, cursor }: TaskListQuery): string {
  const params = new URLSearchParams();
  if (statuses?.length) params.set('status', statuses.join(','));
  if (limit) params.set('limit', String(limit));
  if (cursor) params.set('cursor', cursor);
  const query = params.toString();
  return query ? `/tasks?${query}` : '/tasks';
}

export function fetchTasks(query: TaskListQuery = {}): Promise<Paginated<TaskListItem>> {
  return apiRequest<Paginated<TaskListItem>>(taskListPath(query));
}

export function fetchTask(taskId: string): Promise<TaskDetail> {
  return apiRequest<TaskDetail>(`/tasks/${taskId}`);
}

export function fetchFieldWorkers(): Promise<UserSummary[]> {
  return apiRequest<ListResponse<UserSummary>>('/users?role=FIELD_WORKER').then((r) => r.items);
}

export function createTask(input: CreateTaskInput): Promise<TaskDetail> {
  return apiRequest<TaskDetail>('/tasks', { method: 'POST', body: input });
}

export function updateTask(taskId: string, input: UpdateTaskInput): Promise<TaskDetail> {
  return apiRequest<TaskDetail>(`/tasks/${taskId}`, { method: 'PATCH', body: input });
}

export function reassignTask(taskId: string, workerId: string): Promise<TaskDetail> {
  return apiRequest<TaskDetail>(`/tasks/${taskId}/assignment`, {
    method: 'POST',
    body: { workerId },
  });
}

export function cancelTask(taskId: string): Promise<TaskDetail> {
  return apiRequest<TaskDetail>(`/tasks/${taskId}/cancel`, { method: 'POST' });
}

export function reopenTask(taskId: string): Promise<TaskDetail> {
  return apiRequest<TaskDetail>(`/tasks/${taskId}/reopen`, { method: 'POST' });
}

export function completeTask(taskId: string): Promise<TaskDetail> {
  return apiRequest<TaskDetail>(`/tasks/${taskId}/complete`, { method: 'POST' });
}
