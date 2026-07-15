import {
  BAD_REQUEST,
  CONNECTION_ERROR,
  FORBIDDEN,
  NOT_FOUND,
  RATE_LIMITED,
  SERVICE_UNAVAILABLE,
  TIMEOUT,
  UNAUTHORIZED,
} from "every-plugin/errors";
import { oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

const CatalogProjectSlugPattern = /^(?:[a-z0-9-]|%[0-9a-fA-F]{2})+$/;
export const CatalogProjectSlugSchema = z.string().min(1).max(120).regex(CatalogProjectSlugPattern);
const RolesSchema = z.array(z.string().trim().min(1).max(50)).min(1).max(16);
const CursorSchema = z.string().regex(/^\d+$/);
const CatalogProjectReferenceSchema = z
  .string()
  .regex(/^nearcatalog:(?:[a-z0-9-]|%[0-9a-fA-F]{2})+$/);
const CatalogClaimHistoryActionSchema = z.enum(["applied", "activity-linked", "revoked"]);

export const CatalogProjectSchema = z.object({
  slug: CatalogProjectSlugSchema,
  projectRef: CatalogProjectReferenceSchema,
  name: z.string(),
  tagline: z.string().nullable(),
  description: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  repositoryUrl: z.string().url().nullable(),
  catalogUrl: z.string().url(),
  tags: z.array(z.string()),
  phase: z.string().nullable(),
  status: z.string().nullable(),
});

export const CatalogClaimSchema = z.object({
  id: z.string(),
  nearAccount: z.string(),
  projectSlug: CatalogProjectSlugSchema,
  roles: z.array(z.string()),
  activityEventId: z.string().nullable(),
  revokedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const CatalogContributorSchema = CatalogClaimSchema.pick({
  id: true,
  nearAccount: true,
  roles: true,
  createdAt: true,
  updatedAt: true,
});

export const CatalogClaimHistorySchema = z.object({
  id: z.string(),
  claimId: z.string(),
  nearAccount: z.string(),
  projectSlug: CatalogProjectSlugSchema,
  roles: z.array(z.string()),
  activityEventId: z.string().nullable(),
  action: CatalogClaimHistoryActionSchema,
  occurredAt: z.iso.datetime(),
});

export const ClaimedCatalogProjectSchema = z.object({
  project: CatalogProjectSchema,
  contributors: z.array(CatalogContributorSchema),
});

const CatalogErrors = {
  CONNECTION_ERROR,
  RATE_LIMITED,
  SERVICE_UNAVAILABLE,
  TIMEOUT,
};

export const contract = oc.router({
  searchCatalogProjects: oc
    .route({ method: "GET", path: "/v1/nearcatalog/projects/search" })
    .input(
      z.object({
        query: z.string().trim().min(1).max(100),
      }),
    )
    .output(z.object({ data: z.array(CatalogProjectSchema) }))
    .errors({ BAD_REQUEST, ...CatalogErrors }),

  getCatalogProject: oc
    .route({ method: "GET", path: "/v1/nearcatalog/projects/{slug}" })
    .input(z.object({ slug: CatalogProjectSlugSchema }))
    .output(z.object({ data: CatalogProjectSchema }))
    .errors({ BAD_REQUEST, NOT_FOUND, ...CatalogErrors }),

  listCatalogClaims: oc
    .route({ method: "GET", path: "/v1/nearcatalog/claims" })
    .input(
      z.object({
        nearAccount: z.string().min(1).max(100).optional(),
        projectSlug: CatalogProjectSlugSchema.optional(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: CursorSchema.optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(CatalogClaimSchema),
        meta: z.object({
          total: z.number().int().nonnegative(),
          hasMore: z.boolean(),
          nextCursor: z.string().nullable(),
        }),
      }),
    )
    .errors({ BAD_REQUEST }),

  listClaimedCatalogProjects: oc
    .route({ method: "GET", path: "/v1/nearcatalog/claimed-projects" })
    .input(
      z.object({
        nearAccount: z.string().min(1).max(100).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: CursorSchema.optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(ClaimedCatalogProjectSchema),
        meta: z.object({
          total: z.number().int().nonnegative(),
          hasMore: z.boolean(),
          nextCursor: z.string().nullable(),
        }),
      }),
    )
    .errors({ BAD_REQUEST, NOT_FOUND, ...CatalogErrors }),

  getCatalogClaimHistory: oc
    .route({ method: "GET", path: "/v1/internal/nearcatalog/claims/{id}/history" })
    .input(z.object({ id: z.string().min(1).max(255) }))
    .output(z.object({ data: z.array(CatalogClaimHistorySchema) }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND }),

  applyCatalogClaim: oc
    .route({ method: "POST", path: "/v1/internal/nearcatalog/claims" })
    .input(
      z.object({
        nearAccount: z.string().trim().min(1).max(100),
        projectSlug: CatalogProjectSlugSchema,
        roles: RolesSchema,
        activityEventId: z.string().min(1).max(255).optional(),
      }),
    )
    .output(z.object({ data: CatalogClaimSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST, NOT_FOUND, ...CatalogErrors }),

  setCatalogClaimActivity: oc
    .route({ method: "PATCH", path: "/v1/internal/nearcatalog/claims/{id}/activity" })
    .input(
      z.object({
        id: z.string().min(1).max(255),
        activityEventId: z.string().min(1).max(255),
      }),
    )
    .output(z.object({ data: CatalogClaimSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND }),

  revokeCatalogClaim: oc
    .route({ method: "DELETE", path: "/v1/internal/nearcatalog/claims/{id}" })
    .input(z.object({ id: z.string().min(1).max(255) }))
    .output(z.object({ data: CatalogClaimSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND }),
});

export type ContractType = typeof contract;
