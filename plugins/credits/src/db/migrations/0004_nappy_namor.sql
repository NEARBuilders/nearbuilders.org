ALTER TABLE "credits_settings" ADD COLUMN "near_ai_org_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "nearai_sessions" ADD COLUMN "org_id" text;--> statement-breakpoint
ALTER TABLE "nearai_sessions" ADD COLUMN "reporting_token" text;