CREATE TABLE "activity_gateway_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"operation" text NOT NULL,
	"legacy_event_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"legacy_source" text NOT NULL,
	"legacy_type" text NOT NULL,
	"event_type" text NOT NULL,
	"actor" text NOT NULL,
	"payload" jsonb,
	"reason" text,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"gateway_event_id" text,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "activity_gateway_outbox_operation_key_unique" ON "activity_gateway_outbox" USING btree ("operation","idempotency_key");--> statement-breakpoint
CREATE INDEX "activity_gateway_outbox_status_next_attempt_idx" ON "activity_gateway_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "activity_gateway_outbox_legacy_event_idx" ON "activity_gateway_outbox" USING btree ("legacy_event_id");