import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { Context, Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { DatabaseTag } from "../db/layer";
import { projectApps, projectCollaborators, projectMentions, projects } from "../db/schema";

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

const HOSTNAME_PATTERN =
  /^(?=.{1,255}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;
const SLUG_PATTERN = /^[a-z0-9-]+$/;
const MAX_SLUG_LENGTH = 100;
const MAX_SLUG_BATCH = 100;

function assertProjectShape(input: {
  kind: ProjectKind;
  repository: string | null;
  content: string | null;
  domain: string | null;
  logoUrl: string | null;
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

  if (input.domain && !HOSTNAME_PATTERN.test(input.domain)) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Domain must be a hostname without a scheme or path",
    });
  }

  if (input.kind === "project" && !input.domain) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Projects require a product domain",
    });
  }

  if (input.logoUrl) {
    if (input.logoUrl.length > 2000) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Logo URL must be at most 2000 characters",
      });
    }
    let url: URL;
    try {
      url = new URL(input.logoUrl);
    } catch {
      throw new ORPCError("BAD_REQUEST", {
        message: "Logo URL must be an absolute http(s) URL",
      });
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new ORPCError("BAD_REQUEST", {
        message: "Logo URL must be an absolute http(s) URL",
      });
    }
  }
}

function parseSlugFilter(raw?: string) {
  return Effect.gen(function* () {
    if (raw === undefined) return undefined;
    const seen = new Set<string>();
    const slugs: string[] = [];
    for (const part of raw.split(",")) {
      const slug = part.trim();
      if (!slug || seen.has(slug)) continue;
      if (!SLUG_PATTERN.test(slug) || slug.length > MAX_SLUG_LENGTH) {
        return yield* Effect.fail(
          new ORPCError("BAD_REQUEST", { message: "Invalid slug in slugs filter" }),
        );
      }
      seen.add(slug);
      slugs.push(slug);
    }
    if (slugs.length === 0) {
      return yield* Effect.fail(
        new ORPCError("BAD_REQUEST", { message: "slugs must include at least one slug" }),
      );
    }
    if (slugs.length > MAX_SLUG_BATCH) {
      return yield* Effect.fail(
        new ORPCError("BAD_REQUEST", { message: "slugs accepts at most 100 values" }),
      );
    }
    return slugs;
  });
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
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail extends Project {
  apps: ProjectApp[];
  collaborators?: ProjectCollaborator[];
}

export interface ProjectApp {
  id: string;
  projectId: string;
  accountId: string;
  domain: string;
  createdByUserId: string;
  createdAt: string;
}

export type CollaboratorStatus = "pending" | "accepted" | "declined" | "removed";

export interface ProjectCollaborator {
  id: string;
  projectId: string;
  collaboratorOwnerId: string;
  role: string;
  status: CollaboratorStatus;
  invitedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollaborationWithProject {
  collaboration: ProjectCollaborator;
  project: Project;
}

function generateId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateProjectAppId(): string {
  return `pa_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateCollaboratorId(): string {
  return `pc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function normalizeCollaboratorId(value: string): string {
  return value.trim().toLowerCase();
}

function collaboratorIdError(value: string): string | null {
  const normalized = normalizeCollaboratorId(value);
  if (!normalized) return "Collaborator handle is required";
  if (normalized.length < 2 || normalized.length > 64) {
    return `Invalid NEAR handle "${value.trim()}": must be 2-64 characters`;
  }
  if (!/^([a-z0-9]+([._-][a-z0-9]+)*)$/.test(normalized)) {
    return `Invalid NEAR handle "${value.trim()}": use lowercase letters, digits, and . - _ separators`;
  }
  return null;
}

function assertValidCollaboratorId(value: string): string {
  const error = collaboratorIdError(value);
  if (error) {
    throw new ORPCError("BAD_REQUEST", { message: error });
  }
  return normalizeCollaboratorId(value);
}

function mapCollaborator(c: any): ProjectCollaborator {
  return {
    id: c.id,
    projectId: c.projectId,
    collaboratorOwnerId: c.collaboratorOwnerId,
    role: c.role ?? "collaborator",
    status: c.status as CollaboratorStatus,
    invitedByUserId: c.invitedByUserId,
    createdAt: toIsoString(c.createdAt),
    updatedAt: toIsoString(c.updatedAt),
  };
}

const isProjectCollaborator = (
  db: any,
  projectId: string,
  statuses: CollaboratorStatus[],
  userId?: string,
  alternateUserId?: string,
) =>
  Effect.gen(function* () {
    if (!userId && !alternateUserId) return false;
    const ids = [userId, alternateUserId]
      .filter(Boolean)
      .map((id) => (id as string).toLowerCase()) as string[];
    const rows = (yield* Effect.promise(() =>
      db
        .select({ collaboratorOwnerId: projectCollaborators.collaboratorOwnerId })
        .from(projectCollaborators)
        .where(
          and(
            eq(projectCollaborators.projectId, projectId),
            inArray(projectCollaborators.status, statuses),
            inArray(projectCollaborators.collaboratorOwnerId, ids),
          ),
        )
        .limit(1),
    )) as any[];
    return rows.length > 0;
  });

const isAcceptedCollaborator = (
  db: any,
  projectId: string,
  userId?: string,
  alternateUserId?: string,
) => isProjectCollaborator(db, projectId, ["accepted"], userId, alternateUserId);

export class ProjectService extends Context.Tag("projects/ProjectService")<
  ProjectService,
  {
    listProjects: (
      input: {
        organizationId?: string;
        ownerId?: string;
        collaboratorId?: string;
        kind?: ProjectKind;
        visibility?: ProjectVisibility;
        status?: ProjectStatus;
        query?: string;
        sort?: "newest" | "oldest";
        slugs?: string;
        limit?: number;
        cursor?: string;
      },
      userId?: string,
      alternateUserId?: string,
      userRole?: string,
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
      userRole?: string,
    ) => Effect.Effect<ProjectDetail | null, ORPCError<string, unknown>>;

    getProjectBySlug: (
      slug: string,
      userId?: string,
      alternateUserId?: string,
      userRole?: string,
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
        logoUrl?: string;
        collaborators?: string[];
      },
      userId: string,
      userRole?: string,
      alternateUserId?: string,
    ) => Effect.Effect<
      Project & { collaborators?: ProjectCollaborator[] },
      ORPCError<string, unknown>
    >;

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
        logoUrl?: string;
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

    listCollaborators: (
      projectId: string,
      userId?: string,
      alternateUserId?: string,
      userRole?: string,
    ) => Effect.Effect<ProjectCollaborator[], ORPCError<string, unknown>>;

    inviteCollaborator: (
      projectId: string,
      collaboratorOwnerId: string,
      inviterUserId: string,
      userRole?: string,
      alternateUserId?: string,
    ) => Effect.Effect<ProjectCollaborator, ORPCError<string, unknown>>;

    respondCollaborator: (
      projectId: string,
      action: "accept" | "decline",
      userId: string,
      alternateUserId?: string,
    ) => Effect.Effect<ProjectCollaborator, ORPCError<string, unknown>>;

    removeCollaborator: (
      projectId: string,
      collaboratorOwnerId: string,
      userId: string,
      userRole?: string,
      alternateUserId?: string,
    ) => Effect.Effect<{ removed: boolean }, ORPCError<string, unknown>>;

    listMyCollaborations: (
      userId: string,
      alternateUserId?: string,
      status?: CollaboratorStatus,
      limit?: number,
    ) => Effect.Effect<CollaborationWithProject[], ORPCError<string, unknown>>;
  }
>() {}

function isProjectOwner(projectOwnerId: string, userId?: string, alternateUserId?: string) {
  return projectOwnerId === userId || projectOwnerId === alternateUserId;
}

const canViewProjectRecord = (
  project: any,
  userId?: string,
  alternateUserId?: string,
  userRole?: string,
) => {
  if (project.visibility === "public" || project.visibility === "unlisted") {
    return true;
  }

  if (userRole === "admin") {
    return true;
  }

  if (!userId && !alternateUserId) {
    return false;
  }

  return isProjectOwner(project.ownerId, userId, alternateUserId);
};

const canViewProjectWithCollaborators = (
  db: any,
  project: any,
  userId?: string,
  alternateUserId?: string,
  userRole?: string,
) =>
  Effect.gen(function* () {
    if (canViewProjectRecord(project, userId, alternateUserId, userRole)) return true;
    return yield* isProjectCollaborator(
      db,
      project.id,
      ["accepted", "pending"],
      userId,
      alternateUserId,
    );
  });

const canEditProject = (
  db: any,
  projectId: string,
  userId: string,
  _userRole?: string,
  alternateUserId?: string,
) =>
  Effect.gen(function* () {
    const results = (yield* Effect.promise(() =>
      db.select().from(projects).where(eq(projects.id, projectId)).limit(1),
    )) as any[];

    const project = results[0];

    if (!project) {
      return false;
    }

    if (isProjectOwner(project.ownerId, userId, alternateUserId)) return true;
    return yield* isAcceptedCollaborator(db, projectId, userId, alternateUserId);
  });

const canManageCollaborators = (
  db: any,
  projectId: string,
  userId: string,
  _userRole?: string,
  alternateUserId?: string,
) =>
  Effect.gen(function* () {
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
    logoUrl: p.logoUrl ?? null,
    createdAt: toIsoString(p.createdAt),
    updatedAt: toIsoString(p.updatedAt),
  };
}

const mapProjectDetail = (
  db: any,
  project: any,
  viewer?: { userId?: string; alternateUserId?: string; userRole?: string },
) =>
  Effect.gen(function* () {
    const apps = (yield* Effect.promise(() =>
      db
        .select()
        .from(projectApps)
        .where(eq(projectApps.projectId, project.id))
        .orderBy(projectApps.createdAt),
    )) as any[];

    const allCollaborations = (yield* Effect.promise(() =>
      db
        .select()
        .from(projectCollaborators)
        .where(eq(projectCollaborators.projectId, project.id))
        .orderBy(projectCollaborators.createdAt),
    )) as any[];

    const isPrivileged =
      viewer?.userRole === "admin" ||
      isProjectOwner(project.ownerId, viewer?.userId, viewer?.alternateUserId) ||
      allCollaborations.some(
        (c: any) =>
          c.status === "accepted" &&
          (c.collaboratorOwnerId === viewer?.userId ||
            c.collaboratorOwnerId === viewer?.alternateUserId),
      );
    const visibleCollaborations = isPrivileged
      ? allCollaborations
      : allCollaborations.filter((c: any) => c.status === "accepted");

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
      collaborators: visibleCollaborations.map(mapCollaborator),
    };
  });

export const ProjectServiceLive = Layer.effect(
  ProjectService,
  Effect.gen(function* () {
    const db = yield* DatabaseTag;

    return {
      listProjects: (input, userId?: string, alternateUserId?: string, userRole?: string) =>
        Effect.gen(function* () {
          const slugFilter = yield* parseSlugFilter(input.slugs);
          const limit = slugFilter
            ? (input.limit ?? slugFilter.length)
            : Math.min(input.limit ?? 24, 100);
          const offset = slugFilter ? 0 : input.cursor ? parseInt(input.cursor, 10) : 0;
          const conditions: any[] = [];

          if (input.organizationId) {
            conditions.push(eq(projects.organizationId, input.organizationId));
          }

          if (input.ownerId) {
            conditions.push(eq(projects.ownerId, input.ownerId));
          }

          if (input.collaboratorId?.trim()) {
            const collabId = normalizeCollaboratorId(input.collaboratorId);
            const collabRows = (yield* Effect.promise(() =>
              db
                .select({ projectId: projectCollaborators.projectId })
                .from(projectCollaborators)
                .where(
                  and(
                    eq(projectCollaborators.collaboratorOwnerId, collabId),
                    eq(projectCollaborators.status, "accepted"),
                  ),
                )
                .limit(500),
            )) as Array<{ projectId: string }>;
            const collabProjectIds = collabRows.map((r) => r.projectId);
            if (collabProjectIds.length === 0) {
              return { data: [], meta: { total: 0, hasMore: false, nextCursor: null } };
            }
            conditions.push(inArray(projects.id, collabProjectIds));

            const viewerIds = [userId, alternateUserId]
              .filter(Boolean)
              .map((id) => (id as string).toLowerCase());
            const requesterIsCollaborator =
              userRole === "admin" || viewerIds.includes(collabId);
            if (!requesterIsCollaborator) {
              conditions.push(eq(projects.visibility, "public"));
            }
          }

          if (input.kind) {
            conditions.push(eq(projects.kind, input.kind));
          }

          if (slugFilter) {
            conditions.push(inArray(projects.slug, slugFilter));
          }

          if (input.status) {
            conditions.push(eq(projects.status, input.status));
          }

          if (input.query?.trim()) {
            const pattern = `%${input.query.trim()}%`;
            conditions.push(
              or(
                ilike(projects.title, pattern),
                ilike(projects.slug, pattern),
                ilike(projects.description, pattern),
                ilike(projects.content, pattern),
                ilike(projects.ownerId, pattern),
                ilike(projects.repository, pattern),
                ilike(projects.domain, pattern),
              ),
            );
          }

          const viewerIdsForCollabs = [userId, alternateUserId]
            .filter(Boolean)
            .map((id) => (id as string).toLowerCase()) as string[];
          const getViewerCollabProjectIds = Effect.gen(function* () {
            if (viewerIdsForCollabs.length === 0) return [] as string[];
            const vRows = (yield* Effect.promise(() =>
              db
                .select({ projectId: projectCollaborators.projectId })
                .from(projectCollaborators)
                .where(
                  and(
                    inArray(projectCollaborators.collaboratorOwnerId, viewerIdsForCollabs),
                    eq(projectCollaborators.status, "accepted"),
                  ),
                )
                .limit(500),
            )) as Array<{ projectId: string }>;
            return vRows.map((r) => r.projectId);
          });

          if (input.visibility) {
            conditions.push(eq(projects.visibility, input.visibility));
            if (input.visibility === "private" && userRole !== "admin") {
              const viewerCollabIds = yield* getViewerCollabProjectIds;
              const accessConditions: any[] = [
                userId ? eq(projects.ownerId, userId) : undefined,
                alternateUserId ? eq(projects.ownerId, alternateUserId) : undefined,
                viewerCollabIds.length > 0 ? inArray(projects.id, viewerCollabIds) : undefined,
              ].filter(Boolean);
              conditions.push(accessConditions.length > 0 ? or(...accessConditions) : sql`false`);
            }
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
              const viewerCollabIds = yield* getViewerCollabProjectIds;
              if (viewerCollabIds.length > 0) {
                visibleConditions.push(inArray(projects.id, viewerCollabIds));
              }
            }
            conditions.push(or(...visibleConditions));
          }

          const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

          if (slugFilter) {
            const records = yield* Effect.promise(() =>
              db.select().from(projects).where(whereClause),
            );
            const bySlug = new Map(
              records.map((record: { slug: string }) => [record.slug, record]),
            );
            const ordered = slugFilter.flatMap((slug) => {
              const record = bySlug.get(slug);
              return record ? [record] : [];
            });
            const total = ordered.length;
            const data: Project[] = ordered.slice(0, limit).map(mapProject);
            return {
              data,
              meta: {
                total,
                hasMore: false,
                nextCursor: null,
              },
            };
          }

          const [totalResult] = yield* Effect.promise(() =>
            db.select({ count: count() }).from(projects).where(whereClause),
          );

          const total = totalResult?.count ?? 0;

          const records = yield* Effect.promise(() =>
            db
              .select()
              .from(projects)
              .where(whereClause)
              .orderBy(input.sort === "oldest" ? asc(projects.createdAt) : desc(projects.createdAt))
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

      getProject: (id, userId, alternateUserId, userRole) =>
        Effect.gen(function* () {
          const [project] = yield* Effect.promise(() =>
            db.select().from(projects).where(eq(projects.id, id)).limit(1),
          );

          if (!project) {
            return null;
          }

          const canView = yield* canViewProjectWithCollaborators(
            db,
            project,
            userId,
            alternateUserId,
            userRole,
          );
          if (!canView) return null;
          return yield* mapProjectDetail(db, project, { userId, alternateUserId, userRole });
        }),

      getProjectBySlug: (slug, userId, alternateUserId, userRole) =>
        Effect.gen(function* () {
          const [project] = yield* Effect.promise(() =>
            db.select().from(projects).where(eq(projects.slug, slug)).limit(1),
          );

          if (!project) {
            return null;
          }

          const canView = yield* canViewProjectWithCollaborators(
            db,
            project,
            userId,
            alternateUserId,
            userRole,
          );
          if (!canView) return null;
          return yield* mapProjectDetail(db, project, { userId, alternateUserId, userRole });
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
            db.select().from(projects).where(eq(projects.slug, input.slug)).limit(1),
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
          const logoUrl = normalizeOptionalText(input.logoUrl);

          assertProjectShape({
            kind: input.kind,
            repository,
            content,
            domain,
            logoUrl,
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
              logoUrl,
              createdAt: now,
              updatedAt: now,
            }),
          );

          yield* syncMentions(db, id, content);

          const collaboratorIds = Array.from(
            new Set(
              (input.collaborators ?? [])
                .map((c) => c.trim())
                .filter((c) => c.length > 0)
                .map((c) => assertValidCollaboratorId(c))
                .filter((c) => c !== effectiveOwnerId.toLowerCase()),
            ),
          ).slice(0, 20);

          const createdCollaborators: ProjectCollaborator[] = [];
          if (collaboratorIds.length > 0) {
            const nowCollab = new Date();
            const rows = collaboratorIds.map((collaboratorOwnerId) => ({
              id: generateCollaboratorId(),
              projectId: id,
              collaboratorOwnerId,
              role: "collaborator",
              status: "pending" as const,
              invitedByUserId: effectiveOwnerId,
              createdAt: nowCollab,
              updatedAt: nowCollab,
            }));
            yield* Effect.promise(() => db.insert(projectCollaborators).values(rows));
            createdCollaborators.push(...rows.map(mapCollaborator));
          }

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
            logoUrl,
            createdAt: toIsoString(now),
            updatedAt: toIsoString(now),
            collaborators: createdCollaborators,
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
          const nextDomain =
            input.domain !== undefined
              ? normalizeOptionalText(input.domain)
              : (existing.domain ?? null);
          const nextLogoUrl =
            input.logoUrl !== undefined
              ? normalizeOptionalText(input.logoUrl)
              : (existing.logoUrl ?? null);

          assertProjectShape({
            kind: nextKind,
            repository: nextRepository,
            content: nextContent,
            domain: nextDomain,
            logoUrl: nextLogoUrl,
          });

          if (input.kind !== undefined) updates.kind = input.kind;
          if (input.title !== undefined) updates.title = input.title;
          if (input.description !== undefined) updates.description = nextDescription;
          if (input.content !== undefined) updates.content = nextContent;
          if (input.status !== undefined) updates.status = input.status;
          if (input.visibility !== undefined) updates.visibility = input.visibility;
          if (input.repository !== undefined) updates.repository = nextRepository;
          if (input.domain !== undefined) updates.domain = nextDomain;
          if (input.logoUrl !== undefined) updates.logoUrl = nextLogoUrl;
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
            domain: nextDomain,
            logoUrl: nextLogoUrl,
            createdAt: toIsoString(existing.createdAt),
            updatedAt: toIsoString(now),
          };
        }),

      deleteProject: (id, userId, userRole, alternateUserId) =>
        Effect.gen(function* () {
          if (userRole !== "admin") {
            const canDelete = yield* canManageCollaborators(
              db,
              id,
              userId,
              userRole,
              alternateUserId,
            );
            if (!canDelete) {
              return yield* Effect.fail(
                new ORPCError("FORBIDDEN", {
                  message: "Only the project owner can delete this project",
                }),
              );
            }
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

      listCollaborators: (projectId, userId, alternateUserId, userRole) =>
        Effect.gen(function* () {
          const [project] = yield* Effect.promise(() =>
            db.select().from(projects).where(eq(projects.id, projectId)).limit(1),
          );
          if (!project) {
            return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Project not found" }));
          }
          const canView = yield* canViewProjectWithCollaborators(
            db,
            project,
            userId,
            alternateUserId,
            userRole,
          );
          if (!canView) {
            return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Project not found" }));
          }
          const rows = (yield* Effect.promise(() =>
            db
              .select()
              .from(projectCollaborators)
              .where(eq(projectCollaborators.projectId, projectId))
              .orderBy(projectCollaborators.createdAt),
          )) as any[];
          const viewerIds = [userId, alternateUserId]
            .filter(Boolean)
            .map((id) => (id as string).toLowerCase());
          const isPrivileged =
            userRole === "admin" ||
            isProjectOwner(project.ownerId, userId, alternateUserId) ||
            rows.some(
              (c) => c.status === "accepted" && viewerIds.includes(c.collaboratorOwnerId),
            );
          const visible = isPrivileged ? rows : rows.filter((c) => c.status === "accepted");
          return visible.map(mapCollaborator);
        }),

      inviteCollaborator: (
        projectId,
        collaboratorOwnerIdRaw,
        inviterUserId,
        _userRole,
        alternateUserId,
      ) =>
        Effect.gen(function* () {
          const collaboratorOwnerId = assertValidCollaboratorId(collaboratorOwnerIdRaw);
          const [project] = yield* Effect.promise(() =>
            db.select().from(projects).where(eq(projects.id, projectId)).limit(1),
          );
          if (!project) {
            return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Project not found" }));
          }
          const canManage = yield* canManageCollaborators(
            db,
            projectId,
            inviterUserId,
            _userRole,
            alternateUserId,
          );
          if (!canManage) {
            return yield* Effect.fail(
              new ORPCError("FORBIDDEN", {
                message: "Only the project owner can invite collaborators",
              }),
            );
          }
          if (collaboratorOwnerId === project.ownerId.toLowerCase()) {
            return yield* Effect.fail(
              new ORPCError("BAD_REQUEST", {
                message: "Owner is already credited on this project",
              }),
            );
          }
          const findExisting = Effect.promise(() =>
            db
              .select()
              .from(projectCollaborators)
              .where(
                and(
                  eq(projectCollaborators.projectId, projectId),
                  eq(projectCollaborators.collaboratorOwnerId, collaboratorOwnerId),
                ),
              )
              .limit(1),
          );
          const settleExisting = (current: any) => {
            if (current.status === "pending" || current.status === "accepted") {
              return Effect.succeed(mapCollaborator(current));
            }
            const now = new Date();
            return Effect.gen(function* () {
              yield* Effect.promise(() =>
                db
                  .update(projectCollaborators)
                  .set({ status: "pending", invitedByUserId: inviterUserId, updatedAt: now })
                  .where(eq(projectCollaborators.id, current.id)),
              );
              return mapCollaborator({
                ...current,
                status: "pending",
                invitedByUserId: inviterUserId,
                updatedAt: now,
              });
            });
          };

          const [fastPath] = (yield* findExisting) as any[];
          if (fastPath) {
            return yield* settleExisting(fastPath);
          }

          const now = new Date();
          yield* Effect.promise(() =>
            db
              .insert(projectCollaborators)
              .values({
                id: generateCollaboratorId(),
                projectId,
                collaboratorOwnerId,
                role: "collaborator",
                status: "pending" as const,
                invitedByUserId: inviterUserId,
                createdAt: now,
                updatedAt: now,
              })
              .onConflictDoNothing({
                target: [
                  projectCollaborators.projectId,
                  projectCollaborators.collaboratorOwnerId,
                ],
              }),
          );

          const [row] = (yield* findExisting) as any[];
          if (!row) {
            return yield* Effect.fail(
              new ORPCError("INTERNAL_SERVER_ERROR", {
                message: "Failed to create collaborator invitation",
              }),
            );
          }
          return yield* settleExisting(row);
        }),

      respondCollaborator: (projectId, action, userId, alternateUserId) =>
        Effect.gen(function* () {
          const candidateIds = [userId, alternateUserId]
            .filter(Boolean)
            .map((id) => (id as string).toLowerCase()) as string[];
          const rows = (yield* Effect.promise(() =>
            db
              .select()
              .from(projectCollaborators)
              .where(
                and(
                  eq(projectCollaborators.projectId, projectId),
                  inArray(projectCollaborators.collaboratorOwnerId, candidateIds),
                ),
              )
              .limit(5),
          )) as any[];
          const invite = rows.find((r) => r.status === "pending") ?? rows[0];
          if (!invite) {
            return yield* Effect.fail(
              new ORPCError("NOT_FOUND", { message: "No pending invitation found" }),
            );
          }
          if (invite.status !== "pending") {
            return yield* Effect.fail(
              new ORPCError("BAD_REQUEST", { message: "Invitation is no longer pending" }),
            );
          }
          const nextStatus = action === "accept" ? "accepted" : "declined";
          const now = new Date();
          yield* Effect.promise(() =>
            db
              .update(projectCollaborators)
              .set({ status: nextStatus, updatedAt: now })
              .where(eq(projectCollaborators.id, invite.id)),
          );
          return mapCollaborator({ ...invite, status: nextStatus, updatedAt: now });
        }),
      removeCollaborator: (projectId, collaboratorOwnerIdRaw, userId, _userRole, alternateUserId) =>
        Effect.gen(function* () {
          const collaboratorOwnerId = normalizeCollaboratorId(collaboratorOwnerIdRaw);
          const [project] = yield* Effect.promise(() =>
            db.select().from(projects).where(eq(projects.id, projectId)).limit(1),
          );
          if (!project) {
            return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Project not found" }));
          }
          const isOwner = isProjectOwner(project.ownerId, userId, alternateUserId);
          const viewerIds = [userId, alternateUserId]
            .filter(Boolean)
            .map((id) => (id as string).toLowerCase());
          const isSelf = viewerIds.includes(collaboratorOwnerId);
          if (!isOwner && !isSelf) {
            return yield* Effect.fail(
              new ORPCError("FORBIDDEN", {
                message: "Only the owner or the collaborator can remove this credit",
              }),
            );
          }
          const deleted = (yield* Effect.promise(() =>
            db
              .delete(projectCollaborators)
              .where(
                and(
                  eq(projectCollaborators.projectId, projectId),
                  eq(projectCollaborators.collaboratorOwnerId, collaboratorOwnerId),
                ),
              )
              .returning({ id: projectCollaborators.id }),
          )) as Array<{ id: string }>;
          return { removed: deleted.length > 0 };
        }),

      listMyCollaborations: (userId, alternateUserId, status, limit) =>
        Effect.gen(function* () {
          const candidateIds = [userId, alternateUserId]
            .filter(Boolean)
            .map((id) => (id as string).toLowerCase()) as string[];
          if (candidateIds.length === 0) return [];
          const cap = Math.min(limit ?? 50, 100);
          const collabRows = (yield* Effect.promise(() =>
            db
              .select()
              .from(projectCollaborators)
              .where(
                status
                  ? and(
                      inArray(projectCollaborators.collaboratorOwnerId, candidateIds),
                      eq(projectCollaborators.status, status),
                    )
                  : inArray(projectCollaborators.collaboratorOwnerId, candidateIds),
              )
              .orderBy(desc(projectCollaborators.createdAt))
              .limit(cap),
          )) as any[];
          if (collabRows.length === 0) return [];
          const projectIds = Array.from(new Set(collabRows.map((r) => r.projectId)));
          const projectRows = (yield* Effect.promise(() =>
            db.select().from(projects).where(inArray(projects.id, projectIds)),
          )) as any[];
          const projectMap = new Map(projectRows.map((p) => [p.id, p]));
          const out: CollaborationWithProject[] = [];
          for (const row of collabRows) {
            const project = projectMap.get(row.projectId);
            if (!project) continue;
            out.push({ collaboration: mapCollaborator(row), project: mapProject(project) });
          }
          return out;
        }),
}
}),
)
