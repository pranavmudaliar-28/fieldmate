# FieldMate — Phase 5: Database & API

Status: **Draft for approval**
Date: 2026-09-16
Inputs: [02-product-specification.md](02-product-specification.md), [03-architecture.md](03-architecture.md), [04-ui-ux.md](04-ui-ux.md) (all approved)

Tags: **[C]** confirmed in the original spec · **[D]** product-owner decision · **[T]** technical choice (no behaviour change) · **[B]** needs approval (see §12)

---

## 1. Changes from the original data model

| # | Change | Reason | Source |
|---|---|---|---|
| 1 | `tasks.location_id` removed; `task_locations.task_id` is **UNIQUE** | Removes the circular reference (C-1) | D (Phase 1) |
| 2 | `tasks.status` is an enum of `ASSIGNED, IN_PROGRESS, COMPLETED, REJECTED, CANCELLED` | Approved lifecycle | D |
| 3 | `task_notes.updated_at` removed | Notes can't be edited | D |
| 4 | `task_assignments.rejection_reason`, `rejected_at` added | Reject with a required reason | D |
| 5 | `task_assignments.ended_at` added, with a partial unique index "one open assignment per task" | Marks the *current* assignment and lets the **database** enforce one worker per task | B1 |
| 6 | `users.token_version` added | Logout and admin can revoke tokens (Q1) | D |
| 7 | New table `device_push_tokens` | Push notifications (C-3) | D |
| 8 | `task_evidence.file_url` renamed to **`file_key`** (stores the object key, not a URL) | The bucket is private; URLs are presigned per request | B2 |
| 9 | Extra index `tasks (updated_at DESC, id DESC)` | Cursor pagination on lists | B3 |

Nothing else is added.

---

## 2. Final database schema

PostgreSQL. All timestamps are `timestamptz`, stored in UTC. IDs are `uuid DEFAULT gen_random_uuid()`. `updated_at` is set by the service layer on every write [T].

### 2.1 Enums
```sql
CREATE TYPE user_role   AS ENUM ('MANAGER', 'FIELD_WORKER');
CREATE TYPE task_status AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED');
```

### 2.2 `users`
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK |
| name | varchar(100) | no | | CHECK `length(trim(name)) > 0` |
| email | varchar(254) | no | | UNIQUE; CHECK `email = lower(email)` |
| password_hash | text | no | | Argon2id PHC string |
| role | user_role | no | | |
| token_version | integer | no | 0 | CHECK `token_version >= 0` |
| created_at | timestamptz | no | now() | |
| updated_at | timestamptz | no | now() | |

The index on `users.email` [C] comes from the UNIQUE constraint.

### 2.3 `tasks`
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK |
| title | varchar(200) | no | | CHECK `length(trim(title)) > 0` |
| description | varchar(5000) | no | | CHECK `length(trim(description)) > 0` |
| status | task_status | no | 'ASSIGNED' | |
| created_by | uuid | no | | FK → users.id **ON DELETE RESTRICT** |
| created_at | timestamptz | no | now() | |
| updated_at | timestamptz | no | now() | |
| completed_at | timestamptz | yes | | CHECK `(status = 'COMPLETED') = (completed_at IS NOT NULL)` |

- Indexes: `tasks_created_by_idx (created_by)` [C], `tasks_status_idx (status)` [C], `tasks_updated_at_id_idx (updated_at DESC, id DESC)` [B3].
- **Reopen** sets `completed_at = NULL`. The CHECK constraint guarantees a COMPLETED task always has a completion time and no other status does.
- Both `created_by` ("must be a MANAGER") and `worker_id` ("must be a FIELD_WORKER") are checked in the service. Postgres can't express those rules as CHECK constraints across tables without triggers, and triggers are avoided [T].

### 2.4 `task_assignments`
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK |
| task_id | uuid | no | | FK → tasks.id ON DELETE RESTRICT |
| worker_id | uuid | no | | FK → users.id ON DELETE RESTRICT |
| assigned_at | timestamptz | no | now() | |
| rejection_reason | varchar(1000) | yes | | |
| rejected_at | timestamptz | yes | | CHECK `(rejection_reason IS NULL) = (rejected_at IS NULL)` |
| ended_at | timestamptz | yes | | CHECK `ended_at IS NULL OR ended_at >= assigned_at` |

- Indexes: `task_assignments_task_id_idx (task_id)` [C], `task_assignments_worker_id_idx (worker_id)` [C].
- **`task_assignments_one_open_uq` UNIQUE (task_id) WHERE ended_at IS NULL** [B1]: at most one current assignment per task, guaranteed by the database.
- **How rows are used:**
  - **Create:** insert a row with `ended_at` NULL.
  - **Reassign:** set `ended_at = now()` on the open row, then insert a new open row.
  - **Reject:** set `rejection_reason` and `rejected_at` on the open row; the row stays open until the task is reassigned or cancelled.
  - **Reopen:** keeps the same open row (same worker).
  - **Cancel:** leaves the open row as it is, so the history shows who held the task when it was cancelled.
