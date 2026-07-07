CREATE TABLE "user_state" (
	"user_id" text PRIMARY KEY NOT NULL,
	"selected_task_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_state" ADD CONSTRAINT "user_state_selected_task_id_tasks_id_fk" FOREIGN KEY ("selected_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;