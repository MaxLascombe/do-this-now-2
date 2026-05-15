CREATE TYPE "public"."timeframe_type" AS ENUM('fixed', 'fluid');--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "time_frame" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "history" ADD COLUMN "actual_seconds" double precision;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "timekeeper_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "timeframe_type" timeframe_type DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "timer_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "timer_accumulated_seconds" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "measurement_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_timekeeper_id_tasks_id_fk" FOREIGN KEY ("timekeeper_id") REFERENCES "public"."tasks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_timekeeper_id_idx" ON "tasks" USING btree ("timekeeper_id");--> statement-breakpoint

-- ---------------------------------------------------------------------
-- Backfill orphan zero-timeFrame tasks with their human-confirmed
-- timekeepers. Hardcoded IDs because the pairings came from a manual
-- review pass (see PR description). Idempotent: only fills rows whose
-- timekeeper is still NULL, so re-running the migration is a no-op.
-- ---------------------------------------------------------------------
UPDATE "tasks" SET "timekeeper_id" = '076513df-fef3-476e-81c6-5a5546a419a5'
  WHERE "id" = '6b473b72-f19c-42fc-a4b6-dbbf57330da3' AND "timekeeper_id" IS NULL;--> statement-breakpoint
UPDATE "tasks" SET "timekeeper_id" = '076513df-fef3-476e-81c6-5a5546a419a5'
  WHERE "id" = '39591bc9-ab36-4186-b748-7aa1f23ad262' AND "timekeeper_id" IS NULL;--> statement-breakpoint
UPDATE "tasks" SET "timekeeper_id" = '076513df-fef3-476e-81c6-5a5546a419a5'
  WHERE "id" = '2cf569e7-17d7-4d98-80ed-858d8b12eaba' AND "timekeeper_id" IS NULL;--> statement-breakpoint
UPDATE "tasks" SET "timekeeper_id" = 'd79e9619-7936-4243-a7cb-ff869fefa82a'
  WHERE "id" = 'cd6bc157-0866-4ad2-bd65-53232ee1a201' AND "timekeeper_id" IS NULL;--> statement-breakpoint
UPDATE "tasks" SET "timekeeper_id" = '076513df-fef3-476e-81c6-5a5546a419a5'
  WHERE "id" = '99634e68-25b0-4fc0-9968-16ecf1206dbe' AND "timekeeper_id" IS NULL;--> statement-breakpoint
UPDATE "tasks" SET "timekeeper_id" = '076513df-fef3-476e-81c6-5a5546a419a5'
  WHERE "id" = 'd3c81121-2e22-472c-9713-fdadc6452408' AND "timekeeper_id" IS NULL;--> statement-breakpoint

-- ---------------------------------------------------------------------
-- After backfill, enforce the XOR rule:
--   timeFrame > 0  ⇔  timekeeperId IS NULL
--   timeFrame = 0  ⇔  timekeeperId IS NOT NULL
-- Plus: no task can be its own keeper (the keeper-is-fixed and
-- keeper-has-positive-timeFrame rules are enforced app-side at write).
-- ---------------------------------------------------------------------
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_timeframe_timekeeper_xor"
  CHECK (
    ("time_frame" > 0 AND "timekeeper_id" IS NULL) OR
    ("time_frame" = 0 AND "timekeeper_id" IS NOT NULL)
  );--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_timekeeper_not_self"
  CHECK ("timekeeper_id" IS NULL OR "timekeeper_id" <> "id");
