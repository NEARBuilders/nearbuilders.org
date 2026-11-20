ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "city_node" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_city_node_idx" ON "projects" USING btree ("city_node");
