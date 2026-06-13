CREATE TABLE IF NOT EXISTS "project_mentions" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"target_owner_id" text NOT NULL,
	"target_slug" text NOT NULL,
	"target_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_mentions" ADD CONSTRAINT "project_mentions_source_id_projects_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_mention_unique" ON "project_mentions" USING btree ("source_id","target_owner_id","target_slug");
