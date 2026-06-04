CREATE TABLE IF NOT EXISTS "project_apps" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"account_id" text NOT NULL,
	"gateway_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"organization_id" text,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_apps" ADD CONSTRAINT "project_apps_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_app_unique" ON "project_apps" USING btree ("project_id","account_id","gateway_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "projects_owner_slug_unique" ON "projects" USING btree ("owner_id","slug");