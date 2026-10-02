CREATE TABLE "proposal_evaluations" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"plugin_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"submission_count" integer NOT NULL,
	"verdict" text NOT NULL,
	"score" integer,
	"summary" text NOT NULL,
	"flags" text NOT NULL,
	"checks" text NOT NULL,
	"model" text,
	"source" text,
	"prompt_version" text NOT NULL,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_leases" (
	"name" text PRIMARY KEY NOT NULL,
	"holder" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_link_codes" (
	"code_hash" text PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"telegram_username" text,
	"telegram_name" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_reviewers" (
	"telegram_id" bigint PRIMARY KEY NOT NULL,
	"telegram_username" text,
	"telegram_name" text,
	"user_id" text NOT NULL,
	"user_label" text NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proposal_evaluations" ADD CONSTRAINT "proposal_evaluations_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_evaluations_submission_unique" ON "proposal_evaluations" USING btree ("proposal_id","submission_count");--> statement-breakpoint
CREATE INDEX "proposal_evaluations_entity_idx" ON "proposal_evaluations" USING btree ("plugin_id","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_reviewers_user_unique" ON "telegram_reviewers" USING btree ("user_id");