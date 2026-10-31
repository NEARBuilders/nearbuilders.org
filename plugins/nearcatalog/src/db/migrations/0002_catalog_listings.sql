CREATE TABLE IF NOT EXISTS "nearcatalog_listings" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"entity_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"slug" text NOT NULL,
	"status" text NOT NULL,
	"record" jsonb,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "nearcatalog_listings_kind_entity_unique" ON "nearcatalog_listings" USING btree ("kind","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nearcatalog_listings_kind_slug_idx" ON "nearcatalog_listings" USING btree ("kind","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nearcatalog_listings_status_idx" ON "nearcatalog_listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nearcatalog_listings_changed_at_idx" ON "nearcatalog_listings" USING btree ("changed_at");