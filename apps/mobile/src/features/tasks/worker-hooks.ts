import type { Note, TaskDetail } from '@fieldmate/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../services/http';
import { taskKeys } from './hooks';

function startTask(taskId: string): Promise<TaskDetail> {
  return apiRequest<TaskDetail>(`/tasks/${taskId}/start`, { method: 'POST' });
}

function rejectTask(taskId: string, reason: string): Promise<void> {
  return apiRequest<void>(`/tasks/${taskId}/reject`, { method: 'POST', body: { reason } });
}

function addNote(taskId: string, content: string): Promise<Note> {
  return apiRequest<Note>(`/tasks/${taskId}/notes`, { method: 'POST', body: { content } });
}

function deleteEvidence(taskId: string, evidenceId: string): Promise<void> {
  return apiRequest<void>(`/tasks/${taskId}/evidence/${evidenceId}`, { method: 'DELETE' });
}

export function useStartTask(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => startTask(taskId),
    onSuccess: (task) => {
      queryClient.setQueryData(taskKeys.detail(taskId), task);
      void queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

export function useRejectTask(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => rejectTask(taskId, reason),
    onSuccess: () => {
      // The worker loses access, so drop the cached task entirely.
      queryClient.removeQueries({ queryKey: taskKeys.detail(taskId) });
      void queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

export function useAddNote(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => addNote(taskId, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
    },
  });
}

export function useDeleteEvidence(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (evidenceId: string) => deleteEvidence(taskId, evidenceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
    },
  });
}
