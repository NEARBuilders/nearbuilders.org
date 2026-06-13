import { BAD_REQUEST, FORBIDDEN, NOT_FOUND, UNAUTHORIZED } from "every-plugin/errors";
import { oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

const kindEnum = z.enum(["project", "idea", "scope", "result"]);

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
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const contract = oc.router({
  listProjects: oc
    .route({ method: "GET", path: "/v1/projects" })
    .input(
      z.object({
        organizationId: z.string().optional(),
        ownerId: z.string().optional(),
        kind: kindEnum.optional(),
        visibility: z.enum(["private", "unlisted", "public"]).optional(),
        status: z.enum(["active", "paused", "archived"]).optional(),
        limit: z.number().int().min(1).max(100).optional(),
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
      }),
    )
    .output(projectSchema)
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
        domain: z.string().max(255).optional(),
      }),
    )
    .output(projectSchema)
    .errors({ UNAUTHORIZED, NOT_FOUND, FORBIDDEN, BAD_REQUEST }),

  deleteProject: oc
    .route({ method: "DELETE", path: "/v1/projects/{id}" })
    .input(z.object({ id: z.string() }))
    .output(z.object({ deleted: z.boolean() }))
    .errors({ UNAUTHORIZED, NOT_FOUND, FORBIDDEN }),

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
});

export type ContractType = typeof contract;
