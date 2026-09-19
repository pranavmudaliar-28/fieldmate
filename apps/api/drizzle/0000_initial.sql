CREATE TYPE "public"."task_status" AS ENUM('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('MANAGER', 'FIELD_WORKER');--> statement-breakpoint
CREATE TABLE "device_push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"platform" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_push_tokens_token_unique" UNIQUE("token"),
	CONSTRAINT "device_push_tokens_platform" CHECK ("device_push_tokens"."platform" IN ('ios', 'android'))
);
--> statement-breakpoint
CREATE TABLE "task_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rejection_reason" varchar(1000),
	"rejected_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	CONSTRAINT "task_assignments_rejection_pair" CHECK (("task_assignments"."rejection_reason" IS NULL) = ("task_assignments"."rejected_at" IS NULL)),
	CONSTRAINT "task_assignments_ended_after_assigned" CHECK ("task_assignments"."ended_at" IS NULL OR "task_assignments"."ended_at" >= "task_assignments"."assigned_at")
);
--> statement-breakpoint
CREATE TABLE "task_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"file_key" varchar(300) NOT NULL,
	"file_type" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_evidence_file_key_unique" UNIQUE("file_key"),
	CONSTRAINT "task_evidence_file_type" CHECK ("task_evidence"."file_type" IN ('image/jpeg', 'image/png'))
);
--> statement-breakpoint
CREATE TABLE "task_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"address" varchar(500) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_locations_task_id_unique" UNIQUE("task_id"),
	CONSTRAINT "task_locations_lat_range" CHECK ("task_locations"."latitude" BETWEEN -90 AND 90),
	CONSTRAINT "task_locations_lng_range" CHECK ("task_locations"."longitude" BETWEEN -180 AND 180),
	CONSTRAINT "task_locations_coords_pair" CHECK (("task_locations"."latitude" IS NULL) = ("task_locations"."longitude" IS NULL)),
	CONSTRAINT "task_locations_address_not_blank" CHECK (length(trim("task_locations"."address")) > 0)
);
--> statement-breakpoint
CREATE TABLE "task_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"content" varchar(5000) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_notes_content_not_blank" CHECK (length(trim("task_notes"."content")) > 0)
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" varchar(5000) NOT NULL,
	"status" "task_status" DEFAULT 'ASSIGNED' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "tasks_title_not_blank" CHECK (length(trim("tasks"."title")) > 0),
	CONSTRAINT "tasks_description_not_blank" CHECK (length(trim("tasks"."description")) > 0),
	CONSTRAINT "tasks_completed_at_matches_status" CHECK (("tasks"."status" = 'COMPLETED') = ("tasks"."completed_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"token_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_name_not_blank" CHECK (length(trim("users"."name")) > 0),
	CONSTRAINT "users_email_lowercase" CHECK ("users"."email" = lower("users"."email")),
	CONSTRAINT "users_token_version_non_negative" CHECK ("users"."token_version" >= 0)
);
--> statement-breakpoint
ALTER TABLE "device_push_tokens" ADD CONSTRAINT "device_push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_worker_id_users_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_evidence" ADD CONSTRAINT "task_evidence_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_evidence" ADD CONSTRAINT "task_evidence_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_locations" ADD CONSTRAINT "task_locations_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_notes" ADD CONSTRAINT "task_notes_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_notes" ADD CONSTRAINT "task_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "device_push_tokens_user_id_idx" ON "device_push_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "task_assignments_task_id_idx" ON "task_assignments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_assignments_worker_id_idx" ON "task_assignments" USING btree ("worker_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_assignments_one_open_uq" ON "task_assignments" USING btree ("task_id") WHERE "task_assignments"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX "task_evidence_task_id_idx" ON "task_evidence" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_notes_task_id_idx" ON "task_notes" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "tasks_created_by_idx" ON "tasks" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_updated_at_id_idx" ON "tasks" USING btree ("updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);