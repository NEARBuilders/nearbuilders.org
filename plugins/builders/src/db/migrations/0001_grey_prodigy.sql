CREATE TABLE "builder_nominations" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"source_nomination_id" text NOT NULL,
	"nominee_telegram_id" bigint NOT NULL,
	"nominee_username" text,
	"nominated_by_telegram_id" bigint NOT NULL,
	"telegram_group_id" bigint NOT NULL,
	"created_by_api_key_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"proposal_id" text,
	"submitted_near_account" text,
	"submitted_user_id" text,
	"submitted_at" timestamp
);
--> statement-breakpoint
CREATE UNIQUE INDEX "builder_nominations_source_unique" ON "builder_nominations" USING btree ("source","source_nomination_id");--> statement-breakpoint
CREATE UNIQUE INDEX "builder_nominations_token_hash_unique" ON "builder_nominations" USING btree ("token_hash");