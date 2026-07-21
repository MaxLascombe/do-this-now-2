CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"workday_start_min" integer DEFAULT 510 NOT NULL,
	"workday_end_min" integer DEFAULT 1440 NOT NULL,
	"horizon_days" integer DEFAULT 14 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
