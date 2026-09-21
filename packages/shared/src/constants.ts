export const ROLES = ['ADMIN', 'MANAGER', 'FIELD_WORKER'] as const;
export type Role = (typeof ROLES)[number];

/** Roles allowed to manage tasks: admins have every manager power (docs/07 §2). */
export const TASK_MANAGING_ROLES = ['ADMIN', 'MANAGER'] as const satisfies readonly Role[];

export function managesTasks(role: Role): boolean {
  return (TASK_MANAGING_ROLES as readonly Role[]).includes(role);
}

/**
 * Listed in lifecycle order. A task is only IN_PROGRESS once the worker
 * confirms they have started working at the site — never on assignment and
 * never on acceptance (docs/02 §4.2).
 */
export const TASK_STATUSES = [
  'ASSIGNED',
  'ACCEPTED',
  'GOING_TO_LOCATION',
  'REACHED_LOCATION',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** The steps a worker walks through, in order, before the work itself. */
export const WORKER_PROGRESS_STATUSES = [
  'ASSIGNED',
  'ACCEPTED',
  'GOING_TO_LOCATION',
  'REACHED_LOCATION',
  'IN_PROGRESS',
] as const satisfies readonly TaskStatus[];

/** Statuses a field worker can see for tasks currently assigned to them. */
export const WORKER_VISIBLE_STATUSES = [
  ...WORKER_PROGRESS_STATUSES,
  'COMPLETED',
] as const satisfies readonly TaskStatus[];

export const EVIDENCE_MIME_TYPES = ['image/jpeg', 'image/png'] as const;
export type EvidenceMimeType = (typeof EVIDENCE_MIME_TYPES)[number];
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

export const PUSH_PLATFORMS = ['ios', 'android'] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

export const FIELD_LIMITS = {
  userName: 100,
  email: 254,
  passwordMin: 8,
  passwordMax: 128,
  taskTitle: 200,
  taskDescription: 5000,
  address: 500,
  addressDetails: 300,
  rejectionReason: 1000,
  note: 5000,
  pushToken: 255,
} as const;

export const PAGINATION = {
  defaultLimit: 20,
  maxLimit: 50,
} as const;
