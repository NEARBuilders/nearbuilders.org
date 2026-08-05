import { integer, pgTable, text } from "drizzle-orm/pg-core";

export const feedbackRequests = pgTable("feedback_requests", {
  id: text("id").primaryKey(),
  ownerNearAccount: text("owner_near_account").notNull(),
  projectId: text("project_id").notNull(),
  projectSlug: text("project_slug").notNull(),
  projectKind: text("project_kind").notNull(),
  projectTitle: text("project_title").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  testersWanted: integer("testers_wanted").notNull(),
  timeframeDays: integer("timeframe_days").notNull(),
  targetRepo: text("target_repo").notNull(),
  requirements: text("requirements"),
  status: text("status", {
    enum: ["open", "filling", "testing", "complete", "closed"],
  })
    .notNull()
    .default("open"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});
