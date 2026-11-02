-- Key upvotes on the owner's NEAR account (#329). user_id stays for rows written before this
-- and for callers with no NEAR account; legacy rows are claimed onto an account lazily.
ALTER TABLE "upvotes" ADD COLUMN IF NOT EXISTS "near_account" text;
--> statement-breakpoint
ALTER TABLE "upvotes" ALTER COLUMN "user_id" DROP NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "upvotes_thing_near_account_unique" ON "upvotes" ("thing_id", "near_account");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upvotes_near_account_idx" ON "upvotes" ("near_account");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upvotes_user_id_idx" ON "upvotes" ("user_id");
