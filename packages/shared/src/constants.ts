export const ROLES = ['ADMIN', 'MANAGER', 'FIELD_WORKER'] as const;
export type Role = (typeof ROLES)[number];

/** Roles allowed to manage tasks: admins have every manager power (docs/07 §2). */
export const TASK_MANAGING_ROLES = ['ADMIN', 'MANAGER'] as const satisfies readonly Role[];

export function managesTasks(role: Role): boolean {
  return (TASK_MANAGING_ROLES as readonly Role[]).includes(role);
}

export const TASK_STATUSES = [
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Statuses a field worker can see for tasks currently assigned to them. */
export const WORKER_VISIBLE_STATUSES = [
  'ASSIGNED',
  'IN_PROGRESS',
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
  rejectionReason: 1000,
  note: 5000,
  pushToken: 255,
} as const;

export const PAGINATION = {
  defaultLimit: 20,
  maxLimit: 50,
} as const;