- **The current assignment** is the row where `task_id = X AND ended_at IS NULL`. Every task always has exactly one, because creating a task creates its row and reassigning replaces it in the same transaction.

### 2.5 `task_locations`
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK |
| task_id | uuid | no | | FK → tasks.id ON DELETE RESTRICT; **UNIQUE** |
| latitude | numeric(9,6) | yes | | CHECK `latitude BETWEEN -90 AND 90` |
| longitude | numeric(9,6) | yes | | CHECK `longitude BETWEEN -180 AND 180` |
| address | varchar(500) | no | | CHECK `length(trim(address)) > 0` |
| address_details | varchar(300) | yes | | Flat / floor / gate, landmark (added in 7D, docs/07 §1) |
| created_at | timestamptz | no | now() | |

- CHECK `(latitude IS NULL) = (longitude IS NULL)`: both or neither.
- `numeric(9,6)` gives about 0.1 m precision with no floating-point rounding [T].
- **Editing a location** updates this row in place; `tasks.updated_at` records when it changed.
- The UNIQUE index on `task_id` doubles as the lookup index.

### 2.6 `task_evidence`
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK |
| task_id | uuid | no | | FK → tasks.id ON DELETE RESTRICT |
| uploaded_by | uuid | no | | FK → users.id ON DELETE RESTRICT |
| file_key | varchar(300) | no | | UNIQUE |
| file_type | varchar(50) | no | | CHECK `file_type IN ('image/jpeg', 'image/png')` |
| created_at | timestamptz | no | now() | |

Index: `task_evidence_task_id_idx (task_id)` [C].

### 2.7 `task_notes`
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK |
| task_id | uuid | no | | FK → tasks.id ON DELETE RESTRICT |
| created_by | uuid | no | | FK → users.id ON DELETE RESTRICT |
| content | varchar(5000) | no | | CHECK `length(trim(content)) > 0` |
| created_at | timestamptz | no | now() | |

Index: `task_notes_task_id_idx (task_id)` [C].

### 2.8 `device_push_tokens`
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK |
| user_id | uuid | no | | FK → users.id **ON DELETE CASCADE** |
| token | varchar(255) | no | | **UNIQUE** |
| platform | varchar(10) | no | | CHECK `platform IN ('ios', 'android')` |
| created_at | timestamptz | no | now() | |

- Index: `device_push_tokens_user_id_idx (user_id)`, needed to look up all of a recipient's devices when sending a push [T].
- **Registering a token** is an upsert on `token`. If the same device later logs in as a different user, the row moves to the new user, so a shared phone never gets the previous user's pushes.

### 2.9 Relationships
```
users 1 ─── * tasks                (tasks.created_by)
users 1 ─── * task_assignments     (worker_id)
tasks 1 ─── * task_assignments     (exactly one with ended_at IS NULL)
tasks 1 ─── 1 task_locations       (task_id UNIQUE)
tasks 1 ─── * task_evidence
users 1 ─── * task_evidence        (uploaded_by)
tasks 1 ─── * task_notes
users 1 ─── * task_notes           (created_by)
users 1 ─── * device_push_tokens
```
Delete behaviour: **RESTRICT** everywhere, because no feature deletes users or tasks. The one exception is `device_push_tokens` (**CASCADE**) [T].

---

## 3. Drizzle schema

`apps/api/src/db/schema.ts` (one file; the domain is small [T]).

