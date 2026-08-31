ALTER TABLE "builders" ADD COLUMN "withdrawn_at" timestamp;--> statement-breakpoint
CREATE INDEX "builders_withdrawn_at_idx" ON "builders" USING btree ("withdrawn_at");