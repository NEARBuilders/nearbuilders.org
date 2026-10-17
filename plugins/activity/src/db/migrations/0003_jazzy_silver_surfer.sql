ALTER TABLE "activity_gateway_outbox" ADD COLUMN "occurred_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "activity_gateway_outbox" ADD COLUMN "superseded_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "activity_gateway_outbox_gateway_event_idx" ON "activity_gateway_outbox" USING btree ("gateway_event_id");