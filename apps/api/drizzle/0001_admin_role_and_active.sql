ALTER TYPE "public"."user_role" ADD VALUE 'ADMIN' BEFORE 'MANAGER';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");