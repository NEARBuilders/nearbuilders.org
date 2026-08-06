CREATE TABLE "feedback_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"applicant_near_account" text NOT NULL,
	"note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"request_title" text NOT NULL,
	"request_project_title" text NOT NULL,
	"request_target_repo" text NOT NULL,
	"applied_at" text NOT NULL,
	"decided_at" text,
	"decided_by" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_applications_request_applicant_unique" ON "feedback_applications" ("request_id","applicant_near_account");
--> statement-breakpoint
CREATE INDEX "feedback_applications_request_idx" ON "feedback_applications" ("request_id");
--> statement-breakpoint
CREATE INDEX "feedback_applications_applicant_idx" ON "feedback_applications" ("applicant_near_account");
--> statement-breakpoint
CREATE INDEX "feedback_applications_status_idx" ON "feedback_applications" ("status");
