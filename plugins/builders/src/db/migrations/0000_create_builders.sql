CREATE TABLE IF NOT EXISTS "builders" (
  "id" text PRIMARY KEY NOT NULL,
  "near_account" text NOT NULL,
  "user_id" text,
  "name" text,
  "bio" text,
  "skills" text,
  "location" text,
  "links" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "rejection_reason" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "builders_near_account_idx" ON "builders" ("near_account");
CREATE INDEX IF NOT EXISTS "builders_status_idx" ON "builders" ("status");
CREATE INDEX IF NOT EXISTS "builders_user_id_idx" ON "builders" ("user_id");
