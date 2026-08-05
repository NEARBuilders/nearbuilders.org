CREATE TABLE IF NOT EXISTS "issue_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"repo_owner" text NOT NULL,
	"repo_name" text NOT NULL,
	"issue_number" integer NOT NULL,
	"issue_title" text NOT NULL,
	"issue_url" text NOT NULL,
	"near_account" text NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"released_at" timestamp with time zone,
	"pr_url" text,
	"pr_state" text,
	"pr_checked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "issue_claims_repo_issue_active_unique" ON "issue_claims" USING btree ("repo_owner","repo_name","issue_number","released_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issue_claims_near_account_idx" ON "issue_claims" USING btree ("near_account");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issue_claims_expires_at_idx" ON "issue_claims" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issue_claims_released_at_idx" ON "issue_claims" USING btree ("released_at");
