CREATE TABLE "nearcatalog_claim_history" (
	"id" text PRIMARY KEY NOT NULL,
	"claim_id" text NOT NULL,
	"near_account" text NOT NULL,
	"project_slug" text NOT NULL,
	"roles" jsonb NOT NULL,
	"activity_event_id" text,
	"action" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "nearcatalog_claim_history_claim_id_idx" ON "nearcatalog_claim_history" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "nearcatalog_claim_history_project_slug_idx" ON "nearcatalog_claim_history" USING btree ("project_slug");
--> statement-breakpoint
INSERT INTO "nearcatalog_claim_history" (
  "id",
  "claim_id",
  "near_account",
  "project_slug",
  "roles",
  "activity_event_id",
  "action",
  "occurred_at"
)
SELECT
  'claim-history:' || "id" || ':baseline',
  "id",
  "near_account",
  "project_slug",
  "roles",
  "activity_event_id",
  CASE WHEN "revoked_at" IS NULL THEN 'applied' ELSE 'revoked' END,
  "updated_at"
FROM "nearcatalog_claims";
