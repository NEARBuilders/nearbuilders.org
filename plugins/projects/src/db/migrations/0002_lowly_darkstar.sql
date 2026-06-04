ALTER TABLE "project_apps" RENAME COLUMN "gateway_id" TO "domain";--> statement-breakpoint
DROP INDEX IF EXISTS "project_app_unique";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_app_unique" ON "project_apps" USING btree ("project_id","account_id","domain");--> statement-breakpoint
ALTER TABLE "project_apps" DROP COLUMN IF EXISTS "position";