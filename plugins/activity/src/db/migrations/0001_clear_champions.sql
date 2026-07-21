ALTER TABLE "activity_events" ADD COLUMN IF NOT EXISTS "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "activity_events" ADD COLUMN IF NOT EXISTS "hidden_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_events_hidden_at_idx" ON "activity_events" USING btree ("hidden_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "activity_events_idempotency_key_unique" ON "activity_events" USING btree ("idempotency_key");