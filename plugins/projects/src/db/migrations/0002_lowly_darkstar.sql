DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_apps' AND column_name = 'gateway_id') THEN
    ALTER TABLE "project_apps" RENAME COLUMN "gateway_id" TO "domain";
  END IF;
END $$;
--> statement-breakpoint
DROP INDEX IF EXISTS "project_app_unique";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_app_unique" ON "project_apps" USING btree ("project_id","account_id","domain");--> statement-breakpoint
ALTER TABLE "project_apps" DROP COLUMN IF EXISTS "position";