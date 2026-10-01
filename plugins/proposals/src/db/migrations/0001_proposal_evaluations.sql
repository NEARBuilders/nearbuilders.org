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
	"prompt_version" text NOT NULL,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proposal_evaluations" ADD CONSTRAINT "proposal_evaluations_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_evaluations_submission_unique" ON "proposal_evaluations" USING btree ("proposal_id","submission_count");--> statement-breakpoint
CREATE INDEX "proposal_evaluations_entity_idx" ON "proposal_evaluations" USING btree ("plugin_id","entity_id");