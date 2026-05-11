-- Before this migration, history.task_id had no foreign key, so deleting
-- a task left orphaned task_id values. Clear those first or the FK
-- constraint addition will fail on existing data.

UPDATE "history" SET "task_id" = NULL
WHERE "task_id" IS NOT NULL
  AND "task_id" NOT IN (SELECT "id" FROM "tasks");
--> statement-breakpoint
ALTER TABLE "history" ADD CONSTRAINT "history_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;
