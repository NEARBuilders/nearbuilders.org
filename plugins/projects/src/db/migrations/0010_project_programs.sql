CREATE TABLE IF NOT EXISTS "project_programs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"rewards" text,
	"eligibility" text,
	"cta_label" text NOT NULL,
	"cta_url" text NOT NULL,
	"topic_id" text,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"status" text DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_programs" ADD CONSTRAINT "project_programs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_programs_project_idx" ON "project_programs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_programs_status_sort_idx" ON "project_programs" USING btree ("status","sort_order");
