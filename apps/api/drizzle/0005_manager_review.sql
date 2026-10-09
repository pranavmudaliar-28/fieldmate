-- A manager looks at finished work before it counts as done (docs/02 F-008).
--
-- Work a worker finishes now lands in AWAITING_REVIEW rather than COMPLETED.
-- A manager either approves it, or hands it back to IN_PROGRESS with a note
-- saying what to put right. A manager who finishes the work themselves has
-- nobody to review it, so they still go straight to COMPLETED.

ALTER TYPE "task_status" ADD VALUE IF NOT EXISTS 'AWAITING_REVIEW' BEFORE 'COMPLETED';--> statement-breakpoint

ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'TASK_AWAITING_REVIEW';--> statement-breakpoint
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'TASK_CHANGES_REQUESTED';--> statement-breakpoint

-- When the worker handed it over. Cleared on reassign and reopen, with the
-- rest of the worker's progress.
ALTER TABLE "tasks" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "reviewed_by" uuid REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint

-- The reason the last review handed the work back. Outlives that review so the
-- worker can still read what was asked while they put it right; cleared when a
-- review accepts the work.
ALTER TABLE "tasks" ADD COLUMN "review_note" varchar(1000);--> statement-breakpoint

-- A review is one event: who looked and when travel together.
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_reviewed_together"
  CHECK (("reviewed_at" IS NULL) = ("reviewed_by" IS NULL));