```ts
import { sql } from 'drizzle-orm';
import {
  check, index, integer, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core';
import { ROLES, TASK_STATUSES, EVIDENCE_MIME_TYPES, PUSH_PLATFORMS } from '@fieldmate/shared';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const id = () => uuid('id').primaryKey().defaultRandom();

export const userRole = pgEnum('user_role', ROLES);            // ['MANAGER','FIELD_WORKER']
export const taskStatus = pgEnum('task_status', TASK_STATUSES); // 5 values

export const users = pgTable('users', {
  id: id(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 254 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRole('role').notNull(),
  tokenVersion: integer('token_version').notNull().default(0),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
}, (t) => [
  check('users_name_not_blank', sql`length(trim(${t.name})) > 0`),
  check('users_email_lowercase', sql`${t.email} = lower(${t.email})`),
  check('users_token_version_non_negative', sql`${t.tokenVersion} >= 0`),
]);

export const tasks = pgTable('tasks', {
  id: id(),
  title: varchar('title', { length: 200 }).notNull(),
  description: varchar('description', { length: 5000 }).notNull(),
  status: taskStatus('status').notNull().default('ASSIGNED'),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
  completedAt: ts('completed_at'),
}, (t) => [
  index('tasks_created_by_idx').on(t.createdBy),
  index('tasks_status_idx').on(t.status),
  index('tasks_updated_at_id_idx').on(t.updatedAt.desc(), t.id.desc()),
  check('tasks_title_not_blank', sql`length(trim(${t.title})) > 0`),
  check('tasks_description_not_blank', sql`length(trim(${t.description})) > 0`),
  check('tasks_completed_at_matches_status', sql`(${t.status} = 'COMPLETED') = (${t.completedAt} IS NOT NULL)`),
]);

export const taskAssignments = pgTable('task_assignments', {
  id: id(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'restrict' }),
  workerId: uuid('worker_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  assignedAt: ts('assigned_at').notNull().defaultNow(),
  rejectionReason: varchar('rejection_reason', { length: 1000 }),
  rejectedAt: ts('rejected_at'),
  endedAt: ts('ended_at'),
}, (t) => [
  index('task_assignments_task_id_idx').on(t.taskId),
  index('task_assignments_worker_id_idx').on(t.workerId),
  uniqueIndex('task_assignments_one_open_uq').on(t.taskId).where(sql`${t.endedAt} IS NULL`),
  check('task_assignments_rejection_pair', sql`(${t.rejectionReason} IS NULL) = (${t.rejectedAt} IS NULL)`),
  check('task_assignments_ended_after_assigned', sql`${t.endedAt} IS NULL OR ${t.endedAt} >= ${t.assignedAt}`),
]);

export const taskLocations = pgTable('task_locations', {
  id: id(),
  taskId: uuid('task_id').notNull().unique().references(() => tasks.id, { onDelete: 'restrict' }),
  latitude: numeric('latitude', { precision: 9, scale: 6, mode: 'number' }),
  longitude: numeric('longitude', { precision: 9, scale: 6, mode: 'number' }),
  address: varchar('address', { length: 500 }).notNull(),
  addressDetails: varchar('address_details', { length: 300 }),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [
  check('task_locations_lat_range', sql`${t.latitude} BETWEEN -90 AND 90`),
  check('task_locations_lng_range', sql`${t.longitude} BETWEEN -180 AND 180`),
  check('task_locations_coords_pair', sql`(${t.latitude} IS NULL) = (${t.longitude} IS NULL)`),
  check('task_locations_address_not_blank', sql`length(trim(${t.address})) > 0`),
]);

export const taskEvidence = pgTable('task_evidence', {
  id: id(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'restrict' }),
  uploadedBy: uuid('uploaded_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  fileKey: varchar('file_key', { length: 300 }).notNull().unique(),
  fileType: varchar('file_type', { length: 50 }).notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [
  index('task_evidence_task_id_idx').on(t.taskId),
  check('task_evidence_file_type', sql`${t.fileType} IN ('image/jpeg', 'image/png')`),
]);

export const taskNotes = pgTable('task_notes', {
  id: id(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'restrict' }),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  content: varchar('content', { length: 5000 }).notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [
  index('task_notes_task_id_idx').on(t.taskId),
  check('task_notes_content_not_blank', sql`length(trim(${t.content})) > 0`),
]);

export const devicePushTokens = pgTable('device_push_tokens', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 255 }).notNull().unique(),
  platform: varchar('platform', { length: 10 }).notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [
  index('device_push_tokens_user_id_idx').on(t.userId),
  check('device_push_tokens_platform', sql`${t.platform} IN ('ios', 'android')`),
]);
```

Notes:
- The CHECK constraints for `file_type` and `platform` hardcode the same values as the shared constants; a unit test fails if the two drift apart [T].
- The exact Drizzle API is checked against the Drizzle version installed in 6C; the resulting SQL must match §2.

---

## 4. Migration plan

