CREATE TABLE IF NOT EXISTS "builders" (
	"id" text PRIMARY KEY NOT NULL,
	"near_account" text NOT NULL,
	"user_id" text,
	"name" text,
	"bio" text,
	"skills" text,
	"location" text,
	"links" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "builders_near_account_unique" UNIQUE("near_account")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "builders_near_account_idx" ON "builders" USING btree ("near_account");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "builders_user_id_idx" ON "builders" USING btree ("user_id");