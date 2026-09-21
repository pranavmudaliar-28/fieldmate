import {
  TASK_ACTIONS,
  isRoleAllowed,
  isStatusAllowed,
  managesTasks,
  type Role,
  type TaskAction,
  type TaskStatus,
} from '@fieldmate/shared';
import { AppError } from '../../utils/app-error.js';

export type Actor = { id: string; name: string; role: Role };

export type TaskContext = {
  status: TaskStatus;
  /** Worker holding the current (open) assignment. */
  currentWorkerId: string;
};

const taskNotFound = () => new AppError('TASK_NOT_FOUND', 'Task was not found.');
const forbidden = () =>
  new AppError('FORBIDDEN', 'You do not have permission to perform this action.');

/** Managers and admins see every task; a worker sees only their current one. */
export function canViewTask(actor: Actor, task: TaskContext): boolean {
  return managesTasks(actor.role) || task.currentWorkerId === actor.id;
}

/**
 * A worker must never learn that a task they cannot see exists, so an
 * invisible task is reported as not found rather than forbidden (docs/05 §8).
 */
export function assertCanViewTask(actor: Actor, task: TaskContext): void {
  if (!canViewTask(actor, task)) throw taskNotFound();
}

/**
 * Full check for an action: visibility, role, status and ownership.
 * Condition-based rules (photo count, uploader) are checked by the service.
 */
export function assertCanPerform(action: TaskAction, actor: Actor, task: TaskContext): void {
  assertCanViewTask(actor, task);

  if (!isRoleAllowed(action, actor.role)) throw forbidden();

  // Worker-only actions require the actor to hold the current assignment.
  const workerOnly =
    TASK_ACTIONS[action].roles.length === 1 && isRoleAllowed(action, 'FIELD_WORKER');
  if (workerOnly && task.currentWorkerId !== actor.id) throw forbidden();
  if (action === 'complete' && actor.role === 'FIELD_WORKER' && task.currentWorkerId !== actor.id) {
    throw forbidden();
  }

  if (!isStatusAllowed(action, task.status)) {
    throw new AppError(
      'INVALID_STATUS_TRANSITION',
      `This task cannot be changed while it is ${task.status.replace('_', ' ').toLowerCase()}.`,
    );
  }
}
