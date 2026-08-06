CREATE TABLE "feedback_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_near_account" text NOT NULL,
	"project_id" text NOT NULL,
	"project_slug" text NOT NULL,
	"project_kind" text NOT NULL,
	"project_title" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"testers_wanted" integer NOT NULL,
	"timeframe_days" integer NOT NULL,
	"target_repo" text NOT NULL,
	"requirements" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "feedback_requests_status_idx" ON "feedback_requests" ("status");
--> statement-breakpoint
CREATE INDEX "feedback_requests_owner_idx" ON "feedback_requests" ("owner_near_account");
--> statement-breakpoint
CREATE INDEX "feedback_requests_project_idx" ON "feedback_requests" ("project_id");
