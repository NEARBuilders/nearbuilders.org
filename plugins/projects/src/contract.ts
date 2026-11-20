import "@orpc/openapi/extensions/route";
import { oc } from "@orpc/contract";
import { BAD_REQUEST, FORBIDDEN, NOT_FOUND, RATE_LIMITED, UNAUTHORIZED } from "every-plugin/errors";
import { z } from "zod";

const kindEnum = z.enum(["project", "idea", "scope", "result"]);

const optionalLogoUrl = z
  .string()
  .max(2000)
  .refine((value) => value.length === 0 || isAbsoluteHttpUrl(value), {
    message: "Logo URL must be an absolute http(s) URL",
  })
  .optional();

function isAbsoluteHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const NEAR_ACCOUNT_PATTERN = /^(?=.{2,64}$)[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const CATALOG_CATEGORY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const catalogPhaseEnum = z.enum([
  "mainnet",
  "testnet",
  "prototype",
  "still building",
  "inactive",
]);

export const CATALOG_LINK_KEYS = [
  "twitter",
  "telegram",
  "discord",
  "github",
  "medium",
  "whitepaper",
  "nearsocial",
  "linkedin",
  "youtube",
] as const;

const catalogLinkUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value.length === 0 || isAbsoluteHttpUrl(value), {
    message: "Links must be absolute http(s) URLs",
  });

export const projectCatalogSchema = z.object({
  tagline: z.string().trim().max(140).optional(),
  categories: z.array(z.string().trim().max(60).regex(CATALOG_CATEGORY_PATTERN)).max(6).optional(),
  phase: catalogPhaseEnum.optional(),
  links: z.partialRecord(z.enum(CATALOG_LINK_KEYS), catalogLinkUrl).optional(),
  tokenContract: z
    .string()
    .trim()
    .toLowerCase()
    .regex(NEAR_ACCOUNT_PATTERN, { message: "Token contract must be a NEAR account id" })
    .optional(),
  coingeckoId: z
    .string()
    .trim()
    .toLowerCase()
    .max(100)
    .regex(/^[a-z0-9-]+$/, { message: "CoinGecko id must use lowercase letters, digits and -" })
    .optional(),
});

const projectSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  organizationId: z.string().nullable(),
  kind: kindEnum,
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  content: z.string().nullable(),
  status: z.enum(["active", "paused", "archived"]),
  visibility: z.enum(["private", "unlisted", "public"]),
  repository: z.string().nullable(),
  domain: z.string().nullable(),
  logoUrl: z.string().nullable(),
  catalog: projectCatalogSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const collaboratorStatusEnum = z.enum(["pending", "accepted", "declined", "removed"]);

const collaboratorSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  collaboratorOwnerId: z.string(),
  role: z.string(),
  status: collaboratorStatusEnum,
  invitedByUserId: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const programTypeEnum = z.enum([
  "credits",
  "grant",
  "bounty",
  "api-access",
  "accelerator",
  "hackathon",
]);
export const programStatusEnum = z.enum(["draft", "listed", "paused", "archived"]);
export const programTopicEnum = z.enum(["smart-contracts", "private-cloud", "agentic-commerce"]);
export const programStateEnum = z.enum(["upcoming", "open", "closed"]);

export function isProgramCtaUrl(value: string) {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 0x20 || code === 0x7f || char === "\\") return false;
  }
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

const programCtaUrl = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(isProgramCtaUrl, { message: "CTA URL must be an https URL or a path starting with /" });

const optionalProgramText = (max: number) => z.string().trim().max(max).nullable().optional();

const programProjectSchema = z.object({
  id: z.string(),
  kind: kindEnum,
  slug: z.string(),
  title: z.string(),
  ownerId: z.string(),
  logoUrl: z.string().nullable(),
});

const programSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  type: programTypeEnum,
  title: z.string(),
  summary: z.string().nullable(),
  rewards: z.string().nullable(),
  eligibility: z.string().nullable(),
  ctaLabel: z.string(),
  ctaUrl: z.string(),
  topicId: programTopicEnum.nullable(),
  opensAt: z.iso.datetime().nullable(),
  closesAt: z.iso.datetime().nullable(),
  sortOrder: z.number().int(),
  state: programStateEnum,
  project: programProjectSchema,
});

