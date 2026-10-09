import type { PushNotificationType } from '@fieldmate/shared';

export type PushMessage = {
  type: PushNotificationType;
  taskId: string;
  title: string;
  body: string;
};

/** Delivers push notifications; failures never fail the action that triggered them. */
export type PushService = {
  send(userIds: string[], message: PushMessage): Promise<void>;
};

const MAX_BODY_LENGTH = 100;

function shorten(text: string): string {
  return text.length <= MAX_BODY_LENGTH ? text : `${text.slice(0, MAX_BODY_LENGTH - 1)}…`;
}

/** Every event a user is told about (docs/02 F-009). */
export const pushMessages = {
  taskAssigned: (taskId: string, taskTitle: string): PushMessage => ({
    type: 'TASK_ASSIGNED',
    taskId,
    title: 'New task assigned',
    body: shorten(taskTitle),
  }),

  taskUpdated: (taskId: string, taskTitle: string): PushMessage => ({
    type: 'TASK_UPDATED',
    taskId,
    title: 'Task updated',
    body: shorten(taskTitle),
  }),

  taskCompleted: (taskId: string, taskTitle: string, completedBy: string): PushMessage => ({
    type: 'TASK_COMPLETED',
    taskId,
    title: 'Task completed',
    body: shorten(`${taskTitle} · by ${completedBy}`),
  }),

  /** To the manager who assigned it: they are the one who has to reassign. */
  taskRejected: (taskId: string, taskTitle: string, rejectedBy: string): PushMessage => ({
    type: 'TASK_REJECTED',
    taskId,
    title: 'Task rejected',
    body: shorten(`${taskTitle} · by ${rejectedBy}`),
  }),

  /** To the worker holding it, so they stop travelling to a job that is off. */
  taskCancelled: (taskId: string, taskTitle: string): PushMessage => ({
    type: 'TASK_CANCELLED',
    taskId,
    title: 'Task cancelled',
    body: shorten(taskTitle),
  }),

  /** To the worker it lands back on. */
  taskReopened: (taskId: string, taskTitle: string): PushMessage => ({
    type: 'TASK_REOPENED',
    taskId,
    title: 'Task reopened',
    body: shorten(taskTitle),
  }),
};
