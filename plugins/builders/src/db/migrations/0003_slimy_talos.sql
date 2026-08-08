CREATE TABLE "builder_x_identities" (
	"id" text PRIMARY KEY NOT NULL,
	"x_user_id" text,
	"username" text NOT NULL,
	"username_normalized" text NOT NULL,
	"builder_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "builder_nominations" ALTER COLUMN "nominated_by_telegram_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "builder_nominations" ALTER COLUMN "telegram_group_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "source_post_url" text;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "source_post_text" text;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "source_post_created_at" timestamp;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "conversation_id" text;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "reply_to_post_id" text;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "source_nominee_x_id" text;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "source_nominee_x_username" text;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "nominee_x_id" text;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "nominee_x_username" text;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "nominator_x_id" text;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "nominator_x_username" text;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "engagement_status" text DEFAULT 'pending_contact' NOT NULL;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "reply_url" text;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "contacted_at" timestamp;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "rejected_at" timestamp;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "engagement_updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "first_opened_at" timestamp;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "last_opened_at" timestamp;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "open_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "builder_x_identities_x_user_id_unique" ON "builder_x_identities" USING btree ("x_user_id");--> statement-breakpoint
CREATE INDEX "builder_x_identities_username_idx" ON "builder_x_identities" USING btree ("username_normalized");--> statement-breakpoint
CREATE INDEX "builder_x_identities_builder_idx" ON "builder_x_identities" USING btree ("builder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "builder_nominations_x_id_unique" ON "builder_nominations" USING btree ("nominee_x_id");--> statement-breakpoint
CREATE INDEX "builder_nominations_source_nominee_x_id_idx" ON "builder_nominations" USING btree ("source_nominee_x_id");--> statement-breakpoint
CREATE INDEX "builder_nominations_source_nominee_x_username_idx" ON "builder_nominations" USING btree ("source_nominee_x_username");--> statement-breakpoint
CREATE INDEX "builder_nominations_engagement_status_idx" ON "builder_nominations" USING btree ("engagement_status");--> statement-breakpoint
CREATE INDEX "builder_nominations_canonical_idx" ON "builder_nominations" USING btree ("canonical_nomination_id");--> statement-breakpoint
WITH candidates AS (
	SELECT
		"id" AS "builder_id",
		(regexp_match(
			"links",
			'"(?:twitter|x)"\s*:\s*"https?://(?:www\.)?(?:x\.com|twitter\.com)/([A-Za-z0-9_]{1,15})(?:[/?#]|\")'
		))[1] AS "username"
	FROM "builders"
	WHERE "links" IS NOT NULL
		AND "links" ~* '"(?:twitter|x)"\s*:\s*"https?://(?:www\.)?(?:x\.com|twitter\.com)/[A-Za-z0-9_]{1,15}(?:[/?#]|\")'
)
INSERT INTO "builder_x_identities" (
	"id",
	"x_user_id",
	"username",
	"username_normalized",
	"builder_id",
	"created_at",
	"updated_at"
)
SELECT
	'xlegacy_' || md5("builder_id" || ':' || lower("username")),
	NULL,
	"username",
	lower("username"),
	"builder_id",
	now(),
	now()
FROM candidates
WHERE "username" IS NOT NULL;
