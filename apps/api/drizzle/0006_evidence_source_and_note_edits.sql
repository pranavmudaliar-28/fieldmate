-- Two relaxations of rules that were deliberate, now deliberately reversed.
--
-- 1. Photos may come from the gallery as well as the camera (docs/02 F-006).
--    Camera-only was what made a photo evidence rather than an image, so the
--    record now says which it was instead of the rule guaranteeing it.
--
-- 2. A worker may edit and delete their own notes while the task is in
--    progress (docs/02 F-007). `updated_at` was removed in the original schema
--    because notes could not be edited; it comes back so an edit is never
--    silent.

CREATE TYPE "evidence_source" AS ENUM ('CAMERA', 'GALLERY');--> statement-breakpoint

-- Every existing photo really was taken with the camera: it was the only way
-- to add one. Backfilling them as CAMERA states a fact, not an assumption.
ALTER TABLE "task_evidence"
  ADD COLUMN "source" "evidence_source" NOT NULL DEFAULT 'CAMERA';--> statement-breakpoint

-- New rows must say for themselves, so the default is dropped once the
-- backfill has used it.
ALTER TABLE "task_evidence" ALTER COLUMN "source" DROP DEFAULT;--> statement-breakpoint

-- Null means never edited, which is what almost every note will be.
ALTER TABLE "task_notes" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint

ALTER TABLE "task_notes" ADD CONSTRAINT "task_notes_updated_after_created"
  CHECK ("updated_at" IS NULL OR "updated_at" >= "created_at");
