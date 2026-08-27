ALTER TABLE "builders" ADD COLUMN IF NOT EXISTS "hidden_at" timestamp;--> statement-breakpoint
ALTER TABLE "builders" ADD COLUMN IF NOT EXISTS "purge_requested_at" timestamp;
