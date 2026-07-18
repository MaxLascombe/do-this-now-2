CREATE TYPE "public"."live_push_token_kind" AS ENUM('start', 'update');--> statement-breakpoint
CREATE TABLE "live_push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"device_id" uuid NOT NULL,
	"kind" "live_push_token_kind" NOT NULL,
	"token" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lock_screen_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lock_screen_devices_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "live_push_tokens" ADD CONSTRAINT "live_push_tokens_device_id_lock_screen_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."lock_screen_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "live_push_tokens_user_id_idx" ON "live_push_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "live_push_tokens_device_kind_idx" ON "live_push_tokens" USING btree ("device_id","kind");--> statement-breakpoint
CREATE INDEX "lock_screen_devices_user_id_idx" ON "lock_screen_devices" USING btree ("user_id");