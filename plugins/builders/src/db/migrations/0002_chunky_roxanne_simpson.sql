ALTER TABLE "builder_nominations" ALTER COLUMN "nominee_telegram_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "builder_nominations" ALTER COLUMN "token_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "source_nominee_telegram_id" bigint;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "source_nominee_username_normalized" text;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "unresolved_username_normalized" text;--> statement-breakpoint
ALTER TABLE "builder_nominations" ADD COLUMN "canonical_nomination_id" text;--> statement-breakpoint
UPDATE "builder_nominations"
SET "source_nominee_telegram_id" = "nominee_telegram_id",
	"source_nominee_username_normalized" = LOWER("nominee_username");--> statement-breakpoint
WITH ranked AS (
	SELECT
		"id",
		FIRST_VALUE("id") OVER (
			PARTITION BY "nominee_telegram_id"
			ORDER BY "created_at", "id"
		) AS "canonical_id",
		ROW_NUMBER() OVER (
			PARTITION BY "nominee_telegram_id"
			ORDER BY "created_at", "id"
		) AS "position"
	FROM "builder_nominations"
	WHERE "nominee_telegram_id" IS NOT NULL
), linked AS (
	SELECT DISTINCT ON ("canonical_id")
		"canonical_id",
		"proposal_id",
		"submitted_near_account",
		"submitted_user_id",
		"submitted_at"
	FROM ranked
	JOIN "builder_nominations" ON "builder_nominations"."id" = ranked."id"
	WHERE "builder_nominations"."submitted_at" IS NOT NULL
	ORDER BY "canonical_id", "builder_nominations"."submitted_at", "builder_nominations"."id"
)
UPDATE "builder_nominations" AS canonical
SET "proposal_id" = COALESCE(canonical."proposal_id", linked."proposal_id"),
	"submitted_near_account" = COALESCE(canonical."submitted_near_account", linked."submitted_near_account"),
	"submitted_user_id" = COALESCE(canonical."submitted_user_id", linked."submitted_user_id"),
	"submitted_at" = COALESCE(canonical."submitted_at", linked."submitted_at")
FROM linked
WHERE canonical."id" = linked."canonical_id";--> statement-breakpoint
WITH ranked AS (
	SELECT
		"id",
		FIRST_VALUE("id") OVER (
			PARTITION BY "nominee_telegram_id"
			ORDER BY "created_at", "id"
		) AS "canonical_id",
		ROW_NUMBER() OVER (
			PARTITION BY "nominee_telegram_id"
			ORDER BY "created_at", "id"
		) AS "position"
	FROM "builder_nominations"
	WHERE "nominee_telegram_id" IS NOT NULL
)
UPDATE "builder_nominations" AS nomination
SET "nominee_telegram_id" = NULL,
	"canonical_nomination_id" = ranked."canonical_id"
FROM ranked
WHERE nomination."id" = ranked."id"
	AND ranked."position" > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "builder_nominations_telegram_id_unique" ON "builder_nominations" USING btree ("nominee_telegram_id");--> statement-breakpoint
CREATE UNIQUE INDEX "builder_nominations_unresolved_username_unique" ON "builder_nominations" USING btree ("unresolved_username_normalized");
