import type { Note, TaskDetail, TaskStatus, WorkerStep } from '@fieldmate/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../services/http';
import { uuid } from '../offline/id';
import { useQueuedWrite } from '../offline/use-queued-write';
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

function stepBackTask(taskId: string, from?: TaskStatus): Promise<TaskDetail> {
  return apiRequest<TaskDetail>(`/tasks/${taskId}/step-back`, { method: 'POST', body: { from } });
}

function rejectTask(taskId: string, reason: string): Promise<void> {
  return apiRequest<void>(`/tasks/${taskId}/reject`, { method: 'POST', body: { reason } });
}

function addNote(taskId: string, id: string, content: string): Promise<Note> {
  return apiRequest<Note>(`/tasks/${taskId}/notes`, { method: 'POST', body: { id, content } });
}

function updateNote(taskId: string, noteId: string, content: string): Promise<Note> {
  return apiRequest<Note>(`/tasks/${taskId}/notes/${noteId}`, {
    method: 'PATCH',
    body: { content },
  });
}

function deleteNote(taskId: string, noteId: string): Promise<void> {
  return apiRequest<void>(`/tasks/${taskId}/notes/${noteId}`, { method: 'DELETE' });
}

function deleteEvidence(taskId: string, evidenceId: string): Promise<void> {
  return apiRequest<void>(`/tasks/${taskId}/evidence/${evidenceId}`, { method: 'DELETE' });
}

/** Moves the task one step forward: accept, depart, arrive, then start. */
export function useAdvanceTask(taskId: string) {
  const queryClient = useQueryClient();
  const write = useQueuedWrite(taskId);
  return useMutation({
    mutationFn: (step: WorkerStep) =>
      write({ action: { kind: 'step', step }, online: () => advanceTask(taskId, step) }),
    onSuccess: (task) => {
      if (task) queryClient.setQueryData(taskKeys.detail(taskId), task);
      void queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

/** Undoes a mistapped step, until the work itself has started. */
export function useStepBack(taskId: string) {
  const queryClient = useQueryClient();
  const write = useQueuedWrite(taskId);
  return useMutation({
    /** `from` is the status being undone, so a resent undo cannot undo a second step. */
    mutationFn: (from?: TaskStatus) =>
      write({ action: { kind: 'stepBack', from }, online: () => stepBackTask(taskId, from) }),
    onSuccess: (task) => {
      if (task) queryClient.setQueryData(taskKeys.detail(taskId), task);
      void queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

export function useRejectTask(taskId: string) {
  const queryClient = useQueryClient();
  const write = useQueuedWrite(taskId);
  return useMutation({
    mutationFn: (reason: string) =>
      write({ action: { kind: 'reject', reason }, online: () => rejectTask(taskId, reason) }),
    onSuccess: () => {
      // The worker loses access, so drop the cached task entirely.
      queryClient.removeQueries({ queryKey: taskKeys.detail(taskId) });
      void queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

export function useAddNote(taskId: string) {
  const queryClient = useQueryClient();
  const write = useQueuedWrite(taskId);
  return useMutation({
    mutationFn: (content: string) => {
      const noteId = uuid();
      return write({
        action: { kind: 'note.add', noteId, content },
        online: () => addNote(taskId, noteId, content),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
    },
  });
}

/** The author's own note, while the task is in progress (docs/02 F-007). */
export function useUpdateNote(taskId: string) {
  const queryClient = useQueryClient();
  const write = useQueuedWrite(taskId);
  return useMutation({
    mutationFn: ({ noteId, content }: { noteId: string; content: string }) =>
      write({
        action: { kind: 'note.edit', noteId, content },
        online: () => updateNote(taskId, noteId, content),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
    },
  });
}

export function useDeleteNote(taskId: string) {
  const queryClient = useQueryClient();
  const write = useQueuedWrite(taskId);
  return useMutation({
    mutationFn: (noteId: string) =>
      write({ action: { kind: 'note.delete', noteId }, online: () => deleteNote(taskId, noteId) }),
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
