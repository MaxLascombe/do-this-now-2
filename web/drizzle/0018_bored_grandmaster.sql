CREATE TYPE "public"."task_surface" AS ENUM('anytime', 'counting', 'due');--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "surface" "task_surface" DEFAULT 'anytime' NOT NULL;--> statement-breakpoint
UPDATE "tasks" SET "surface" = 'due' WHERE "can_do_early" = false;
