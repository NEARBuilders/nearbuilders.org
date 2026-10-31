ALTER TABLE "builders" ADD COLUMN "city_node" text;--> statement-breakpoint
CREATE INDEX "builders_city_node_idx" ON "builders" USING btree ("city_node");