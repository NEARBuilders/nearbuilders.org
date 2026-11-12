CREATE TABLE IF NOT EXISTS "project_status_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_status_results" (
	"id" text PRIMARY KEY NOT NULL,
	"check_id" text NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"state" text NOT NULL,
	"http_status" integer,
	"latency_ms" integer,
	"reason" text,
	"plugin_keys" jsonb
);
--> statement-breakpoint
ALTER TABLE "project_status_checks" ADD CONSTRAINT "project_status_checks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_status_results" ADD CONSTRAINT "project_status_results_check_id_project_status_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."project_status_checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_status_checks_project_idx" ON "project_status_checks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_status_checks_status_sort_idx" ON "project_status_checks" USING btree ("status","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_status_results_check_checked_idx" ON "project_status_results" USING btree ("check_id","checked_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_status_results_checked_idx" ON "project_status_results" USING btree ("checked_at");
