DROP INDEX IF EXISTS "projects_owner_slug_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "projects_slug_unique" ON "projects" USING btree ("slug");