| Step | Detail |
|---|---|
| Tooling | `drizzle-kit generate` → SQL files in `apps/api/drizzle/`, committed; `drizzle.config.ts` reads `DATABASE_URL` |
| First migration | `0000_initial.sql`: `CREATE EXTENSION IF NOT EXISTS pgcrypto` (only needed on PG < 13, harmless otherwise), enums, 7 tables, constraints, indexes. **The generated SQL is reviewed by hand** against §2 before it's committed. |
| Applying | `npm run -w apps/api db:migrate` (drizzle-orm migrator script). **Never run automatically when the API starts.** |
| Development | `docker compose up -d` → `db:migrate` → `db:seed`. `db:reset` (drop schema, then migrate) refuses to run unless `APP_ENV` is `development` or `test`. |
| Tests | Jest global setup migrates `fieldmate_test` once; each test file empties the tables (`TRUNCATE … RESTART IDENTITY CASCADE`) before it runs. |
| Staging / production | The deploy pipeline runs `db:migrate` as a separate step **before** the new API version starts. Migrations are **forward-only** and written to be backward compatible (add first, remove in a later release). |
| Rollback | No down migrations. A bad migration is fixed by a new forward migration; data loss is covered by the host's backups and point-in-time recovery (to be chosen with the host). |
| Seed (development only) | `db:seed` creates `manager@fieldmate.dev` (Manager), `worker1@fieldmate.dev` and `worker2@fieldmate.dev` (Field Workers), all with password from `SEED_PASSWORD` (default `FieldMate-dev-1` only when `APP_ENV=development`). It's safe to run again: existing emails are skipped. It **exits with an error when `APP_ENV` is `staging` or `production`.** |
| Admin CLI | `user:create -- --email --name --role` (prompts for the password twice without showing it; 8–128 characters); `user:revoke-sessions -- --email` (`token_version += 1`, deletes that user's push tokens). |

---

## 5. API conventions

| Aspect | Rule |
|---|---|
| Base | `/api/v1` [C]; plus `GET /health` outside the version prefix [D] |
| Format | JSON, UTF-8; `camelCase` field names; the exception is `POST /tasks/:id/evidence` (`multipart/form-data`) |
| IDs | UUID strings; a path parameter that isn't a valid UUID → **400 INVALID_REQUEST** |
| Timestamps | ISO 8601 UTC strings, e.g. `"2026-09-16T09:12:00.000Z"` |
| Coordinates | JSON numbers or `null` |
| Auth | `Authorization: Bearer <jwt>` on every endpoint except `POST /auth/login` and `GET /health` [C] |
| Success status | `200` read or action with a body · `201` created · `204` no content |
| Unknown JSON fields | **Rejected** with 422 (Zod `.strict()`), so clients can't sneak in fields such as `status` or `role` [T] |
| Strings | Trimmed before validation; values that are empty after trimming fail `required` |
| Pagination | `?limit=` (1–50, default 20) and `?cursor=` (opaque); response `{ "items": [...], "nextCursor": string \| null }` |
| Errors | `{ "error": { "code": "...", "message": "..." } }` [C]. No `details` array; for validation errors, `message` names the first failing field, e.g. `"title: Title is required."` [T] |

### 5.1 Error codes
| HTTP | Code | When |
|---|---|---|
| 400 | `INVALID_REQUEST` | Malformed JSON, invalid UUID in the path, invalid cursor, wrong content type |
| 401 | `UNAUTHENTICATED` | Missing, invalid, expired or revoked token; the user no longer exists |
| 401 | `INVALID_CREDENTIALS` | Login failed |
| 403 | `FORBIDDEN` | The role isn't allowed this endpoint; a worker deleting a photo they didn't upload |
| 404 | `TASK_NOT_FOUND` | The task doesn't exist, **or a worker can't see it** |
| 404 | `EVIDENCE_NOT_FOUND` | The photo doesn't exist or belongs to a different task |
| 404 | `NOT_FOUND` | Unknown route |
| 409 | `INVALID_STATUS_TRANSITION` | The action isn't allowed in the task's current status |
| 409 | `EVIDENCE_REQUIRED` | Completing a task that has no photos |
| 409 | `SAME_WORKER` | Reassigning an ASSIGNED or IN_PROGRESS task to its current worker |
| 422 | `VALIDATION_ERROR` | Body or query fails the schema |
| 422 | `INVALID_WORKER` | `workerId` doesn't exist or isn't a FIELD_WORKER |
| 422 | `INVALID_FILE` | The photo is missing, isn't JPEG/PNG by its content, or is larger than 10 MB |
| 429 | `RATE_LIMITED` | Too many login attempts [B4] |
| 500 | `INTERNAL_ERROR` | Anything unexpected. Message: "Something went wrong." |

### 5.2 Order of checks (every task endpoint)
1. `authenticate` → 401
2. `requireRole` → 403
3. Validate path, query and body → 400 / 422
4. In a transaction: `SELECT … FOR UPDATE` the task → 404 if missing
5. Visibility (a worker must be the current assignee) → 404
6. Status allows the action → 409
7. Ownership and conditions (uploader, photo count, same worker) → 403 / 409
8. Write, commit, then send pushes (failures are logged, never returned)

---

## 6. Shared types (`packages/shared`)

```ts
export const ROLES = ['MANAGER', 'FIELD_WORKER'] as const;
export type Role = (typeof ROLES)[number];

export const TASK_STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const EVIDENCE_MIME_TYPES = ['image/jpeg', 'image/png'] as const;
export const PUSH_PLATFORMS = ['ios', 'android'] as const;
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

export type UserSummary = { id: string; name: string };

export type User = { id: string; name: string; email: string; role: Role };

export type TaskLocation = {
  address: string;
  addressDetails: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type TaskListItem = {
  id: string;
  title: string;
  status: TaskStatus;
  address: string;
  worker: UserSummary;                                      // current assignee
  rejection: { reason: string; rejectedAt: string } | null; // manager responses only; always null for workers
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type Evidence = {
  id: string;
  url: string;              // presigned GET, valid 15 min
  fileType: 'image/jpeg' | 'image/png';
  uploadedBy: UserSummary;
  createdAt: string;
};

export type Note = { id: string; content: string; createdBy: UserSummary; createdAt: string };

export type TaskDetail = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  location: TaskLocation;
  assignment: {
    worker: UserSummary;
    assignedAt: string;
    rejection: { reason: string; rejectedAt: string } | null;
  };
  evidence: Evidence[];     // oldest first
  notes: Note[];            // oldest first
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type Paginated<T> = { items: T[]; nextCursor: string | null };
export type ApiError = { error: { code: string; message: string } };
```

What responses leave out: `createdBy` (the managing user) isn't returned because no screen shows it [T]; `password_hash`, `token_version` and `file_key` are **never** returned.

### 6.1 Request schemas (Zod, shared by API and mobile)
```ts
const trimmed = (max: number, label: string) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} must be at most ${max} characters.`);

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  password: z.string().min(1, 'Password is required.').max(128),
}).strict();

