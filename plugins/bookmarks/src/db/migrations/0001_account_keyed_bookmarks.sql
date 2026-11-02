-- Key bookmarks on the owner's NEAR account (#329). user_id stays for rows written before this
-- and for callers with no NEAR account; legacy rows are claimed onto an account lazily.
ALTER TABLE "bookmarks" ADD COLUMN IF NOT EXISTS "near_account" text;
--> statement-breakpoint
ALTER TABLE "bookmarks" ALTER COLUMN "user_id" DROP NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bookmarks_entity_near_account_unique" ON "bookmarks" ("entity_id", "near_account");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookmarks_near_account_idx" ON "bookmarks" ("near_account");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookmarks_user_id_idx" ON "bookmarks" ("user_id");
