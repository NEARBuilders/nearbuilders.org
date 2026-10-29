import "@orpc/openapi/extensions/route";
import { oc } from "@orpc/contract";
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
import { z } from "zod";

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

export const CatalogCategorySchema = z.object({
  id: z.string(),
  label: z.string(),
});

export const CATALOG_LISTING_SYNC = Symbol.for("nearbuilders.nearcatalog.listingSync");

export const CatalogListingKindSchema = z.enum(["project", "person"]);
export const CatalogListingStatusSchema = z.enum([
  "none",
  "pending",
  "approved",
  "rejected",
  "published",
]);
export const CatalogPreferredContactSchema = z.enum([
  "Email",
  "Telegram",
  "Discord",
  "X",
  "Website",
]);

const CatalogExportUrl = z.union([z.literal(""), z.url({ protocol: /^https?$/ })]);

export const CatalogExportProjectSchema = z.strictObject({
  slug: z.string().min(1).max(120),
  title: z.string().min(1).max(400),
  oneliner: z.string().min(1).max(400),
  description: z.string().min(1).max(2000),
  logo: z.url({ protocol: /^https?$/ }),
  categories: z.array(z.string().min(1).max(60)).min(1).max(6),
  website: CatalogExportUrl,
  twitter: CatalogExportUrl,
  medium: CatalogExportUrl,
  telegram: CatalogExportUrl,
  github: CatalogExportUrl,
  discord: CatalogExportUrl,
  whitepaper: CatalogExportUrl,
  "token-address": z.string().max(64),
  "coingecko-address": z.string().max(100),
  "nearsocial-address": CatalogExportUrl,
  dapp: CatalogExportUrl,
  phase: z.string().max(40),
  source: z.strictObject({
    site: z.string().min(1),
    url: z.url(),
    nearAccount: z.string(),
    updatedAt: z.iso.datetime(),
  }),
});

export const CatalogExportPersonSchema = z.strictObject({
  name: z.string().min(1).max(100),
  preferredContact: CatalogPreferredContactSchema,
  description: z.string().min(1).max(2000),
  organization: z.string().max(100),
  team: z.string().max(100),
  jobTitle: z.string().max(80),
  email: z.union([z.literal(""), z.email()]),
  telegram: CatalogExportUrl,
  twitter: CatalogExportUrl,
  discord: CatalogExportUrl,
  website: CatalogExportUrl,
  avatar: CatalogExportUrl,
  nearProjects: z.string(),
  nearAccount: z.string().min(1).max(100),
});

export const CatalogListingSendStatusSchema = z.enum(["sent", "failed"]);
export const CatalogListingSendActionSchema = z.enum(["upsert", "remove"]);

