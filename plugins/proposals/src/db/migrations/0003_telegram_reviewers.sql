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
CREATE UNIQUE INDEX "telegram_reviewers_user_unique" ON "telegram_reviewers" USING btree ("user_id");