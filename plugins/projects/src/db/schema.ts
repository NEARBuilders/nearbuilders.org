import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("projects_owner_slug_unique").on(table.ownerId, table.slug)],
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
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("project_app_unique").on(table.projectId, table.accountId, table.domain)],
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
