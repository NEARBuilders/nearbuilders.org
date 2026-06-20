DROP INDEX IF EXISTS "events_owner_slug_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "events_slug_unique" ON "events" USING btree ("slug");