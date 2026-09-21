import type { Note, TaskDetail, WorkerStep } from '@fieldmate/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../services/http';
import { taskKeys } from './hooks';

/** One endpoint per step of the worker's lifecycle (docs/05 §7). */
const STEP_PATHS = {
  accept: 'accept',
  depart: 'depart',
  arrive: 'arrive',
  start: 'start',
} as const satisfies Record<WorkerStep, string>;

function advanceTask(taskId: string, step: WorkerStep): Promise<TaskDetail> {
  return apiRequest<TaskDetail>(`/tasks/${taskId}/${STEP_PATHS[step]}`, { method: 'POST' });
}

function stepBackTask(taskId: string): Promise<TaskDetail> {
  return apiRequest<TaskDetail>(`/tasks/${taskId}/step-back`, { method: 'POST' });
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

/** Moves the task one step forward: accept, depart, arrive, then start. */
export function useAdvanceTask(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (step: WorkerStep) => advanceTask(taskId, step),
    onSuccess: (task) => {
      queryClient.setQueryData(taskKeys.detail(taskId), task);
      void queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

/** Undoes a mistapped step, until the work itself has started. */
export function useStepBack(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => stepBackTask(taskId),
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
