ALTER TYPE "public"."task_status" ADD VALUE 'ACCEPTED' BEFORE 'IN_PROGRESS';--> statement-breakpoint
ALTER TYPE "public"."task_status" ADD VALUE 'GOING_TO_LOCATION' BEFORE 'IN_PROGRESS';--> statement-breakpoint
ALTER TYPE "public"."task_status" ADD VALUE 'REACHED_LOCATION' BEFORE 'IN_PROGRESS';--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "departed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "arrived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "started_at" timestamp with time zone;