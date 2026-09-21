import type { Role, TaskStatus } from './constants.js';

type ActionRule = {
  /** Statuses in which the action is allowed. */
  from: readonly TaskStatus[];
  /** Resulting status, or null when the action does not change status. */
  to: TaskStatus | null;
  /** Roles allowed to perform the action. */
  roles: readonly Role[];
};

/** Everything before the work itself: assignment, acceptance and travel. */
const BEFORE_WORK = ['ASSIGNED', 'ACCEPTED', 'GOING_TO_LOCATION', 'REACHED_LOCATION'] as const;

/** Every status in which a task is still live and a manager may intervene. */
const OPEN = [...BEFORE_WORK, 'IN_PROGRESS', 'REJECTED'] as const;

/**
 * Single source of truth for the task lifecycle (product spec §4.2, T1–T7).
 * The API enforces it; the mobile app uses it only to decide which actions to show.
 *
 * Assigned → Accepted → Going to location → Reached location → In progress →
 * Completed. A task is never IN_PROGRESS until the worker confirms they have
 * started working on site.
 */
export const TASK_ACTIONS = {
  edit: { from: OPEN, to: null, roles: ['ADMIN', 'MANAGER'] },
  reassign: { from: OPEN, to: 'ASSIGNED', roles: ['ADMIN', 'MANAGER'] },

  accept: { from: ['ASSIGNED'], to: 'ACCEPTED', roles: ['FIELD_WORKER'] },
  depart: { from: ['ACCEPTED'], to: 'GOING_TO_LOCATION', roles: ['FIELD_WORKER'] },
  arrive: { from: ['GOING_TO_LOCATION'], to: 'REACHED_LOCATION', roles: ['FIELD_WORKER'] },
  /** The only way into IN_PROGRESS: the worker says the work has begun. */
  start: { from: ['REACHED_LOCATION'], to: 'IN_PROGRESS', roles: ['FIELD_WORKER'] },

  /** Undoes a mistapped step. Never available once the work has started. */
  stepBack: {
    from: ['ACCEPTED', 'GOING_TO_LOCATION', 'REACHED_LOCATION'],
    to: null,
    roles: ['FIELD_WORKER'],
  },

  /** Handing the task back, including after travelling and finding a problem. */
  reject: { from: BEFORE_WORK, to: 'REJECTED', roles: ['FIELD_WORKER'] },

  complete: { from: ['IN_PROGRESS'], to: 'COMPLETED', roles: ['ADMIN', 'MANAGER', 'FIELD_WORKER'] },
  cancel: { from: OPEN, to: 'CANCELLED', roles: ['ADMIN', 'MANAGER'] },
  reopen: { from: ['COMPLETED'], to: 'ASSIGNED', roles: ['ADMIN', 'MANAGER'] },

  addEvidence: { from: ['IN_PROGRESS'], to: null, roles: ['FIELD_WORKER'] },
  deleteEvidence: { from: ['IN_PROGRESS'], to: null, roles: ['FIELD_WORKER'] },
  addNote: { from: ['IN_PROGRESS'], to: null, roles: ['FIELD_WORKER'] },
} as const satisfies Record<string, ActionRule>;

export type TaskAction = keyof typeof TASK_ACTIONS;

export const TASK_ACTION_NAMES = Object.keys(TASK_ACTIONS) as TaskAction[];

/** The worker's forward steps, in the order they happen. */
export const WORKER_STEPS = [
  'accept',
  'depart',
  'arrive',
  'start',
] as const satisfies readonly TaskAction[];
export type WorkerStep = (typeof WORKER_STEPS)[number];

/** The step that moves a task out of `status`, or null when there is none. */
export function nextWorkerStep(status: TaskStatus): WorkerStep | null {
  return WORKER_STEPS.find((step) => isStatusAllowed(step, status)) ?? null;
}

/** Where `stepBack` lands: one step earlier in the worker's progress. */
export function previousStatus(status: TaskStatus): TaskStatus | null {
  const undo: Partial<Record<TaskStatus, TaskStatus>> = {
    ACCEPTED: 'ASSIGNED',
    GOING_TO_LOCATION: 'ACCEPTED',
    REACHED_LOCATION: 'GOING_TO_LOCATION',
  };
  return undo[status] ?? null;
}

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
