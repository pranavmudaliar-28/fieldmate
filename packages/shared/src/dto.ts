import type { EvidenceMimeType, Role, TaskStatus } from './constants.js';

export type UserSummary = { id: string; name: string };

export type User = { id: string; name: string; email: string; role: Role };

/** A user as an admin sees them (docs/07 §2). */
export type ManagedUser = User & {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** False when the account can be deleted outright; true means deactivate instead. */
  hasHistory: boolean;
};

export type LoginResponse = { token: string; user: User };

export type TaskLocation = {
  address: string;
  latitude: number | null;
  longitude: number | null;
};

export type Rejection = { reason: string; rejectedAt: string };

export type TaskListItem = {
  id: string;
  title: string;
  status: TaskStatus;
  address: string;
  /** Current assignee. */
  worker: UserSummary;
  /** Only populated in manager responses. */
  rejection: Rejection | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type Evidence = {
  id: string;
  /** Presigned GET URL, valid for a short time. */
  url: string;
  fileType: EvidenceMimeType;
  uploadedBy: UserSummary;
  createdAt: string;
};

export type Note = {
  id: string;
  content: string;
  createdBy: UserSummary;
  createdAt: string;
};

export type TaskDetail = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  location: TaskLocation;
  assignment: {
    worker: UserSummary;
    assignedAt: string;
    rejection: Rejection | null;
  };
  /** Oldest first. */
  evidence: Evidence[];
  /** Oldest first. */
  notes: Note[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type Paginated<T> = { items: T[]; nextCursor: string | null };

export type ListResponse<T> = { items: T[] };

export type PushNotificationType = 'TASK_ASSIGNED' | 'TASK_UPDATED' | 'TASK_COMPLETED';

export type PushNotificationData = { type: PushNotificationType; taskId: string };
