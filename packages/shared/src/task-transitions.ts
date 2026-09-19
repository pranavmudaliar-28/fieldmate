import type { Role, TaskStatus } from './constants.js';

type ActionRule = {
  /** Statuses in which the action is allowed. */
  from: readonly TaskStatus[];
  /** Resulting status, or null when the action does not change status. */
  to: TaskStatus | null;
  /** Roles allowed to perform the action. */
  roles: readonly Role[];
};

/**
 * Single source of truth for the task lifecycle (product spec §4.2, T1–T7).
 * The API enforces it; the mobile app uses it only to decide which actions to show.
 */
export const TASK_ACTIONS = {
  edit: { from: ['ASSIGNED', 'IN_PROGRESS', 'REJECTED'], to: null, roles: ['MANAGER'] },
  reassign: { from: ['ASSIGNED', 'IN_PROGRESS', 'REJECTED'], to: 'ASSIGNED', roles: ['MANAGER'] },
  start: { from: ['ASSIGNED'], to: 'IN_PROGRESS', roles: ['FIELD_WORKER'] },
  reject: { from: ['ASSIGNED'], to: 'REJECTED', roles: ['FIELD_WORKER'] },
  complete: { from: ['IN_PROGRESS'], to: 'COMPLETED', roles: ['MANAGER', 'FIELD_WORKER'] },
  cancel: { from: ['ASSIGNED', 'IN_PROGRESS', 'REJECTED'], to: 'CANCELLED', roles: ['MANAGER'] },
  reopen: { from: ['COMPLETED'], to: 'ASSIGNED', roles: ['MANAGER'] },
  addEvidence: { from: ['IN_PROGRESS'], to: null, roles: ['FIELD_WORKER'] },
  deleteEvidence: { from: ['IN_PROGRESS'], to: null, roles: ['FIELD_WORKER'] },
  addNote: { from: ['IN_PROGRESS'], to: null, roles: ['FIELD_WORKER'] },
} as const satisfies Record<string, ActionRule>;

export type TaskAction = keyof typeof TASK_ACTIONS;

export const TASK_ACTION_NAMES = Object.keys(TASK_ACTIONS) as TaskAction[];

/** Whether the task's status allows the action (ignores role and ownership). */
export function isStatusAllowed(action: TaskAction, status: TaskStatus): boolean {
  return (TASK_ACTIONS[action].from as readonly TaskStatus[]).includes(status);
}

/** Whether the role may ever perform the action. */
export function isRoleAllowed(action: TaskAction, role: Role): boolean {
  return (TASK_ACTIONS[action].roles as readonly Role[]).includes(role);
}

/** Resulting status of an action, or null when the status does not change. */
export function nextStatus(action: TaskAction): TaskStatus | null {
  return TASK_ACTIONS[action].to;
}

/**
 * Actions a role may perform on a task in the given status.
 * Condition-based rules (photo count, uploader, current assignee) are checked separately.
 */
export function allowedActions(status: TaskStatus, role: Role): TaskAction[] {
  return TASK_ACTION_NAMES.filter(
    (action) => isStatusAllowed(action, status) && isRoleAllowed(action, role),
  );
}

/** Completion requires at least one photo (BR-007). */
export function hasRequiredEvidence(evidenceCount: number): boolean {
  return evidenceCount >= 1;
}
