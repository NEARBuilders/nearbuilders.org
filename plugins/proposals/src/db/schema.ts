import { bigint, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const proposals = pgTable(
  "proposals",
  {
    id: text("id").primaryKey(),
    pluginId: text("plugin_id").notNull(),
    entityId: text("entity_id").notNull(),
    operation: text("operation").notNull().default("create"),
    payload: text("payload").notNull(),
    schemaVersion: text("schema_version").notNull().default("1"),
    createdBy: text("created_by").notNull(),
    reviewStatus: text("review_status").notNull().default("pending"),
    applyStatus: text("apply_status").notNull().default("not_started"),
    removeStatus: text("remove_status").notNull().default("not_started"),
    rejectionReason: text("rejection_reason"),
    applyError: text("apply_error"),
    removeError: text("remove_error"),
    appliedResourceId: text("applied_resource_id"),
    appliedAt: timestamp("applied_at", { mode: "date", withTimezone: true }),
    removedAt: timestamp("removed_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("proposals_plugin_entity_operation_unique").on(
      table.pluginId,
      table.entityId,
      table.operation,
    ),
    index("proposals_plugin_status_idx").on(table.pluginId, table.reviewStatus),
    index("proposals_entity_idx").on(table.pluginId, table.entityId),
  ],
);

export const proposalSubmissions = pgTable(
  "proposal_submissions",
  {
    id: text("id").primaryKey(),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    pluginId: text("plugin_id").notNull(),
    entityId: text("entity_id").notNull(),
    submittedBy: text("submitted_by").notNull(),
    source: text("source"),
    idempotencyKey: text("idempotency_key"),
    payload: text("payload"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("proposal_submissions_proposal_idx").on(table.proposalId),
    index("proposal_submissions_entity_idx").on(table.pluginId, table.entityId),
    uniqueIndex("proposal_submissions_idempotency_unique").on(table.pluginId, table.idempotencyKey),
  ],
);

export const proposalAuditLog = pgTable(
  "proposal_audit_log",
  {
    id: text("id").primaryKey(),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    pluginId: text("plugin_id").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    actor: text("actor").notNull(),
    actorLabel: text("actor_label"),
    details: text("details"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("proposal_audit_entity_idx").on(table.pluginId, table.entityId),
    index("proposal_audit_proposal_idx").on(table.proposalId),
  ],
);

export const proposalEvaluations = pgTable(
  "proposal_evaluations",
  {
    id: text("id").primaryKey(),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    pluginId: text("plugin_id").notNull(),
    entityId: text("entity_id").notNull(),
    submissionCount: integer("submission_count").notNull(),
    verdict: text("verdict").notNull(),
    score: integer("score"),
    summary: text("summary").notNull(),
    flags: text("flags").notNull(),
    checks: text("checks").notNull(),
    model: text("model"),
    source: text("source"),
    promptVersion: text("prompt_version").notNull(),
    evaluatedAt: timestamp("evaluated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("proposal_evaluations_submission_unique").on(
      table.proposalId,
      table.submissionCount,
    ),
    index("proposal_evaluations_entity_idx").on(table.pluginId, table.entityId),
  ],
);

export const reviewLeases = pgTable("review_leases", {
  name: text("name").primaryKey(),
  holder: text("holder").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
});

export const telegramLinkCodes = pgTable("telegram_link_codes", {
  codeHash: text("code_hash").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
  telegramUsername: text("telegram_username"),
  telegramName: text("telegram_name"),
  expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const telegramReviewers = pgTable(
  "telegram_reviewers",
  {
    telegramId: bigint("telegram_id", { mode: "number" }).primaryKey(),
    telegramUsername: text("telegram_username"),
    telegramName: text("telegram_name"),
    userId: text("user_id").notNull(),
    userLabel: text("user_label").notNull(),
    linkedAt: timestamp("linked_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("telegram_reviewers_user_unique").on(table.userId)],
);
