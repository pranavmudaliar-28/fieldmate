import { ROLES, TASK_STATUSES } from '@fieldmate/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/** Database schema — docs/05-database-api.md §2. */

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const pk = () => uuid('id').primaryKey().defaultRandom();

export const userRole = pgEnum('user_role', ROLES);
export const taskStatus = pgEnum('task_status', TASK_STATUSES);

export const users = pgTable(
  'users',
  {
    id: pk(),
    name: varchar('name', { length: 100 }).notNull(),
    email: varchar('email', { length: 254 }).notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: userRole('role').notNull(),
    /** A deactivated user cannot sign in and receives no new work (docs/07 §2). */
    isActive: boolean('is_active').notNull().default(true),
    tokenVersion: integer('token_version').notNull().default(0),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('users_role_idx').on(t.role),
    check('users_name_not_blank', sql`length(trim(${t.name})) > 0`),
    check('users_email_lowercase', sql`${t.email} = lower(${t.email})`),
    check('users_token_version_non_negative', sql`${t.tokenVersion} >= 0`),
  ],
);

export const tasks = pgTable(
  'tasks',
  {
    id: pk(),
    title: varchar('title', { length: 200 }).notNull(),
    description: varchar('description', { length: 5000 }).notNull(),
    status: taskStatus('status').notNull().default('ASSIGNED'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    /**
     * When the worker passed each step. Cleared on reassign and reopen, because
     * the next worker starts the journey over. `started_at` is when work began
     * on site, which is what "time on site" is measured from.
     */
    acceptedAt: ts('accepted_at'),
    departedAt: ts('departed_at'),
    arrivedAt: ts('arrived_at'),
    startedAt: ts('started_at'),
    completedAt: ts('completed_at'),
  },
  (t) => [
    index('tasks_created_by_idx').on(t.createdBy),
    index('tasks_status_idx').on(t.status),
    index('tasks_updated_at_id_idx').on(t.updatedAt.desc(), t.id.desc()),
    check('tasks_title_not_blank', sql`length(trim(${t.title})) > 0`),
    check('tasks_description_not_blank', sql`length(trim(${t.description})) > 0`),
    check(
      'tasks_completed_at_matches_status',
      sql`(${t.status} = 'COMPLETED') = (${t.completedAt} IS NOT NULL)`,
    ),
  ],
);

export const taskAssignments = pgTable(
  'task_assignments',
  {
    id: pk(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'restrict' }),
    workerId: uuid('worker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    assignedAt: ts('assigned_at').notNull().defaultNow(),
    rejectionReason: varchar('rejection_reason', { length: 1000 }),
    rejectedAt: ts('rejected_at'),
    /** NULL marks the current assignment; set when the task is reassigned. */
    endedAt: ts('ended_at'),
  },
  (t) => [
    index('task_assignments_task_id_idx').on(t.taskId),
    index('task_assignments_worker_id_idx').on(t.workerId),
    // At most one current assignment per task (docs/05 §2.4, B1).
    uniqueIndex('task_assignments_one_open_uq')
      .on(t.taskId)
      .where(sql`${t.endedAt} IS NULL`),
    check(
      'task_assignments_rejection_pair',
      sql`(${t.rejectionReason} IS NULL) = (${t.rejectedAt} IS NULL)`,
    ),
    check(
      'task_assignments_ended_after_assigned',
      sql`${t.endedAt} IS NULL OR ${t.endedAt} >= ${t.assignedAt}`,
    ),
  ],
);

export const taskLocations = pgTable(
  'task_locations',
  {
    id: pk(),
    taskId: uuid('task_id')
      .notNull()
      .unique()
      .references(() => tasks.id, { onDelete: 'restrict' }),
    latitude: numeric('latitude', { precision: 9, scale: 6, mode: 'number' }),
    longitude: numeric('longitude', { precision: 9, scale: 6, mode: 'number' }),
    address: varchar('address', { length: 500 }).notNull(),
    /** Door-level detail a map cannot know: flat, floor, gate, landmark. */
    addressDetails: varchar('address_details', { length: 300 }),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('task_locations_lat_range', sql`${t.latitude} BETWEEN -90 AND 90`),
    check('task_locations_lng_range', sql`${t.longitude} BETWEEN -180 AND 180`),
    check('task_locations_coords_pair', sql`(${t.latitude} IS NULL) = (${t.longitude} IS NULL)`),
    check('task_locations_address_not_blank', sql`length(trim(${t.address})) > 0`),
  ],
);

export const taskEvidence = pgTable(
  'task_evidence',
  {
    id: pk(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'restrict' }),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** Object key in the private bucket, not a public URL (docs/05 §1, B2). */
    fileKey: varchar('file_key', { length: 300 }).notNull().unique(),
    fileType: varchar('file_type', { length: 50 }).notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('task_evidence_task_id_idx').on(t.taskId),
    check('task_evidence_file_type', sql`${t.fileType} IN ('image/jpeg', 'image/png')`),
  ],
);

export const taskNotes = pgTable(
  'task_notes',
  {
    id: pk(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'restrict' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    content: varchar('content', { length: 5000 }).notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('task_notes_task_id_idx').on(t.taskId),
    check('task_notes_content_not_blank', sql`length(trim(${t.content})) > 0`),
  ],
);

export const devicePushTokens = pgTable(
  'device_push_tokens',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 255 }).notNull().unique(),
    platform: varchar('platform', { length: 10 }).notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('device_push_tokens_user_id_idx').on(t.userId),
    check('device_push_tokens_platform', sql`${t.platform} IN ('ios', 'android')`),
  ],
);

export const schema = {
  users,
  tasks,
  taskAssignments,
  taskLocations,
  taskEvidence,
  taskNotes,
  devicePushTokens,
};

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type TaskRow = typeof tasks.$inferSelect;
export type NewTaskRow = typeof tasks.$inferInsert;
export type TaskAssignmentRow = typeof taskAssignments.$inferSelect;
export type TaskLocationRow = typeof taskLocations.$inferSelect;
export type TaskEvidenceRow = typeof taskEvidence.$inferSelect;
export type TaskNoteRow = typeof taskNotes.$inferSelect;
export type DevicePushTokenRow = typeof devicePushTokens.$inferSelect;