const adminProgramSchema = programSchema.extend({
  status: programStatusEnum,
  createdBy: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const programFieldsInput = z.object({
  type: programTypeEnum,
  title: z.string().trim().min(1).max(120),
  summary: optionalProgramText(500),
  rewards: optionalProgramText(200),
  eligibility: optionalProgramText(200),
  ctaLabel: z.string().trim().min(1).max(40),
  ctaUrl: programCtaUrl,
  topicId: programTopicEnum.nullable().optional(),
  opensAt: z.iso.datetime().nullable().optional(),
  closesAt: z.iso.datetime().nullable().optional(),
  status: programStatusEnum.optional(),
  sortOrder: z.number().int().min(-10_000).max(10_000).optional(),
});

export const statusCheckKindEnum = z.enum(["everything-dev-health", "ping", "http"]);
export const statusCheckStatusEnum = z.enum(["draft", "listed", "paused", "archived"]);
export const statusStateEnum = z.enum(["up", "degraded", "down"]);
export const statusDisplayStateEnum = z.enum(["up", "degraded", "down", "unknown"]);
export const statusReasonEnum = z.enum([
  "timeout",
  "dns",
  "tls",
  "connection",
  "blocked",
  "http_4xx",
  "http_5xx",
  "bad_body",
  "plugin_failure",
  "snapshot_degraded",
  "not_ready",
  "slow",
]);

export function isStatusCheckUrlShape(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.search &&
      !url.hash &&
      !value.includes("?") &&
      !value.includes("#")
    );
  } catch {
    return false;
  }
}

const statusCheckUrl = z.string().trim().min(1).max(500).refine(isStatusCheckUrlShape, {
  message: "Status check URL must be https, with no credentials, port or query string",
});

const statusCheckResultSchema = z.object({
  state: statusStateEnum,
  reason: statusReasonEnum.nullable(),
  httpStatus: z.number().int().nullable(),
  latencyMs: z.number().int().nullable(),
  pluginKeys: z.array(z.string()),
  checkedAt: z.iso.datetime(),
});

const adminStatusCheckSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  label: z.string(),
  url: z.string(),
  kind: statusCheckKindEnum,
  status: statusCheckStatusEnum,
  sortOrder: z.number().int(),
  createdBy: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  currentState: statusDisplayStateEnum,
  latest: statusCheckResultSchema.nullable(),
  project: programProjectSchema,
});

const statusCheckFieldsInput = z.object({
  label: z.string().trim().min(1).max(60),
  url: statusCheckUrl,
  kind: statusCheckKindEnum,
  status: statusCheckStatusEnum.optional(),
  sortOrder: z.number().int().min(-10_000).max(10_000).optional(),
});

