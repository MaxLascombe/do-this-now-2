CREATE TABLE "emoji_suggestions" (
	"title" text PRIMARY KEY NOT NULL,
	"emojis" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
