CREATE TABLE IF NOT EXISTS "proposal_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"plugin_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"actor" text NOT NULL,
	"actor_label" text,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "proposal_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"plugin_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"submitted_by" text NOT NULL,
	"source" text,
	"idempotency_key" text,
	"payload" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"plugin_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"operation" text DEFAULT 'create' NOT NULL,
	"payload" text NOT NULL,
	"schema_version" text DEFAULT '1' NOT NULL,
	"created_by" text NOT NULL,
	"review_status" text DEFAULT 'pending' NOT NULL,
	"apply_status" text DEFAULT 'not_started' NOT NULL,
	"remove_status" text DEFAULT 'not_started' NOT NULL,
	"rejection_reason" text,
	"apply_error" text,
	"remove_error" text,
	"applied_resource_id" text,
	"applied_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proposal_audit_log" ADD CONSTRAINT "proposal_audit_log_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_submissions" ADD CONSTRAINT "proposal_submissions_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposal_audit_entity_idx" ON "proposal_audit_log" USING btree ("plugin_id","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposal_audit_proposal_idx" ON "proposal_audit_log" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposal_submissions_proposal_idx" ON "proposal_submissions" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposal_submissions_entity_idx" ON "proposal_submissions" USING btree ("plugin_id","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "proposal_submissions_idempotency_unique" ON "proposal_submissions" USING btree ("plugin_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "proposals_plugin_entity_operation_unique" ON "proposals" USING btree ("plugin_id","entity_id","operation");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposals_plugin_status_idx" ON "proposals" USING btree ("plugin_id","review_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposals_entity_idx" ON "proposals" USING btree ("plugin_id","entity_id");