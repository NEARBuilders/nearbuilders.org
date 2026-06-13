import { and, count, desc, eq, inArray, or } from "drizzle-orm";
import { Context, Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { DatabaseTag } from "../db/layer";
import { projectApps, projectMentions, projects } from "../db/schema";

function toIsoString(value: Date | string | null | undefined): string {
  if (!value) return "";
  return typeof value === "string" ? value : value.toISOString();
}

type ProjectKind = "project" | "idea" | "scope" | "result";
type ProjectStatus = "active" | "paused" | "archived";
type ProjectVisibility = "private" | "unlisted" | "public";

function normalizeOptionalText(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function assertProjectShape(input: {
  kind: ProjectKind;
  repository: string | null;
  content: string | null;
}) {
  if (input.kind === "project" && !input.repository) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Projects require a repository URL",
    });
  }

  if (
    (input.kind === "idea" || input.kind === "scope" || input.kind === "result") &&
    !input.content
  ) {
    throw new ORPCError("BAD_REQUEST", {
      message: `${input.kind.charAt(0).toUpperCase() + input.kind.slice(1)}s require markdown content`,
    });
  }
}

function parseMentions(content: string | null): Array<{ ownerId: string; slug: string }> {
  if (!content) return [];
  const regex = /@([\w][\w.-]*)\/([a-z0-9-]+)/g;
  const mentions: Array<{ ownerId: string; slug: string }> = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  for (match = regex.exec(content); match !== null; match = regex.exec(content)) {
    const ownerId = match[1]!;
    const slug = match[2]!;
    const key = `${ownerId}/${slug}`;
    if (!seen.has(key)) {
      seen.add(key);
      mentions.push({ ownerId, slug });
    }
  }
  return mentions;
}

