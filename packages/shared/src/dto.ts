import type { EvidenceMimeType, NotificationType, Role, TaskStatus } from './constants.js';

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
  /** Flat, floor, gate or landmark, as typed by the manager. */
  addressDetails: string | null;
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
  /** When each step of the worker's lifecycle happened; null until it does. */
  progress: TaskProgress;
  /** The manager's look at finished work (docs/02 F-008). */
  review: TaskReview;
  /** Oldest first. */
  evidence: Evidence[];
  /** Oldest first. */
  notes: Note[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

/** Cleared when a task is reassigned or reopened: the next worker starts over. */
export type TaskProgress = {
  acceptedAt: string | null;
  departedAt: string | null;
  arrivedAt: string | null;
  /** When work actually began on site — the start of "time on site". */
  startedAt: string | null;
};

/**
 * Null throughout until a worker submits. `note` is the reason the last
 * review handed the work back, and outlives that review so the worker can
 * still read what was asked while they put it right.
 */
export type TaskReview = {
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: UserSummary | null;
  note: string | null;
};

export type Paginated<T> = { items: T[]; nextCursor: string | null };

export type ListResponse<T> = { items: T[] };

/** A push and an inbox row describe the same event, so they share one list. */
export type PushNotificationType = NotificationType;

export type PushNotificationData = { type: PushNotificationType; taskId: string };

/** One row in the inbox: what happened, to which task, and whether it was read. */
export type Notification = {
  id: string;
  type: NotificationType;
  taskId: string;
  title: string;
  body: string;
  /** Null until the user opens it. */
  readAt: string | null;
  createdAt: string;
};

export type UnreadCount = { unread: number };