export const locationSchema = z.object({
  address: trimmed(500, 'Address'),
  addressDetails: z.string().trim().max(300, 'Details must be at most 300 characters.')
    .nullable().default(null),
  latitude: z.number().min(-90).max(90).nullable().default(null),
  longitude: z.number().min(-180).max(180).nullable().default(null),
}).strict().refine((l) => (l.latitude === null) === (l.longitude === null), {
  message: 'Latitude and longitude must be provided together.', path: ['latitude'],
});

export const createTaskSchema = z.object({
  title: trimmed(200, 'Title'),
  description: trimmed(5000, 'Description'),
  workerId: z.string().uuid('Select a worker.'),
  location: locationSchema,
}).strict();

export const updateTaskSchema = z.object({
  title: trimmed(200, 'Title').optional(),
  description: trimmed(5000, 'Description').optional(),
  location: locationSchema.optional(),          // replaces the whole location
}).strict().refine((b) => Object.keys(b).length > 0, { message: 'Provide at least one field to update.' });

export const reassignSchema = z.object({ workerId: z.string().uuid('Select a worker.') }).strict();
export const rejectTaskSchema = z.object({ reason: trimmed(1000, 'Reason') }).strict();
export const createNoteSchema = z.object({ content: trimmed(5000, 'Note') }).strict();

export const registerPushTokenSchema = z.object({
  token: z.string().regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, 'Invalid push token.').max(255),
  platform: z.enum(PUSH_PLATFORMS),
}).strict();

export const listTasksQuerySchema = z.object({
  status: z.string().optional()                 // comma-separated, e.g. "ASSIGNED,IN_PROGRESS"
    .transform((s) => (s ? s.split(',') : undefined))
    .pipe(z.array(z.enum(TASK_STATUSES)).min(1).optional()),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(200).optional(),
}).strict();

