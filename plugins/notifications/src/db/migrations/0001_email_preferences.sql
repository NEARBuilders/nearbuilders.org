CREATE TABLE "email_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"email" text,
	"verified_at" timestamp with time zone,
	"pending_email" text,
	"code_hash" text,
	"code_expires_at" timestamp with time zone
);