export const contract = oc.router({
  listProjects: oc
    .route({ method: "GET", path: "/v1/projects" })
    .input(
      z.object({
        organizationId: z.string().optional(),
        ownerId: z.string().optional(),
        collaboratorId: z.string().optional(),
        kind: kindEnum.optional(),
        visibility: z.enum(["private", "unlisted", "public"]).optional(),
        status: z.enum(["active", "paused", "archived"]).optional(),
        query: z.string().trim().max(200).optional(),
        sort: z.enum(["newest", "oldest"]).optional(),
        slugs: z.string().max(10_100).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(projectSchema),
        meta: z.object({
          total: z.number().int().nonnegative(),
          hasMore: z.boolean(),
          nextCursor: z.string().nullable(),
        }),
      }),
    )
    .errors({ BAD_REQUEST }),

  getProject: oc
    .route({ method: "GET", path: "/v1/projects/{id}" })
    .input(z.object({ id: z.string() }))
    .output(
      z.object({
        data: projectSchema.extend({
          apps: z.array(
            z.object({
              id: z.string(),
              projectId: z.string(),
              accountId: z.string(),
              domain: z.string(),
              createdByUserId: z.string(),
              createdAt: z.iso.datetime(),
            }),
          ),
          collaborators: z.array(collaboratorSchema).optional(),
        }),
      }),
    )
    .errors({ NOT_FOUND }),

  getProjectBySlug: oc
    .route({ method: "GET", path: "/v1/projects/by-slug/{slug}" })
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .output(
      z.object({
        data: projectSchema.extend({
          apps: z.array(
            z.object({
              id: z.string(),
              projectId: z.string(),
              accountId: z.string(),
              domain: z.string(),
              createdByUserId: z.string(),
              createdAt: z.iso.datetime(),
            }),
          ),
          collaborators: z.array(collaboratorSchema).optional(),
        }),
      }),
    )
    .errors({ NOT_FOUND }),

  createProject: oc
    .route({ method: "POST", path: "/v1/projects" })
    .input(
      z.object({
        id: z.string().optional(),
        kind: kindEnum,
        title: z.string().min(1).max(200),
        slug: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[a-z0-9-]+$/),
        description: z.string().max(1000).optional(),
        content: z.string().max(50000).optional(),
        visibility: z.enum(["private", "unlisted", "public"]).optional(),
        repository: z.string().url().max(500).optional(),
        organizationId: z.string().optional(),
        ownerId: z.string().optional(),
        domain: z.string().max(255).optional(),
        logoUrl: optionalLogoUrl,
        catalog: projectCatalogSchema.nullable().optional(),
        collaborators: z.array(z.string().min(1).max(255)).max(20).optional(),
      }),
    )
    .output(projectSchema.extend({ collaborators: z.array(collaboratorSchema).optional() }))
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST }),

  updateProject: oc
    .route({ method: "PATCH", path: "/v1/projects/{id}" })
    .input(
      z.object({
        id: z.string(),
        kind: kindEnum.optional(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(1000).optional(),
        content: z.string().max(50000).optional(),
        status: z.enum(["active", "paused", "archived"]).optional(),
        visibility: z.enum(["private", "unlisted", "public"]).optional(),
        repository: z.string().url().max(500).optional(),
        ownerId: z.string().optional(),
        organizationId: z.string().nullable().optional(),
        domain: z.string().max(255).optional(),
        logoUrl: optionalLogoUrl,
        catalog: projectCatalogSchema.nullable().optional(),
      }),
    )
    .output(projectSchema)
    .errors({ UNAUTHORIZED, NOT_FOUND, FORBIDDEN, BAD_REQUEST }),

  applyReviewedProject: oc
    .route({ method: "PATCH", path: "/v1/internal/projects/{id}/reviewed" })
    .input(
      z.object({
        id: z.string(),
        ownerId: z.string().min(1),
        kind: kindEnum.optional(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(1000).optional(),
        content: z.string().max(50000).optional(),
        status: z.enum(["active", "paused", "archived"]).optional(),
        visibility: z.enum(["private", "unlisted", "public"]).optional(),
        repository: z.string().url().max(500).optional(),
        domain: z.string().max(255).optional(),
        logoUrl: optionalLogoUrl,
        catalog: projectCatalogSchema.nullable().optional(),
      }),
    )
    .output(projectSchema)
    .errors({ UNAUTHORIZED, NOT_FOUND, FORBIDDEN, BAD_REQUEST }),

  deleteProject: oc
    .route({ method: "DELETE", path: "/v1/projects/{id}" })
    .input(z.object({ id: z.string() }))
    .output(z.object({ deleted: z.boolean() }))
    .errors({ UNAUTHORIZED, NOT_FOUND, FORBIDDEN }),

  clearOrganizationAttribution: oc
    .route({
      method: "POST",
      path: "/v1/internal/organizations/{organizationId}/projects/clear-attribution",
    })
    .input(z.object({ organizationId: z.string().min(1) }))
    .output(z.object({ cleared: z.number().int().nonnegative() }))
    .errors({ FORBIDDEN }),

  listProjectApps: oc
    .route({ method: "GET", path: "/v1/projects/{projectId}/apps" })
    .input(z.object({ projectId: z.string() }))
    .output(
      z.object({
        data: z.array(
          z.object({
            id: z.string(),
            projectId: z.string(),
            accountId: z.string(),
            domain: z.string(),
            createdByUserId: z.string(),
            createdAt: z.iso.datetime(),
          }),
        ),
      }),
    )
    .errors({ NOT_FOUND }),

  linkAppToProject: oc
    .route({ method: "POST", path: "/v1/projects/{projectId}/apps" })
    .input(
      z.object({
        projectId: z.string(),
        accountId: z.string(),
        domain: z.string(),
      }),
    )
    .errors({ UNAUTHORIZED, NOT_FOUND, FORBIDDEN }),

  unlinkAppFromProject: oc
    .route({ method: "DELETE", path: "/v1/projects/{projectId}/apps/{accountId}/{domain}" })
    .input(
      z.object({
        projectId: z.string(),
        accountId: z.string(),
        domain: z.string(),
      }),
    )
    .output(z.object({ deleted: z.boolean() }))
    .errors({ UNAUTHORIZED, NOT_FOUND, FORBIDDEN }),

  listProjectsForApp: oc
    .route({ method: "GET", path: "/v1/apps/{accountId}/{domain}/projects" })
    .input(
      z.object({
        accountId: z.string(),
        domain: z.string(),
      }),
    )
    .output(
      z.object({
        data: z.array(projectSchema),
      }),
    )
    .errors({ BAD_REQUEST }),

  listMentions: oc
    .route({ method: "GET", path: "/v1/projects/{id}/mentions" })
    .input(z.object({ id: z.string() }))
    .output(
      z.object({
        data: z.array(projectSchema),
      }),
    )
    .errors({ NOT_FOUND }),

  listMentionedBy: oc
    .route({ method: "GET", path: "/v1/projects/{id}/mentioned-by" })
    .input(z.object({ id: z.string() }))
    .output(
      z.object({
        data: z.array(projectSchema),
      }),
    )
    .errors({ NOT_FOUND }),

  listCollaborators: oc
    .route({ method: "GET", path: "/v1/projects/{projectId}/collaborators" })
    .input(z.object({ projectId: z.string() }))
    .output(z.object({ data: z.array(collaboratorSchema) }))
    .errors({ NOT_FOUND }),

  inviteCollaborator: oc
    .route({ method: "POST", path: "/v1/projects/{projectId}/collaborators" })
    .input(
      z.object({
        projectId: z.string(),
        collaboratorOwnerId: z.string().trim().min(1).max(255),
      }),
    )
    .output(collaboratorSchema)
    .errors({ UNAUTHORIZED, NOT_FOUND, FORBIDDEN, BAD_REQUEST }),

  respondCollaborator: oc
    .route({ method: "POST", path: "/v1/projects/{projectId}/collaborators/respond" })
    .input(
      z.object({
        projectId: z.string(),
        action: z.enum(["accept", "decline"]),
      }),
    )
    .output(collaboratorSchema)
    .errors({ UNAUTHORIZED, NOT_FOUND, FORBIDDEN, BAD_REQUEST }),

  removeCollaborator: oc
    .route({
      method: "DELETE",
      path: "/v1/projects/{projectId}/collaborators/{collaboratorOwnerId}",
    })
    .input(z.object({ projectId: z.string(), collaboratorOwnerId: z.string().min(1) }))
    .output(z.object({ removed: z.boolean() }))
    .errors({ UNAUTHORIZED, NOT_FOUND, FORBIDDEN }),

  listMyCollaborations: oc
    .route({ method: "GET", path: "/v1/collaborations/me" })
    .input(
      z.object({
        status: collaboratorStatusEnum.optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(
          z.object({
            collaboration: collaboratorSchema,
            project: projectSchema,
          }),
        ),
      }),
    )
    .errors({ UNAUTHORIZED }),
  listPrograms: oc
    .route({ method: "GET", path: "/v1/programs" })
    .input(z.object({ topicId: programTopicEnum.optional() }))
    .output(z.object({ data: z.array(programSchema) })),

  getProjectPrograms: oc
    .route({ method: "GET", path: "/v1/projects/{projectId}/programs" })
    .input(z.object({ projectId: z.string().min(1) }))
    .output(z.object({ data: z.array(programSchema) })),

  adminListPrograms: oc
    .route({ method: "GET", path: "/v1/admin/programs" })
    .input(z.object({ projectId: z.string().min(1).optional() }))
    .output(z.object({ data: z.array(adminProgramSchema) }))
    .errors({ UNAUTHORIZED, FORBIDDEN }),

  createProgram: oc
    .route({ method: "POST", path: "/v1/admin/programs" })
    .input(programFieldsInput.extend({ projectId: z.string().min(1) }))
    .output(adminProgramSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST }),

  updateProgram: oc
    .route({ method: "PATCH", path: "/v1/admin/programs/{id}" })
    .input(programFieldsInput.partial().extend({ id: z.string().min(1) }))
    .output(adminProgramSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST }),

  reorderPrograms: oc
    .route({ method: "POST", path: "/v1/admin/programs/reorder" })
    .input(z.object({ ids: z.array(z.string().min(1)).min(1).max(200) }))
    .output(z.object({ updated: z.number().int().nonnegative() }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST }),
  adminListStatusChecks: oc
    .route({ method: "GET", path: "/v1/admin/status-checks" })
    .input(z.object({ projectId: z.string().min(1).optional() }))
    .output(z.object({ data: z.array(adminStatusCheckSchema) }))
    .errors({ UNAUTHORIZED, FORBIDDEN }),

  createStatusCheck: oc
    .route({ method: "POST", path: "/v1/admin/status-checks" })
    .input(statusCheckFieldsInput.extend({ projectId: z.string().min(1) }))
    .output(adminStatusCheckSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST }),

  updateStatusCheck: oc
    .route({ method: "PATCH", path: "/v1/admin/status-checks/{id}" })
    .input(statusCheckFieldsInput.partial().extend({ id: z.string().min(1) }))
    .output(adminStatusCheckSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST }),

  deleteStatusCheck: oc
    .route({ method: "DELETE", path: "/v1/admin/status-checks/{id}" })
    .input(z.object({ id: z.string().min(1) }))
    .output(z.object({ id: z.string() }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND }),

  runStatusCheck: oc
    .route({ method: "POST", path: "/v1/admin/status-checks/{id}/run" })
    .input(z.object({ id: z.string().min(1) }))
    .output(adminStatusCheckSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, RATE_LIMITED }),

  seedStatusChecks: oc
    .route({ method: "POST", path: "/v1/admin/status-checks/seed" })
    .input(z.object({}))
    .output(
      z.object({
        created: z.number().int().nonnegative(),
        existing: z.number().int().nonnegative(),
        missing: z.array(z.string()),
      }),
    )
    .errors({ UNAUTHORIZED, FORBIDDEN }),
});

export type ContractType = typeof contract;
