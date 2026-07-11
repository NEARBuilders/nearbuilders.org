CREATE TABLE "nearcatalog_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"near_account" text NOT NULL,
	"project_slug" text NOT NULL,
	"roles" jsonb NOT NULL,
	"activity_event_id" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "nearcatalog_claims_builder_project_unique" ON "nearcatalog_claims" USING btree ("near_account","project_slug");--> statement-breakpoint
CREATE INDEX "nearcatalog_claims_near_account_idx" ON "nearcatalog_claims" USING btree ("near_account");--> statement-breakpoint
CREATE INDEX "nearcatalog_claims_project_slug_idx" ON "nearcatalog_claims" USING btree ("project_slug");--> statement-breakpoint
CREATE INDEX "nearcatalog_claims_revoked_at_idx" ON "nearcatalog_claims" USING btree ("revoked_at");