function generateMentionId(): string {
  return `pm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export interface Project {
  id: string;
  ownerId: string;
  organizationId: string | null;
  kind: ProjectKind;
  slug: string;
  title: string;
  description: string | null;
  content: string | null;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  repository: string | null;
  domain: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail extends Project {
  apps: ProjectApp[];
}

export interface ProjectApp {
  id: string;
  projectId: string;
  accountId: string;
  domain: string;
  createdByUserId: string;
  createdAt: string;
}

function generateId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateProjectAppId(): string {
  return `pa_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export class ProjectService extends Context.Tag("projects/ProjectService")<
  ProjectService,
  {
    listProjects: (
      input: {
        organizationId?: string;
        ownerId?: string;
        kind?: ProjectKind;
        visibility?: ProjectVisibility;
        status?: ProjectStatus;
        limit?: number;
        cursor?: string;
      },
      userId?: string,
      alternateUserId?: string,
    ) => Effect.Effect<
      {
        data: Project[];
        meta: { total: number; hasMore: boolean; nextCursor: string | null };
      },
      ORPCError<string, unknown>
    >;

    getProject: (
      id: string,
      userId?: string,
      alternateUserId?: string,
    ) => Effect.Effect<ProjectDetail | null, ORPCError<string, unknown>>;

    createProject: (
      input: {
        id?: string;
        kind: ProjectKind;
        title: string;
        slug: string;
        description?: string;
        content?: string;
        visibility?: ProjectVisibility;
        repository?: string;
        organizationId?: string;
        ownerId?: string;
        domain?: string;
      },
      userId: string,
      userRole?: string,
      alternateUserId?: string,
    ) => Effect.Effect<Project, ORPCError<string, unknown>>;

    updateProject: (
      id: string,
      input: {
        kind?: ProjectKind;
        title?: string;
        description?: string;
        content?: string;
        status?: ProjectStatus;
        visibility?: ProjectVisibility;
        repository?: string;
        ownerId?: string;
        domain?: string;
      },
      userId: string,
      userRole?: string,
      alternateUserId?: string,
    ) => Effect.Effect<Project, ORPCError<string, unknown>>;

    deleteProject: (
      id: string,
      userId: string,
      userRole?: string,
      alternateUserId?: string,
    ) => Effect.Effect<{ deleted: boolean }, ORPCError<string, unknown>>;

    listProjectApps: (projectId: string) => Effect.Effect<ProjectApp[], ORPCError<string, unknown>>;

    linkAppToProject: (
      projectId: string,
      accountId: string,
      domain: string,
      userId: string,
      userRole?: string,
      alternateUserId?: string,
    ) => Effect.Effect<ProjectApp, ORPCError<string, unknown>>;

    unlinkAppFromProject: (
      projectId: string,
      accountId: string,
      domain: string,
      userId: string,
      userRole?: string,
      alternateUserId?: string,
    ) => Effect.Effect<{ deleted: boolean }, ORPCError<string, unknown>>;

    listProjectsForApp: (
      accountId: string,
      domain: string,
      userId?: string,
      alternateUserId?: string,
    ) => Effect.Effect<Project[], ORPCError<string, unknown>>;

    listMentions: (
      id: string,
      userId?: string,
      alternateUserId?: string,
    ) => Effect.Effect<Project[], ORPCError<string, unknown>>;

    listMentionedBy: (
      id: string,
      userId?: string,
      alternateUserId?: string,
    ) => Effect.Effect<Project[], ORPCError<string, unknown>>;
  }
>() {}

function isProjectOwner(projectOwnerId: string, userId?: string, alternateUserId?: string) {
  return projectOwnerId === userId || projectOwnerId === alternateUserId;
}

const canViewProject = (db: any, projectId: string, userId?: string, alternateUserId?: string) =>
  Effect.gen(function* () {
    const results = (yield* Effect.promise(() =>
      db.select().from(projects).where(eq(projects.id, projectId)).limit(1),
    )) as any[];

    const project = results[0];

    if (!project) {
      return false;
    }

    if (project.visibility === "public" || project.visibility === "unlisted") {
      return true;
    }

    if (!userId && !alternateUserId) {
      return false;
    }

    return isProjectOwner(project.ownerId, userId, alternateUserId);
  });

const canEditProject = (
  db: any,
  projectId: string,
  userId: string,
  userRole?: string,
  alternateUserId?: string,
) =>
  Effect.gen(function* () {
    if (userRole === "admin") {
      return true;
    }

    const results = (yield* Effect.promise(() =>
      db.select().from(projects).where(eq(projects.id, projectId)).limit(1),
    )) as any[];

    const project = results[0];

    if (!project) {
      return false;
    }

    return isProjectOwner(project.ownerId, userId, alternateUserId);
  });

const syncMentions = (db: any, sourceId: string, content: string | null) =>
  Effect.gen(function* () {
    const parsed = parseMentions(content);

    yield* Effect.promise(() =>
      db.delete(projectMentions).where(eq(projectMentions.sourceId, sourceId)),
    );

    if (parsed.length === 0) return;

    const rows = (yield* Effect.promise(() =>
      db
        .select({ id: projects.id, ownerId: projects.ownerId, slug: projects.slug })
        .from(projects)
        .where(
          or(...parsed.map((m) => and(eq(projects.ownerId, m.ownerId), eq(projects.slug, m.slug)))),
        ),
    )) as Array<{ id: string; ownerId: string; slug: string }>;

    const resolvedMap = new Map<string, string>();
    for (const row of rows) {
      resolvedMap.set(`${row.ownerId}/${row.slug}`, row.id);
    }

    const now = new Date();
    const inserts = parsed.map((m) => ({
      id: generateMentionId(),
      sourceId,
      targetOwnerId: m.ownerId,
      targetSlug: m.slug,
      targetId: resolvedMap.get(`${m.ownerId}/${m.slug}`) ?? null,
      createdAt: now,
    }));

    yield* Effect.promise(() => db.insert(projectMentions).values(inserts));
  });

function mapProject(p: any): Project {
  return {
    id: p.id,
    ownerId: p.ownerId,
    organizationId: p.organizationId,
    kind: p.kind as ProjectKind,
    slug: p.slug,
    title: p.title,
    description: p.description,
    content: p.content ?? null,
    status: p.status as ProjectStatus,
    visibility: p.visibility as ProjectVisibility,
    repository: p.repository ?? null,
    domain: p.domain ?? null,
    createdAt: toIsoString(p.createdAt),
    updatedAt: toIsoString(p.updatedAt),
  };
}

export const ProjectServiceLive = Layer.effect(
  ProjectService,
  Effect.gen(function* () {
    const db = yield* DatabaseTag;

    return {
      listProjects: (input, userId?: string, alternateUserId?: string) =>
        Effect.gen(function* () {
          const limit = Math.min(input.limit ?? 24, 100);
          const offset = input.cursor ? parseInt(input.cursor, 10) : 0;
          const conditions: any[] = [];

          if (input.organizationId) {
            conditions.push(eq(projects.organizationId, input.organizationId));
          }

          if (input.ownerId) {
            conditions.push(eq(projects.ownerId, input.ownerId));
          }

          if (input.kind) {
            conditions.push(eq(projects.kind, input.kind));
          }

          if (input.status) {
            conditions.push(eq(projects.status, input.status));
          }

          if (input.visibility) {
            conditions.push(eq(projects.visibility, input.visibility));
          } else {
            const visibleConditions: any[] = [inArray(projects.visibility, ["public", "unlisted"])];
            if (userId || alternateUserId) {
              const ownerConditions = [
                userId ? eq(projects.ownerId, userId) : undefined,
                alternateUserId ? eq(projects.ownerId, alternateUserId) : undefined,
              ].filter(Boolean);
              if (ownerConditions.length > 0) {
                visibleConditions.push(or(...ownerConditions));
              }
            }
            conditions.push(or(...visibleConditions));
          }

          const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

          const [totalResult] = yield* Effect.promise(() =>
            db.select({ count: count() }).from(projects).where(whereClause),
          );

          const total = totalResult?.count ?? 0;

          const records = yield* Effect.promise(() =>
            db
              .select()
              .from(projects)
              .where(whereClause)
              .orderBy(desc(projects.createdAt))
              .limit(limit)
              .offset(offset),
          );

          const data: Project[] = records.map(mapProject);

          const nextOffset = offset + limit;
          const hasMore = nextOffset < total;

          return {
            data,
            meta: {
              total,
              hasMore,
              nextCursor: hasMore ? String(nextOffset) : null,
            },
          };
        }),

      getProject: (id, userId, alternateUserId) =>
        Effect.gen(function* () {
          const canView = yield* canViewProject(db, id, userId, alternateUserId);
          if (!canView) {
            return null;
          }

          const [project] = yield* Effect.promise(() =>
            db.select().from(projects).where(eq(projects.id, id)).limit(1),
          );

          if (!project) {
            return null;
          }

          const apps = yield* Effect.promise(() =>
            db
              .select()
              .from(projectApps)
              .where(eq(projectApps.projectId, id))
              .orderBy(projectApps.createdAt),
          );

          return {
            ...mapProject(project),
            apps: apps.map((a: any) => ({
              id: a.id,
              projectId: a.projectId,
              accountId: a.accountId,
              domain: a.domain,
              createdByUserId: a.createdByUserId,
              createdAt: toIsoString(a.createdAt),
            })),
          };
        }),

      createProject: (input, userId, userRole) =>
        Effect.gen(function* () {
          const effectiveOwnerId =
            userRole === "admin" && input.ownerId?.trim() ? input.ownerId.trim() : userId;

          if (input.id?.trim()) {
            const [existingById] = yield* Effect.promise(() =>
              db.select().from(projects).where(eq(projects.id, input.id!.trim())).limit(1),
            );

            if (existingById) {
              return mapProject(existingById);
            }
          }

          const [existing] = yield* Effect.promise(() =>
            db
              .select()
              .from(projects)
              .where(and(eq(projects.ownerId, effectiveOwnerId), eq(projects.slug, input.slug)))
              .limit(1),
          );

          if (existing) {
            return yield* Effect.fail(
              new ORPCError("BAD_REQUEST", {
                message: "A project with this slug already exists",
              }),
            );
          }

          const now = new Date();
          const id = input.id?.trim() || generateId();
          const description = normalizeOptionalText(input.description);
          const content = normalizeOptionalText(input.content);
          const repository = normalizeOptionalText(input.repository);
          const domain = normalizeOptionalText(input.domain);

          assertProjectShape({
            kind: input.kind,
            repository,
            content,
          });

          yield* Effect.promise(() =>
            db.insert(projects).values({
              id,
              ownerId: effectiveOwnerId,
              organizationId: input.organizationId ?? null,
              kind: input.kind,
              slug: input.slug,
              title: input.title,
              description,
              content,
              status: "active",
              visibility: input.visibility ?? "public",
              repository,
              domain,
              createdAt: now,
              updatedAt: now,
            }),
          );

          yield* syncMentions(db, id, content);

          return {
            id,
            ownerId: effectiveOwnerId,
            organizationId: input.organizationId ?? null,
            kind: input.kind,
            slug: input.slug,
            title: input.title,
            description,
            content,
            status: "active" as const,
            visibility: (input.visibility ?? "public") as ProjectVisibility,
            repository,
            domain,
            createdAt: toIsoString(now),
            updatedAt: toIsoString(now),
          };
        }),

      updateProject: (id, input, userId, userRole, alternateUserId) =>
        Effect.gen(function* () {
          const canEdit = yield* canEditProject(db, id, userId, userRole, alternateUserId);
          if (!canEdit) {
            return yield* Effect.fail(
              new ORPCError("FORBIDDEN", {
                message: "You do not have permission to edit this project",
              }),
            );
          }

          const [existing] = yield* Effect.promise(() =>
            db.select().from(projects).where(eq(projects.id, id)).limit(1),
          );

          if (!existing) {
            return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Project not found" }));
          }

          if (
            input.visibility === "public" &&
            existing.visibility !== "public" &&
            userRole !== "admin"
          ) {
            return yield* Effect.fail(
              new ORPCError("FORBIDDEN", {
                message: "Making a project public requires admin approval",
              }),
            );
          }

          const now = new Date();
          const updates: any = { updatedAt: now };
          const nextKind = input.kind ?? (existing.kind as ProjectKind);
          const nextDescription =
            input.description !== undefined
              ? normalizeOptionalText(input.description)
              : existing.description;
          const nextContent =
            input.content !== undefined ? normalizeOptionalText(input.content) : existing.content;
          const nextRepository =
            input.repository !== undefined
              ? normalizeOptionalText(input.repository)
              : existing.repository;

          assertProjectShape({
            kind: nextKind,
            repository: nextRepository,
            content: nextContent,
          });

          if (input.kind !== undefined) updates.kind = input.kind;
          if (input.title !== undefined) updates.title = input.title;
          if (input.description !== undefined) updates.description = nextDescription;
          if (input.content !== undefined) updates.content = nextContent;
          if (input.status !== undefined) updates.status = input.status;
          if (input.visibility !== undefined) updates.visibility = input.visibility;
          if (input.repository !== undefined) updates.repository = nextRepository;
          if (input.domain !== undefined) updates.domain = normalizeOptionalText(input.domain);
          if (userRole === "admin" && input.ownerId !== undefined)
            updates.ownerId = input.ownerId.trim();

          yield* Effect.promise(() => db.update(projects).set(updates).where(eq(projects.id, id)));

          const updatedContent = updates.content !== undefined ? updates.content : existing.content;
          yield* syncMentions(db, id, updatedContent);

          return {
            id: existing.id,
            ownerId: updates.ownerId ?? existing.ownerId,
            organizationId: existing.organizationId,
            kind: (updates.kind ?? existing.kind) as ProjectKind,
            slug: existing.slug,
            title: updates.title ?? existing.title,
            description: updates.description ?? existing.description,
            content: updates.content ?? existing.content ?? null,
            status: updates.status ?? existing.status,
            visibility: updates.visibility ?? existing.visibility,
            repository: updates.repository ?? existing.repository ?? null,
            domain: updates.domain ?? existing.domain ?? null,
            createdAt: toIsoString(existing.createdAt),
            updatedAt: toIsoString(now),
          };
        }),

      deleteProject: (id, userId, userRole, alternateUserId) =>
        Effect.gen(function* () {
          const canEdit = yield* canEditProject(db, id, userId, userRole, alternateUserId);
          if (!canEdit) {
            return yield* Effect.fail(
              new ORPCError("FORBIDDEN", {
                message: "You do not have permission to delete this project",
              }),
            );
          }

          yield* Effect.promise(() => db.delete(projects).where(eq(projects.id, id)));

          return { deleted: true };
        }),

      listProjectApps: (projectId) =>
        Effect.gen(function* () {
          const apps = yield* Effect.promise(() =>
            db
              .select()
              .from(projectApps)
              .where(eq(projectApps.projectId, projectId))
              .orderBy(projectApps.createdAt),
          );

          return apps.map((a: any) => ({
            id: a.id,
            projectId: a.projectId,
            accountId: a.accountId,
            domain: a.domain,
            createdByUserId: a.createdByUserId,
            createdAt: toIsoString(a.createdAt),
          }));
        }),

      linkAppToProject: (projectId, accountId, domain, userId, userRole, alternateUserId) =>
        Effect.gen(function* () {
          const canEdit = yield* canEditProject(db, projectId, userId, userRole, alternateUserId);
          if (!canEdit) {
            return yield* Effect.fail(
              new ORPCError("FORBIDDEN", {
                message: "You do not have permission to edit this project",
              }),
            );
          }

          const [existing] = yield* Effect.promise(() =>
            db
              .select()
              .from(projectApps)
              .where(
                and(
                  eq(projectApps.projectId, projectId),
                  eq(projectApps.accountId, accountId),
                  eq(projectApps.domain, domain),
                ),
              )
              .limit(1),
          );

          if (existing) {
            return {
              id: existing.id,
              projectId: existing.projectId,
              accountId: existing.accountId,
              domain: existing.domain,
              createdByUserId: existing.createdByUserId,
              createdAt: toIsoString(existing.createdAt),
            };
          }

          const now = new Date();
          const id = generateProjectAppId();

          yield* Effect.promise(() =>
            db.insert(projectApps).values({
              id,
              projectId,
              accountId,
              domain,
              createdByUserId: userId,
              createdAt: now,
            }),
          );

          return {
            id,
            projectId,
            accountId,
            domain,
            createdByUserId: userId,
            createdAt: toIsoString(now),
          };
        }),

      unlinkAppFromProject: (
        projectId: string,
        accountId: string,
        domain: string,
        userId: string,
        userRole?: string,
        alternateUserId?: string,
      ) =>
        Effect.gen(function* () {
          const canEdit = yield* canEditProject(db, projectId, userId, userRole, alternateUserId);
          if (!canEdit) {
            return yield* Effect.fail(
              new ORPCError("FORBIDDEN", {
                message: "You do not have permission to edit this project",
              }),
            );
          }

          yield* Effect.promise(() =>
            db
              .delete(projectApps)
              .where(
                and(
                  eq(projectApps.projectId, projectId),
                  eq(projectApps.accountId, accountId),
                  eq(projectApps.domain, domain),
                ),
              ),
          );

          return { deleted: true };
        }),

      listProjectsForApp: (accountId, domain, userId, alternateUserId) =>
        Effect.gen(function* () {
          const results = yield* Effect.promise(() =>
            db
              .select({ project: projects })
              .from(projectApps)
              .innerJoin(projects, eq(projectApps.projectId, projects.id))
              .where(and(eq(projectApps.accountId, accountId), eq(projectApps.domain, domain))),
          );

          const filtered = results.filter((r: any) => {
            if (r.project.visibility === "public" || r.project.visibility === "unlisted")
              return true;
            if (isProjectOwner(r.project.ownerId, userId, alternateUserId)) return true;
            return false;
          });

          return filtered.map((r: any) => mapProject(r.project));
        }),

      listMentions: (id, userId, alternateUserId) =>
        Effect.gen(function* () {
          const rows = (yield* Effect.promise(() =>
            db
              .select({ project: projects })
              .from(projectMentions)
              .innerJoin(projects, eq(projectMentions.sourceId, projects.id))
              .where(eq(projectMentions.targetId, id)),
          )) as Array<{ project: any }>;

          const filtered = rows.filter((r) => {
            if (r.project.visibility === "public" || r.project.visibility === "unlisted")
              return true;
            if (isProjectOwner(r.project.ownerId, userId, alternateUserId)) return true;
            return false;
          });

          return filtered.map((r) => mapProject(r.project));
        }),

      listMentionedBy: (id, userId, alternateUserId) =>
        Effect.gen(function* () {
          const rows = (yield* Effect.promise(() =>
            db
              .select({ project: projects })
              .from(projectMentions)
              .innerJoin(projects, eq(projectMentions.targetId, projects.id))
              .where(eq(projectMentions.sourceId, id)),
          )) as Array<{ project: any }>;

          const filtered = rows.filter((r) => {
            if (r.project.visibility === "public" || r.project.visibility === "unlisted")
              return true;
            if (isProjectOwner(r.project.ownerId, userId, alternateUserId)) return true;
            return false;
          });

          return filtered.map((r) => mapProject(r.project));
        }),
    };
  }),
);
