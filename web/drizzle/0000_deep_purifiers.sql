-- Baseline migration. Schema was previously synced via `drizzle-kit push
-- --force` so the prod tables already exist; this migration is written
-- idempotently so the first `drizzle-kit migrate` on the existing DB
-- registers the baseline without trying to recreate tables.

DO $$ BEGIN
 CREATE TYPE "public"."repeat_option" AS ENUM('No Repeat', 'Daily', 'Weekdays', 'Weekly', 'Monthly', 'Yearly', 'Custom');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."repeat_unit" AS ENUM('day', 'week', 'month', 'year');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "daily_progress" (
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"streak_before_today" integer DEFAULT 0 NOT NULL,
	"lives" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_progress_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"task_id" uuid,
	"task_snapshot" jsonb NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"due" text DEFAULT 'No Due Date' NOT NULL,
	"strict_deadline" boolean DEFAULT false NOT NULL,
	"repeat" "repeat_option" DEFAULT 'No Repeat' NOT NULL,
	"repeat_interval" integer DEFAULT 1 NOT NULL,
	"repeat_unit" "repeat_unit" DEFAULT 'day' NOT NULL,
	"repeat_weekdays" jsonb DEFAULT '[false,false,false,false,false,false,false]'::jsonb NOT NULL,
	"time_frame" integer DEFAULT 0 NOT NULL,
	"snooze" text,
	"subtasks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
