ALTER TABLE "nearcatalog_listings" ADD COLUMN IF NOT EXISTS "catalog_url" text;--> statement-breakpoint
ALTER TABLE "nearcatalog_listings" ADD COLUMN IF NOT EXISTS "send_status" text;--> statement-breakpoint
ALTER TABLE "nearcatalog_listings" ADD COLUMN IF NOT EXISTS "send_action" text;--> statement-breakpoint
ALTER TABLE "nearcatalog_listings" ADD COLUMN IF NOT EXISTS "send_error" text;--> statement-breakpoint
ALTER TABLE "nearcatalog_listings" ADD COLUMN IF NOT EXISTS "send_attempted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "nearcatalog_listings" ADD COLUMN IF NOT EXISTS "sent_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nearcatalog_listings_send_status_idx" ON "nearcatalog_listings" USING btree ("send_status");