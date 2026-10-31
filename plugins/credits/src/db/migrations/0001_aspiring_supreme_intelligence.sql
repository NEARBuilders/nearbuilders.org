CREATE TABLE "credits_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"amount_usd" numeric(10, 2) DEFAULT '5.00' NOT NULL,
	"claims_close_at" timestamp with time zone,
	"key_expires_at" timestamp with time zone,
	"near_ai_workspace_id" text DEFAULT '' NOT NULL,
	"near_ai_login_account_id" text DEFAULT '' NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