export const listUsersQuerySchema = z.object({ role: z.literal('FIELD_WORKER') }).strict();
```

---

## 7. API contracts

Legend: **Auth** M = Manager, W = Field Worker, — = public.

### 7.1 `GET /health` — Auth —
`200 { "status": "ok" }`. Doesn't touch the database, so it only checks that the process is alive [T].

### 7.2 `POST /api/v1/auth/login` — Auth —
**Request**
```json
{ "email": "manager@fieldmate.dev", "password": "••••••••" }
```
**200**
```json
{
  "token": "eyJhbGciOi…",
  "user": { "id": "5f0c…", "name": "Anita Rao", "email": "manager@fieldmate.dev", "role": "MANAGER" }
}
```
**Errors:** 422 VALIDATION_ERROR · 401 INVALID_CREDENTIALS · 429 RATE_LIMITED (10 attempts / 15 min per IP + email).

**JWT:** HS256; claims `sub`, `ver` (token_version), `iat`, `exp` = iat + 7 days, `iss` `fieldmate-api`, `aud` `fieldmate-mobile:<APP_ENV>`.

### 7.3 `POST /api/v1/auth/logout` — Auth M, W
No body. In one transaction: `users.token_version += 1`; delete **all** of this user's `device_push_tokens` [B5].
**204.** **Errors:** 401.

### 7.4 `GET /api/v1/users/me` — Auth M, W
**200** `User`. **Errors:** 401.

### 7.5 `GET /api/v1/users?role=FIELD_WORKER` — Auth M
**200** `{ "items": UserSummary[] }`, **all** field workers sorted by name, not paginated (small single organisation; used by the worker picker) [T].
**Errors:** 401 · 403 (worker) · 422 (`role` missing or not `FIELD_WORKER`).

### 7.6 `POST /api/v1/users/me/push-tokens` — Auth M, W
**Request** `{ "token": "ExponentPushToken[xxxx]", "platform": "android" }`
Upsert on `token` → `user_id = me`. **204.** **Errors:** 401 · 422.

### 7.7 `GET /api/v1/tasks` — Auth M, W
**Query:** `status` (comma-separated, optional), `limit`, `cursor`.
**Order:** `updated_at DESC, id DESC`. The cursor encodes the last item's `(updatedAt, id)` as base64url.

| Role | Rows |
|---|---|
| M | All tasks; filtered by `status` if given |
| W | `current assignment.worker_id = me` **AND** `status ∈ {ASSIGNED, IN_PROGRESS, COMPLETED}`; a `status` filter can only narrow this set (e.g. `status=CANCELLED` → empty list, not an error) |

**200** `Paginated<TaskListItem>`.
**Errors:** 400 (bad cursor) · 401 · 422.

**Query:** a single SELECT: `tasks` JOIN the open `task_assignments` row JOIN `users` (worker) JOIN `task_locations`, keyset `WHERE (updated_at, id) < ($1, $2)`, `LIMIT limit+1` to work out `nextCursor`. No N+1 queries [C].

**How the screens use it:**
| Screen | Query |
|---|---|
| S-002 Needs attention | `status=REJECTED&limit=10` |
| S-002 Recently completed | `status=COMPLETED&limit=10` (after completion, `updated_at` equals `completed_at` because completed tasks can't be edited) |
| S-003 | `status=<chip>` |
| S-006 | `status=IN_PROGRESS&limit=10`, `status=ASSIGNED&limit=10` |
| S-007 | Active: `status=IN_PROGRESS` then `status=ASSIGNED`; Completed: `status=COMPLETED` (paginated) |

### 7.8 `POST /api/v1/tasks` — Auth M
**Request**
```json
{
  "title": "Replace water meter at Block C",
  "description": "Old meter leaking; replace and photograph serial number.",
  "workerId": "8a1d…",
  "location": {
    "address": "14 Harbour Rd, Unit 3",
    "addressDetails": "Flat 3B, rear gate",
    "latitude": -33.8688,
    "longitude": 151.2093
  }
}
```
**Transaction:** check the worker is a FIELD_WORKER → insert `tasks` (ASSIGNED, created_by = me) → insert `task_locations` → insert `task_assignments` (open).
**After commit:** push `TASK_ASSIGNED` to the worker.
**201** `TaskDetail`. **Errors:** 401 · 403 · 422 VALIDATION_ERROR / INVALID_WORKER.

### 7.9 `GET /api/v1/tasks/:taskId` — Auth M, W
**200** `TaskDetail`. Evidence URLs are presigned for 15 minutes.
**Queries:** 4 in total, whatever the number of photos or notes: (1) task + location + open assignment + worker; (2) evidence + uploader names; (3) notes + author names; (4) the presigned URLs are generated locally, with no network round trip [C].
**Errors:** 400 · 401 · 404 TASK_NOT_FOUND (also when a worker isn't the current assignee).

### 7.10 `PATCH /api/v1/tasks/:taskId` — Auth M
**Request:** any subset of `{ title, description, location }`. `location` replaces all three location fields.
**Transition guard:** status ∈ {ASSIGNED, IN_PROGRESS, REJECTED}.
**Behaviour:**
- Only values that actually change are written.
- If nothing changed: **200** with the current task, `updated_at` untouched, **no push** [T].
- Otherwise `updated_at = now()`, then after commit push `TASK_UPDATED` to the current worker.

**200** `TaskDetail`. **Errors:** 400 · 401 · 403 · 404 · 409 INVALID_STATUS_TRANSITION · 422.

### 7.11 `POST /api/v1/tasks/:taskId/assignment` — Auth M
**Request** `{ "workerId": "…" }`
**Guard:** status ∈ {ASSIGNED, IN_PROGRESS, REJECTED}; the worker is a FIELD_WORKER; if status ≠ REJECTED, the new worker must differ from the current one.
**Transaction:** close the open assignment (`ended_at = now()`) → insert a new open row → `status = ASSIGNED`, `updated_at = now()`.
**After commit:** push `TASK_ASSIGNED` to the new worker.
**200** `TaskDetail`. **Errors:** 400 · 401 · 403 · 404 · 409 INVALID_STATUS_TRANSITION / SAME_WORKER · 422 VALIDATION_ERROR / INVALID_WORKER.

### 7.12 `POST /api/v1/tasks/:taskId/start` — Auth W
**Guard:** current assignee; status = ASSIGNED.
**Transaction:** `status = IN_PROGRESS`, `updated_at = now()`.
**200** `TaskDetail`. **Errors:** 400 · 401 · 403 (manager) · 404 · 409.

### 7.13 `POST /api/v1/tasks/:taskId/reject` — Auth W
**Request** `{ "reason": "Site locked, no key" }`
**Guard:** current assignee; status = ASSIGNED.
**Transaction:** set `rejection_reason` and `rejected_at = now()` on the open assignment; `status = REJECTED`, `updated_at = now()`.
**204.** The worker can't see the task after rejecting it [B6].
**Errors:** 400 · 401 · 403 · 404 · 409 · 422.

### 7.14 `POST /api/v1/tasks/:taskId/cancel` — Auth M
**Guard:** status ∈ {ASSIGNED, IN_PROGRESS, REJECTED}.
**Transaction:** `status = CANCELLED`, `updated_at = now()`. No push [D].
**200** `TaskDetail`. **Errors:** 400 · 401 · 403 · 404 · 409.

### 7.15 `POST /api/v1/tasks/:taskId/reopen` — Auth M
**Guard:** status = COMPLETED.
**Transaction:** `status = ASSIGNED`, `completed_at = NULL`, `updated_at = now()`. The assignment row isn't changed. No push [D].
**200** `TaskDetail`. **Errors:** 400 · 401 · 403 · 404 · 409.

### 7.16 `POST /api/v1/tasks/:taskId/complete` — Auth M, W
**Guard:** W must be the current assignee (otherwise 404); status = IN_PROGRESS (otherwise 409 INVALID_STATUS_TRANSITION); `COUNT(task_evidence) ≥ 1` checked under the row lock (otherwise 409 EVIDENCE_REQUIRED).
**Transaction:** `status = COMPLETED`, `completed_at = now()`, `updated_at = now()`.
**After commit:** push `TASK_COMPLETED` to **all managers except the person who completed it**.
**200** `TaskDetail`. **Errors:** 400 · 401 · 404 · 409.

### 7.17 `POST /api/v1/tasks/:taskId/evidence` — Auth W
**Request:** `multipart/form-data` with exactly one file field named **`photo`**. No other fields.

**Processing:**
1. `multer` (memory storage, `limits.fileSize = 10 MB`, `files = 1`)
2. `file-type` detects `image/jpeg` or `image/png` from the file's bytes
3. Transaction with a lock on the task: check the current assignee and status = IN_PROGRESS
4. Generate `evidenceId` and the key `tasks/{taskId}/evidence/{evidenceId}.{jpg|png}`
5. `PutObject` to storage (with the detected content type)
6. Insert the `task_evidence` row
7. Commit

If step 6 or 7 fails, the object is deleted (best effort) and the error returned.

Holding the lock during the upload stops the task being completed or cancelled halfway through. The lock only lasts as long as one object write, since the file is already in memory [T].

**201** `Evidence`.
**Errors:** 400 (not multipart) · 401 · 403 · 404 · 409 INVALID_STATUS_TRANSITION · 422 INVALID_FILE (missing, wrong type, too large).

### 7.18 `DELETE /api/v1/tasks/:taskId/evidence/:evidenceId` — Auth W
**Guard:** current assignee; status = IN_PROGRESS; the evidence belongs to this task (otherwise 404 EVIDENCE_NOT_FOUND); `uploaded_by = me` (otherwise 403 FORBIDDEN).
**Transaction:** lock the task → delete the row → commit → `DeleteObject` (best effort, failures logged).
**204.** **Errors:** 400 · 401 · 403 · 404 · 409.

### 7.19 `POST /api/v1/tasks/:taskId/notes` — Auth W
**Request** `{ "content": "Replaced valve first; meter serial in photo 2." }`
**Guard:** current assignee; status = IN_PROGRESS (checked under a lock on the task).
**Transaction:** insert the note; `tasks.updated_at = now()`.
**201** `Note`. **Errors:** 400 · 401 · 403 · 404 · 409 · 422.

### 7.20 Endpoint summary
| Method | Path | M | W |
|---|---|---|---|
| GET | /health | public | public |
| POST | /api/v1/auth/login | public | public |
| POST | /api/v1/auth/logout | ✓ | ✓ |
| GET | /api/v1/users/me | ✓ | ✓ |
| GET | /api/v1/users?role=FIELD_WORKER | ✓ | ✗ |
| POST | /api/v1/users/me/push-tokens | ✓ | ✓ |
| GET | /api/v1/tasks | ✓ all | ✓ own |
| POST | /api/v1/tasks | ✓ | ✗ |
| GET | /api/v1/tasks/:taskId | ✓ | ✓ own |
| PATCH | /api/v1/tasks/:taskId | ✓ | ✗ |
| POST | /api/v1/tasks/:taskId/assignment | ✓ | ✗ |
| POST | /api/v1/tasks/:taskId/start | ✗ | ✓ own |
| POST | /api/v1/tasks/:taskId/reject | ✗ | ✓ own |
| POST | /api/v1/tasks/:taskId/cancel | ✓ | ✗ |
| POST | /api/v1/tasks/:taskId/reopen | ✓ | ✗ |
| POST | /api/v1/tasks/:taskId/complete | ✓ | ✓ own |
| POST | /api/v1/tasks/:taskId/evidence | ✗ | ✓ own |
| DELETE | /api/v1/tasks/:taskId/evidence/:evidenceId | ✗ | ✓ own + uploader |
| POST | /api/v1/tasks/:taskId/notes | ✗ | ✓ own |

The spec's 10 endpoints, the 7 approved in Phases 1 and 3, logout, and health. Nothing else.

---

## 8. Authentication (implementation contract)

`authenticate` middleware:
1. Read `Authorization: Bearer <token>`. Missing or malformed → 401 UNAUTHENTICATED.
2. `jose.jwtVerify(token, secret, { issuer: 'fieldmate-api', audience: 'fieldmate-mobile:' + APP_ENV, algorithms: ['HS256'] })`. On failure → 401.
3. `SELECT id, name, email, role, token_version FROM users WHERE id = sub`. Missing, or `token_version ≠ ver` → 401.
4. `req.user = { id, name, email, role }`. **The role always comes from the database** [C].

**Login:**
1. Validate the body.
2. Look the user up by the lowercased email.
3. If not found: run `argon2.verify` against a fixed dummy hash so timing is the same, then return 401.
4. If found: verify the password; a mismatch returns 401.
5. Sign a JWT with `ver = token_version`.

**Password hashing:** `argon2.hash(pw, { type: argon2id })` using the library's default memory and time costs. Passwords are 8–128 characters (enforced by the admin CLI) [T].

---

## 9. Authorization (implementation contract)

- **`requireRole(...roles)`** is a route middleware, set as in the §7.20 table.
- **`task.policy.ts`** holds pure functions, unit tested:
  - `canView(user, task, openAssignment)`: `user.role === 'MANAGER' || openAssignment.workerId === user.id`.
  - `assertCan(action, user, task, openAssignment)`: combines view (404), the shared transition table (409), and the actor rule (worker actions require the current assignee).
- **The shared transition table** (`packages/shared/src/task-transitions.ts`):
```ts
export const TASK_ACTIONS = {
  edit:     { from: ['ASSIGNED', 'IN_PROGRESS', 'REJECTED'], to: null,          roles: ['MANAGER'] },
  reassign: { from: ['ASSIGNED', 'IN_PROGRESS', 'REJECTED'], to: 'ASSIGNED',    roles: ['MANAGER'] },
  start:    { from: ['ASSIGNED'],                            to: 'IN_PROGRESS', roles: ['FIELD_WORKER'] },
  reject:   { from: ['ASSIGNED'],                            to: 'REJECTED',    roles: ['FIELD_WORKER'] },
  complete: { from: ['IN_PROGRESS'],                         to: 'COMPLETED',   roles: ['MANAGER', 'FIELD_WORKER'] },
  cancel:   { from: ['ASSIGNED', 'IN_PROGRESS', 'REJECTED'], to: 'CANCELLED',   roles: ['MANAGER'] },
  reopen:   { from: ['COMPLETED'],                           to: 'ASSIGNED',    roles: ['MANAGER'] },
  addEvidence:    { from: ['IN_PROGRESS'], to: null, roles: ['FIELD_WORKER'] },
  deleteEvidence: { from: ['IN_PROGRESS'], to: null, roles: ['FIELD_WORKER'] },
  addNote:        { from: ['IN_PROGRESS'], to: null, roles: ['FIELD_WORKER'] },
} as const satisfies Record<string, { from: readonly TaskStatus[]; to: TaskStatus | null; roles: readonly Role[] }>;

