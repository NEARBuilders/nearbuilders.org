import { integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

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

export const feedbackApplications = pgTable(
  "feedback_applications",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    applicantNearAccount: text("applicant_near_account").notNull(),
    note: text("note"),
    status: text("status", {
      enum: ["pending", "selected", "rejected", "withdrawn"],
    })
      .notNull()
      .default("pending"),
    requestTitle: text("request_title").notNull(),
    requestProjectTitle: text("request_project_title").notNull(),
    requestTargetRepo: text("request_target_repo").notNull(),
    appliedAt: text("applied_at").notNull(),
    decidedAt: text("decided_at"),
    decidedBy: text("decided_by"),
    filedIssues: text("filed_issues"),
    submittedAt: text("submitted_at"),
  },
  (table) => [
    uniqueIndex("feedback_applications_request_applicant_unique").on(
      table.requestId,
      table.applicantNearAccount,
    ),
  ],
);
