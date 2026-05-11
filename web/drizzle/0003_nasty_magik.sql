-- Both tables previously had no index beyond their PK / FK; every query
-- in this app scopes by user_id so Postgres was sequential-scanning. Add
-- the supporting indexes for the two common access patterns:
--   - tasks: WHERE user_id = ?
--   - history: WHERE user_id = ? AND completed_at >= ? AND completed_at < ?
-- IF NOT EXISTS so the migration is safe to re-run / safe against the
-- (unlikely) case the indexes were added out-of-band.

CREATE INDEX IF NOT EXISTS "history_user_id_completed_at_idx" ON "history" USING btree ("user_id","completed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_user_id_idx" ON "tasks" USING btree ("user_id");