export const CatalogListingSchema = z.object({
  id: z.string(),
  kind: CatalogListingKindSchema,
  entityId: z.string(),
  ownerId: z.string(),
  slug: z.string(),
  status: CatalogListingStatusSchema,
  record: z.record(z.string(), z.unknown()).nullable(),
  approvedBy: z.string().nullable(),
  approvedAt: z.iso.datetime().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  removedAt: z.iso.datetime().nullable(),
  catalogUrl: z.string().nullable(),
  sendStatus: CatalogListingSendStatusSchema.nullable(),
  sendAction: CatalogListingSendActionSchema.nullable(),
  sendError: z.string().nullable(),
  sendAttemptedAt: z.iso.datetime().nullable(),
  sentAt: z.iso.datetime().nullable(),
  changedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const CatalogExportProjectRemovalSchema = z.object({
  slug: z.string(),
  nearAccount: z.string(),
  removedAt: z.iso.datetime(),
});

export const CatalogExportPersonRemovalSchema = z.object({
  nearAccount: z.string(),
  name: z.string(),
  removedAt: z.iso.datetime(),
});

const CatalogExportInputSchema = z.object({ since: z.iso.datetime().optional() });

const CatalogExportMetaSchema = z.object({
  generatedAt: z.iso.datetime(),
  since: z.iso.datetime().nullable(),
  count: z.number().int().nonnegative(),
});

export const PublicCatalogListingSchema = z.object({
  kind: CatalogListingKindSchema,
  entityId: z.string(),
  slug: z.string(),
  status: z.enum(["approved", "published"]),
  catalogUrl: z.string().url().nullable(),
});

const CatalogListingTargetSchema = z.object({
  kind: CatalogListingKindSchema,
  entityId: z.string().trim().min(1).max(255),
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

  listCatalogCategories: oc
    .route({ method: "GET", path: "/v1/nearcatalog/categories" })
    .input(z.object({}))
    .output(z.object({ data: z.array(CatalogCategorySchema) })),

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
        query: z.string().trim().max(200).optional(),
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

  exportCatalogProjects: oc
    .route({ method: "GET", path: "/v1/nearcatalog/export/projects" })
    .input(CatalogExportInputSchema)
    .output(
      z.object({
        data: z.array(CatalogExportProjectSchema),
        removed: z.array(CatalogExportProjectRemovalSchema),
        meta: CatalogExportMetaSchema,
      }),
    )
    .errors({ BAD_REQUEST }),

  exportCatalogPeople: oc
    .route({ method: "GET", path: "/v1/nearcatalog/export/people" })
    .input(CatalogExportInputSchema)
    .output(
      z.object({
        data: z.array(CatalogExportPersonSchema),
        removed: z.array(CatalogExportPersonRemovalSchema),
        meta: CatalogExportMetaSchema,
      }),
    )
    .errors({ BAD_REQUEST }),

  listCatalogListings: oc
    .route({ method: "GET", path: "/v1/nearcatalog/listings" })
    .input(z.object({ kind: CatalogListingKindSchema }))
    .output(z.object({ data: z.array(PublicCatalogListingSchema) })),

  markCatalogListingPublished: oc
    .route({ method: "POST", path: "/v1/internal/nearcatalog/listings/published" })
    .input(
      CatalogListingTargetSchema.extend({
        slug: z.string().trim().min(1).max(120).optional(),
      }),
    )
    .output(z.object({ data: CatalogListingSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST, NOT_FOUND }),

  getCatalogListing: oc
    .route({ method: "GET", path: "/v1/internal/nearcatalog/listings/{kind}/{entityId}" })
    .input(CatalogListingTargetSchema)
    .output(z.object({ data: CatalogListingSchema.nullable() }))
    .errors({ UNAUTHORIZED, FORBIDDEN }),

  markCatalogListingPending: oc
    .route({ method: "POST", path: "/v1/internal/nearcatalog/listings/pending" })
    .input(
      CatalogListingTargetSchema.extend({
        ownerId: z.string().trim().min(1).max(255),
        slug: z.string().trim().min(1).max(120),
      }),
    )
    .output(z.object({ data: CatalogListingSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST }),

  approveCatalogListing: oc
    .route({ method: "POST", path: "/v1/internal/nearcatalog/listings/approve" })
    .input(
      CatalogListingTargetSchema.extend({
        ownerId: z.string().trim().min(1).max(255),
        slug: z.string().trim().min(1).max(120),
        record: z.record(z.string(), z.unknown()),
        approvedBy: z.string().trim().min(1).max(255),
      }),
    )
    .output(z.object({ data: CatalogListingSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST }),

  rejectCatalogListing: oc
    .route({ method: "POST", path: "/v1/internal/nearcatalog/listings/reject" })
    .input(CatalogListingTargetSchema)
    .output(z.object({ data: CatalogListingSchema.nullable() }))
    .errors({ UNAUTHORIZED, FORBIDDEN }),

  withdrawCatalogListing: oc
    .route({ method: "POST", path: "/v1/internal/nearcatalog/listings/withdraw" })
    .input(CatalogListingTargetSchema)
    .output(z.object({ data: CatalogListingSchema.nullable() }))
    .errors({ UNAUTHORIZED, FORBIDDEN }),

  listCatalogListingSends: oc
    .route({ method: "GET", path: "/v1/internal/nearcatalog/listings/sends" })
    .input(z.object({}))
    .output(z.object({ enabled: z.boolean(), data: z.array(CatalogListingSchema) }))
    .errors({ UNAUTHORIZED, FORBIDDEN }),

  retryCatalogListingSend: oc
    .route({ method: "POST", path: "/v1/internal/nearcatalog/listings/sends/retry" })
    .input(CatalogListingTargetSchema)
    .output(z.object({ data: CatalogListingSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST, NOT_FOUND }),

  refreshCatalogListingRecord: oc
    .route({ method: "POST", path: "/v1/internal/nearcatalog/listings/refresh" })
    .input(CatalogListingTargetSchema.extend({ record: z.record(z.string(), z.unknown()) }))
    .output(z.object({ data: CatalogListingSchema.nullable() }))
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST }),
});

export type ContractType = typeof contract;
