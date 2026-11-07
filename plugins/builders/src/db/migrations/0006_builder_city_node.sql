ALTER TABLE "builders" ADD COLUMN IF NOT EXISTS "city_node" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "builders_city_node_idx" ON "builders" USING btree ("city_node");