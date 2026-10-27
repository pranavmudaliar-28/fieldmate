-- Invitations, password resets and email changes by emailed code
-- (docs/07 §3). Admins no longer type a temporary password: they invite, and
-- the user chooses their own password from a code sent to their email.

-- NULL means an invitation is still pending. Every existing account already
-- has a password someone chose, so it counts as set from when it was created.
ALTER TABLE "users" ADD COLUMN "password_set_at" timestamp with time zone;--> statement-breakpoint
UPDATE "users" SET "password_set_at" = "created_at";--> statement-breakpoint

CREATE TYPE "user_code_purpose" AS ENUM ('INVITE', 'PASSWORD_RESET', 'EMAIL_CHANGE');--> statement-breakpoint

CREATE TABLE "user_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "purpose" "user_code_purpose" NOT NULL,
  "code_hash" text NOT NULL,
  "new_email" varchar(254),
  "attempts" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "user_codes" ADD CONSTRAINT "user_codes_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_codes_user_purpose_unique" ON "user_codes" USING btree ("user_id", "purpose");
