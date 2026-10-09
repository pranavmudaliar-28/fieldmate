-- The in-app inbox, so an event survives a missed or disabled push (docs/02 F-009).
--
-- A row is written whenever a user is told something, whether or not a push
-- reaches their device: pushes are best-effort and a worker who declined the
-- permission would otherwise never learn that a task was cancelled.

CREATE TYPE "notification_type" AS ENUM (
  'TASK_ASSIGNED',
  'TASK_UPDATED',
  'TASK_COMPLETED',
  'TASK_REJECTED',
  'TASK_CANCELLED',
  'TASK_REOPENED'
);

CREATE TABLE "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- Cascades: notifications are not history, so they must never be the reason
  -- a user cannot be deleted (docs/07 §2 keeps that guard on tasks alone).
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "type" "notification_type" NOT NULL,
  "title" varchar(100) NOT NULL,
  "body" varchar(200) NOT NULL,
  -- Null until the user opens it.
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- The inbox is always one user's, newest first, and pages by keyset like tasks do.
CREATE INDEX "notifications_user_created_idx"
  ON "notifications" ("user_id", "created_at" DESC, "id" DESC);

-- Counting the badge must not scan a user's whole history.
CREATE INDEX "notifications_unread_idx"
  ON "notifications" ("user_id") WHERE "read_at" IS NULL;