export function allowedActions(task: { status: TaskStatus; evidenceCount: number }, role: Role): TaskAction[];
```
The mobile app uses `allowedActions` to decide which buttons to show, and the API uses the same table to enforce the rules. Rules that depend on a condition (photo count, uploader, same worker) are checked by the API service, with matching helpers the app can use.

---

## 10. Push notification payloads

Sent through `expo-server-sdk` after commit. `data` is used for navigation when the user taps the push.

| Type | Recipients | Title | Body | data |
|---|---|---|---|---|
| `TASK_ASSIGNED` | new current worker | New task assigned | `{task.title}` | `{ type, taskId }` |
| `TASK_UPDATED` | current worker | Task updated | `{task.title}` | `{ type, taskId }` |
| `TASK_COMPLETED` | all managers except the completer | Task completed | `{task.title} · by {completer.name}` | `{ type, taskId }` |

- Titles are shortened to 100 characters.
- `DeviceNotRegistered` responses delete the token.
- Other push errors are logged at warn level.
- **TASK_UPDATED** is only sent to a worker who can still see the task; the edit rules guarantee this, since edits aren't allowed in COMPLETED or CANCELLED and a rejected task hides from the worker. A REJECTED task **skips** this push.

---

## 11. Validation layers (summary)

| Layer | What |
|---|---|
| Mobile | The shared Zod schemas through react-hook-form (field errors); file size is checked after compression |
| API (authoritative) | Shared Zod schemas (`.strict()`), UUID path parameters, file content sniffing and size, role, visibility, transitions, conditions |
| Database | NOT NULL, FK, UNIQUE, partial unique (one open assignment), CHECK (non-blank, lowercase email, coordinate ranges and pairing, completed_at ⇔ COMPLETED, rejection pairing, file_type, platform) |

---

## 12. Items needing approval

| # | Item | Why |
|---|---|---|
| **B1** | Add **`task_assignments.ended_at`** plus a partial unique index (one open assignment per task) | Lets the database guarantee "one worker at a time" and makes "current assignment" a simple indexed lookup. Alternative: work out the latest row by `assigned_at`, which needs slower queries and can't be enforced by the database. |
| **B2** | Rename `task_evidence.file_url` to **`file_key`** | The column stores a private object key, not a URL; the original name would mislead. |
| **B3** | Add index `tasks (updated_at DESC, id DESC)` | Needed for efficient cursor pagination on every task list. |
| **B4** | HTTP **429 `RATE_LIMITED`** for too many login attempts | The spec's status list has no status for rate limiting; 429 is the standard one. |
| **B5** | **Logout deletes all of the user's push tokens** | Logout already ends every session (Q1), so no signed-out device should keep receiving pushes. |
| **B6** | **Reject returns 204** (no task body); **`createdBy` isn't returned** in task responses | After rejecting, the worker can no longer see the task. No screen shows who created a task, so it isn't sent. |
