CREATE TABLE "credit_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"near_account_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text NOT NULL,
	"spend_limit_cents" integer NOT NULL,
	"key_expires_at" timestamp with time zone NOT NULL,
	"key_id" text,
	"key_prefix" text,
	"ip" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "nearai_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"refresh_token" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "credit_claims_near_account_unique" ON "credit_claims" USING btree ("near_account_id");