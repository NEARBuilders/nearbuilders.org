CREATE TABLE "email_code_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_preferences" ADD COLUMN "code_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "email_code_requests_user_idx" ON "email_code_requests" USING btree ("user_id","requested_at");--> statement-breakpoint
CREATE INDEX "email_code_requests_email_idx" ON "email_code_requests" USING btree ("email","requested_at");
