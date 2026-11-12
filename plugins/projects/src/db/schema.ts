import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { ProjectCatalogMetadata } from "../services/catalog-metadata";

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    organizationId: text("organization_id"),
    kind: text("kind").notNull().default("project"),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    content: text("content"),
    status: text("status").notNull().default("active"),
    visibility: text("visibility").notNull().default("public"),
    repository: text("repository"),
    domain: text("domain"),
    logoUrl: text("logo_url"),
    catalog: jsonb("catalog").$type<ProjectCatalogMetadata>(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("projects_slug_unique").on(table.slug)],
);

export const projectApps = pgTable(
  "project_apps",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    domain: text("domain").notNull(),
    /** The creator's owner id (primary account, or user id without NEAR), despite the name (#367). */
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("project_app_unique").on(table.projectId, table.accountId, table.domain)],
);

export const projectCollaborators = pgTable(
  "project_collaborators",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    collaboratorOwnerId: text("collaborator_owner_id").notNull(),
    role: text("role").notNull().default("collaborator"),
    status: text("status").notNull().default("pending"),
    /** The inviter's owner id (primary account, or user id without NEAR), despite the name (#367). */
    invitedByUserId: text("invited_by_user_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("project_collaborator_unique").on(table.projectId, table.collaboratorOwnerId),
  ],
);

export const projectMentions = pgTable(
  "project_mentions",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    targetOwnerId: text("target_owner_id").notNull(),
    targetSlug: text("target_slug").notNull(),
    targetId: text("target_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("project_mention_unique").on(table.sourceId, table.targetOwnerId, table.targetSlug),
  ],
);

export const projectPrograms = pgTable(
  "project_programs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    rewards: text("rewards"),
    eligibility: text("eligibility"),
    ctaLabel: text("cta_label").notNull(),
    ctaUrl: text("cta_url").notNull(),
    topicId: text("topic_id"),
    opensAt: timestamp("opens_at", { mode: "date", withTimezone: true }),
    closesAt: timestamp("closes_at", { mode: "date", withTimezone: true }),
    status: text("status").notNull().default("draft"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("project_programs_project_idx").on(table.projectId),
    index("project_programs_status_sort_idx").on(table.status, table.sortOrder),
  ],
);

export const projectStatusChecks = pgTable(
  "project_status_checks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    url: text("url").notNull(),
    kind: text("kind").notNull(),
    status: text("status").notNull().default("draft"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("project_status_checks_project_idx").on(table.projectId),
    index("project_status_checks_status_sort_idx").on(table.status, table.sortOrder),
    uniqueIndex("project_status_checks_listed_url_unique")
      .on(table.url)
      .where(sql`${table.status} = 'listed'`),
  ],
);

export const projectStatusResults = pgTable(
  "project_status_results",
  {
    id: text("id").primaryKey(),
    checkId: text("check_id")
      .notNull()
      .references(() => projectStatusChecks.id, { onDelete: "cascade" }),
    checkedAt: timestamp("checked_at", { mode: "date", withTimezone: true }).notNull(),
    state: text("state").notNull(),
    httpStatus: integer("http_status"),
    latencyMs: integer("latency_ms"),
    reason: text("reason"),
    pluginKeys: jsonb("plugin_keys").$type<string[]>(),
  },
  (table) => [
    index("project_status_results_check_checked_idx").on(table.checkId, table.checkedAt.desc()),
    index("project_status_results_checked_idx").on(table.checkedAt),
  ],
);
