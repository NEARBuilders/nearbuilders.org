CREATE TABLE IF NOT EXISTS "bookmarks" (
  "id" text PRIMARY KEY NOT NULL,
  "entity_id" text NOT NULL,
  "user_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "bookmarks_entity_user_unique" ON "bookmarks" ("entity_id", "user_id");
