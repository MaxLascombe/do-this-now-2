-- Drop the legacy 'No Due Date' default and backfill any rows that still
-- carry the sentinel. The app no longer allows tasks without a due date —
-- schema-level zod validation rejects 'No Due Date', and the form defaults
-- to today. Existing rows (likely from the DynamoDB import) are migrated
-- to today's date so they show up as overdue rather than vanishing.

UPDATE "tasks"
SET "due" = TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-FMMM-FMDD')
WHERE "due" = 'No Due Date';
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "due" DROP DEFAULT;
