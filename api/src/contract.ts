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
import { eventIterator, oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

const ReviewStatus = z.enum(["pending", "approved", "rejected", "removed"]);
const ApplyStatus = z.enum(["not_started", "applied", "failed"]);
const RemoveStatus = z.enum(["not_started", "removed", "failed"]);

export const VoteEventSchema = z.object({
  type: z.enum(["upvote", "downvote"]),
  entityId: z.string(),
  userId: z.string(),
  timestamp: z.string(),
  totalCount: z.number().int().nonnegative(),
});

export const ProposalSchema = z.object({
  id: z.string(),
  pluginId: z.string(),
  entityId: z.string(),
  operation: z.literal("create"),
  payload: z.unknown(),
  schemaVersion: z.string(),
  createdBy: z.string(),
  reviewStatus: ReviewStatus,
  applyStatus: ApplyStatus,
  removeStatus: RemoveStatus,
  rejectionReason: z.string().nullable(),
  applyError: z.string().nullable(),
  removeError: z.string().nullable(),
  appliedResourceId: z.string().nullable(),
  submissionCount: z.number().int().nonnegative(),
  appliedAt: z.iso.datetime().nullable(),
  removedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const ProposalAuditEntrySchema = z.object({
  id: z.string(),
  pluginId: z.string(),
  entityId: z.string(),
  action: z.string(),
  actor: z.string(),
  actorLabel: z.string().nullable(),
  details: z.unknown().nullable(),
  createdAt: z.iso.datetime(),
});

export const ProposalEventSchema = z.object({
  action: z.string(),
  pluginId: z.string(),
  entityId: z.string(),
  reviewStatus: ReviewStatus,
  applyStatus: ApplyStatus,
  removeStatus: RemoveStatus,
  submissionCount: z.number().int().nonnegative(),
  timestamp: z.iso.datetime(),
});

export const NotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.string(),
  source: z.string(),
  subject: z.string(),
  body: z.string().nullable(),
  link: z.string(),
  read: z.boolean(),
  createdAt: z.iso.datetime(),
});

export const ActivityEventSchema = z.object({
  id: z.string(),
  source: z.string(),
  type: z.string(),
  actor: z.string(),
  payload: z.unknown(),
  verified: z.boolean(),
  hiddenAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export const ActivityFiltersSchema = z.object({
  source: z.string().optional(),
  type: z.string().optional(),
  actor: z.string().optional(),
});

const CatalogProjectSlugPattern = /^(?:[a-z0-9-]|%[0-9a-fA-F]{2})+$/;
const CatalogProjectSlugSchema = z.string().min(1).max(120).regex(CatalogProjectSlugPattern);
const CatalogCursorSchema = z.string().regex(/^\d+$/);
const CatalogClaimRolesSchema = z.array(z.string().trim().min(1).max(50)).min(1).max(16);
const CatalogClaimProposalStatusSchema = z.enum(["pending", "rejected", "approved", "revoked"]);

const CatalogProjectSchema = z.object({
  slug: CatalogProjectSlugSchema,
  projectRef: z.string().regex(/^nearcatalog:(?:[a-z0-9-]|%[0-9a-fA-F]{2})+$/),
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

const CatalogClaimSchema = z.object({
  id: z.string(),
  nearAccount: z.string(),
  projectSlug: CatalogProjectSlugSchema,
  roles: z.array(z.string()),
  activityEventId: z.string().nullable(),
  revokedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const ClaimedCatalogProjectSchema = z.object({
  project: CatalogProjectSchema,
  contributors: z.array(
    z.object({
      id: z.string(),
      nearAccount: z.string(),
      roles: z.array(z.string()),
      createdAt: z.iso.datetime(),
      updatedAt: z.iso.datetime(),
    }),
  ),
});

const CatalogClaimProposalSchema = z.object({
  id: z.string(),
  projectSlug: CatalogProjectSlugSchema,
  roles: z.array(z.string().min(1).max(50)).min(1).max(16),
  status: CatalogClaimProposalStatusSchema,
  rejectionReason: z.string().nullable(),
  submissionCount: z.number().int().nonnegative(),
  revokedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const CatalogErrors = {
  CONNECTION_ERROR,
  RATE_LIMITED,
  SERVICE_UNAVAILABLE,
  TIMEOUT,
};
const ProjectOutput = z.object({
  id: z.string(),
  ownerId: z.string(),
  organizationId: z.string().nullable(),
  kind: z.enum(["project", "idea", "scope", "result"]),
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

const EventOutput = z.object({
  id: z.string(),
  ownerId: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  content: z.string().nullable(),
  status: z.enum(["active", "cancelled"]),
  visibility: z.enum(["private", "unlisted", "public"]),
  lumaUrl: z.string().nullable(),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime().nullable(),
  location: z.string().nullable(),
  participantCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const EventParticipantOutput = z.object({
  id: z.string(),
  eventId: z.string(),
  userId: z.string(),
  walletAddress: z.string().nullable(),
  displayName: z.string().nullable(),
  role: z.enum(["participant", "organizer"]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const LumaEventOutput = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  lumaUrl: z.string().url(),
  startAt: z.iso.datetime().optional(),
  endAt: z.iso.datetime().optional(),
  location: z.string().optional(),
});

const BuilderOutput = z.object({
  id: z.string(),
  nearAccount: z.string(),
  userId: z.string().nullable(),
  name: z.string().nullable(),
  bio: z.string().nullable(),
  skills: z.array(z.string()),
  location: z.string().nullable(),
  links: z.record(z.string(), z.string()).nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const registryMetadataSchema = z.object({
  claimedBy: z.string().nullable(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  repoUrl: z.string().nullable(),
  homepageUrl: z.string().nullable(),
  imageUrl: z.string().nullable(),
  updatedAt: z.iso.datetime().nullable(),
});

const registryAppSummarySchema = z.object({
  accountId: z.string(),
  gatewayId: z.string(),
  canonicalKey: z.string(),
  canonicalConfigUrl: z.string().url(),
  startCommand: z.string(),
  domain: z.string().nullable(),
  openUrl: z.string().url().nullable(),
  hostUrl: z.string().url().nullable(),
  uiUrl: z.string().url().nullable(),
  uiSsrUrl: z.string().url().nullable(),
  apiUrl: z.string().url().nullable(),
  extends: z.string().nullable(),
  parent: z.string().nullable(),
  root: z.string().nullable(),
  depth: z.number().int().nonnegative(),
  status: z.enum(["ready", "invalid"]),
  metadata: registryMetadataSchema.nullable(),
});

const registryAppDetailSchema = registryAppSummarySchema.extend({
  metadata: registryMetadataSchema.nullable(),
  metadataKey: z.string(),
  metadataContractId: z.string(),
  metadataFastKvUrl: z.string().url(),
  extendsChain: z.array(z.string()),
  resolvedConfig: z.record(z.string(), z.unknown()),
});

const registryMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
  nextCursor: z.string().nullable(),
});

const preparedRegistryMetadataWriteSchema = z.object({
  contractId: z.string(),
  methodName: z.literal("__fastdata_kv"),
  key: z.string(),
  manifest: registryMetadataSchema,
  args: z.record(z.string(), z.string()),
  gas: z.string(),
  attachedDeposit: z.string(),
});

export const contract = oc.router({
  ping: oc.route({ method: "GET", path: "/ping" }).output(
    z.object({
      status: z.literal("ok"),
      timestamp: z.iso.datetime(),
    }),
  ),

  authHealth: oc
    .route({ method: "GET", path: "/auth/health" })
    .output(
      z.object({
        status: z.string(),
        emailConfigured: z.boolean(),
        smsConfigured: z.boolean(),
      }),
    )
    .errors({ UNAUTHORIZED }),

  propose: oc
    .route({ method: "POST", path: "/proposals" })
    .input(
      z.object({
        pluginId: z.string().min(1).max(100),
        entityId: z.string().min(1).max(255),
        payload: z.unknown(),
        source: z.string().max(100).optional(),
        metadata: z.unknown().optional(),
        idempotencyKey: z.string().max(255).optional(),
      }),
    )
    .output(z.object({ data: ProposalSchema }))
    .errors({ UNAUTHORIZED, BAD_REQUEST }),

  approve: oc
    .route({ method: "POST", path: "/proposals/{pluginId}/{entityId}/approve" })
    .input(z.object({ pluginId: z.string(), entityId: z.string() }))
    .output(z.object({ data: ProposalSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST }),

  reject: oc
    .route({ method: "POST", path: "/proposals/{pluginId}/{entityId}/reject" })
    .input(
      z.object({
        pluginId: z.string(),
        entityId: z.string(),
        reason: z.string().max(1000).optional(),
      }),
    )
    .output(z.object({ data: ProposalSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST }),

  remove: oc
    .route({ method: "DELETE", path: "/proposals/{pluginId}/{entityId}" })
    .input(z.object({ pluginId: z.string(), entityId: z.string() }))
    .output(z.object({ data: ProposalSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST }),

  getProposals: oc
    .route({ method: "GET", path: "/proposals" })
    .input(
      z.object({
        pluginId: z.string().optional(),
        entityId: z.string().optional(),
        reviewStatus: ReviewStatus.optional(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(ProposalSchema),
        meta: z.object({
          total: z.number().int().nonnegative(),
          hasMore: z.boolean(),
          nextCursor: z.string().nullable(),
        }),
      }),
    ),

  getProposalCount: oc
    .route({ method: "GET", path: "/proposals/{pluginId}/{entityId}/count" })
    .input(z.object({ pluginId: z.string(), entityId: z.string() }))
    .output(
      z.object({
        pluginId: z.string(),
        entityId: z.string(),
        totalCount: z.number().int().nonnegative(),
      }),
    ),

  getAuditLog: oc
    .route({ method: "GET", path: "/proposals/{pluginId}/{entityId}/audit" })
    .input(
      z.object({
        pluginId: z.string(),
        entityId: z.string(),
        limit: z.number().int().min(1).max(200).optional(),
      }),
    )
    .output(z.object({ data: z.array(ProposalAuditEntrySchema) })),

  subscribeProposals: oc
    .route({ method: "GET", path: "/proposals/stream" })
    .input(
      z.object({
        pluginId: z.string().optional(),
        entityId: z.string().optional(),
      }),
    )
    .output(eventIterator(ProposalEventSchema)),

  upvote: oc
    .route({ method: "POST", path: "/upvotes" })
    .input(z.object({ entityId: z.string() }))
    .output(
      z.object({
        entityId: z.string(),
        userId: z.string(),
        totalCount: z.number().int().nonnegative(),
      }),
    )
    .errors({ UNAUTHORIZED, BAD_REQUEST }),

  downvote: oc
    .route({ method: "DELETE", path: "/upvotes/{entityId}" })
    .input(z.object({ entityId: z.string() }))
    .output(
      z.object({
        entityId: z.string(),
        totalCount: z.number().int().nonnegative(),
      }),
    )
    .errors({ UNAUTHORIZED, NOT_FOUND }),

  getUpvoteCount: oc
    .route({ method: "GET", path: "/upvotes/{entityId}/count" })
    .input(z.object({ entityId: z.string() }))
    .output(
      z.object({
        entityId: z.string(),
        totalCount: z.number().int().nonnegative(),
      }),
    ),

  getUserVote: oc
    .route({ method: "GET", path: "/upvotes/{entityId}/me" })
    .input(z.object({ entityId: z.string() }))
    .output(
      z.object({
        entityId: z.string(),
        hasUpvote: z.boolean(),
      }),
    )
    .errors({ UNAUTHORIZED }),

  getUserVotes: oc
    .route({ method: "POST", path: "/upvotes/me/batch" })
    .input(z.object({ entityIds: z.array(z.string()).min(1).max(100) }))
    .output(
      z.record(
        z.string(),
        z.object({
          entityId: z.string(),
          hasUpvote: z.boolean(),
        }),
      ),
    )
    .errors({ UNAUTHORIZED }),

  getUpvoteCounts: oc
    .route({ method: "POST", path: "/upvotes/counts" })
    .input(z.object({ entityIds: z.array(z.string()).min(1).max(100) }))
    .output(
      z.record(
        z.string(),
        z.object({
          entityId: z.string(),
          totalCount: z.number().int().nonnegative(),
        }),
      ),
    ),

  getUpvoteFeed: oc
    .route({ method: "GET", path: "/upvotes/feed" })
    .input(
      z.object({
        nearAccount: z.string().min(1).max(100).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(
          z.object({
            id: z.string(),
            entityId: z.string(),
            userId: z.string(),
            createdAt: z.iso.datetime(),
          }),
        ),
        meta: z.object({
          total: z.number().int().nonnegative(),
          hasMore: z.boolean(),
          nextCursor: z.string().nullable(),
        }),
      }),
    ),

  subscribeUpvotes: oc
    .route({ method: "GET", path: "/upvotes/stream" })
    .output(eventIterator(VoteEventSchema)),

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
    .input(
      z.object({
        slug: CatalogProjectSlugSchema,
      }),
    )
    .output(z.object({ data: CatalogProjectSchema }))
    .errors({ BAD_REQUEST, NOT_FOUND, ...CatalogErrors }),

  submitCatalogClaimProposal: oc
    .route({ method: "POST", path: "/v1/nearcatalog/claim-proposals" })
    .input(
      z.object({
        projectSlug: CatalogProjectSlugSchema,
        roles: CatalogClaimRolesSchema,
        idempotencyKey: z.string().trim().min(1).max(255),
      }),
    )
    .output(z.object({ data: CatalogClaimProposalSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST, NOT_FOUND, ...CatalogErrors }),

  getMyCatalogClaimProposals: oc
    .route({ method: "GET", path: "/v1/nearcatalog/claim-proposals/me" })
    .output(z.object({ data: z.array(CatalogClaimProposalSchema) }))
    .errors({ UNAUTHORIZED }),

  listCatalogClaims: oc
    .route({ method: "GET", path: "/v1/nearcatalog/claims" })
    .input(
      z.object({
        nearAccount: z.string().min(1).max(100).optional(),
        projectSlug: CatalogProjectSlugSchema.optional(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: CatalogCursorSchema.optional(),
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
        cursor: CatalogCursorSchema.optional(),
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

  emitActivity: oc
    .route({ method: "POST", path: "/v1/activity" })
    .input(
      z.object({
        source: z.string().min(1),
        type: z.string().min(1),
        payload: z.unknown(),
      }),
    )
    .output(ActivityEventSchema)
    .errors({ UNAUTHORIZED }),

  getActivityFeed: oc
    .route({ method: "GET", path: "/v1/activity" })
    .input(
      ActivityFiltersSchema.extend({
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(ActivityEventSchema),
        meta: z.object({
          total: z.number().int().nonnegative(),
          hasMore: z.boolean(),
          nextCursor: z.string().nullable(),
        }),
      }),
    ),

  subscribeActivity: oc
    .route({ method: "GET", path: "/v1/activity/stream" })
    .input(ActivityFiltersSchema)
    .output(eventIterator(ActivityEventSchema)),

  getLeaderboard: oc
    .route({ method: "GET", path: "/v1/activity/leaderboard" })
    .input(
      z.object({
        period: z.enum(["week", "month", "all-time"]),
        limit: z.number().int().min(1).max(100).optional(),
      }),
    )
    .output(
      z.array(
        z.object({
          actor: z.string(),
          eventCount: z.number().int().nonnegative(),
          endorsementScore: z.number().nonnegative(),
          topSources: z.array(z.string()),
        }),
      ),
    ),

  getMyNotifications: oc
    .route({ method: "GET", path: "/v1/notifications/me" })
    .input(
      z.object({
        read: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(NotificationSchema),
        meta: z.object({
          total: z.number().int().nonnegative(),
          hasMore: z.boolean(),
          nextCursor: z.string().nullable(),
        }),
      }),
    )
    .errors({ UNAUTHORIZED }),

  markNotificationAsRead: oc
    .route({ method: "POST", path: "/v1/notifications/{id}/read" })
    .input(z.object({ id: z.string() }))
    .output(z.object({ data: NotificationSchema }))
    .errors({ UNAUTHORIZED, NOT_FOUND }),

  markAllNotificationsAsRead: oc
    .route({ method: "POST", path: "/v1/notifications/me/read-all" })
    .output(z.object({ updated: z.number().int().nonnegative() }))
    .errors({ UNAUTHORIZED }),

  subscribeNotifications: oc
    .route({ method: "GET", path: "/v1/notifications/stream" })
    .output(eventIterator(NotificationSchema))
    .errors({ UNAUTHORIZED }),
  listProjects: oc
    .route({ method: "GET", path: "/v1/projects" })
    .input(
      z.object({
        organizationId: z.string().optional(),
        ownerId: z.string().optional(),
        kind: z.enum(["project", "idea", "scope", "result"]).optional(),
        visibility: z.enum(["private", "unlisted", "public"]).optional(),
        status: z.enum(["active", "paused", "archived"]).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(ProjectOutput),
        meta: z.object({
          total: z.number().int().nonnegative(),
          hasMore: z.boolean(),
          nextCursor: z.string().nullable(),
        }),
      }),
    )
    .errors({ BAD_REQUEST }),

  createProject: oc
    .route({ method: "POST", path: "/v1/projects" })
    .input(
      z.object({
        kind: z.enum(["project", "idea", "scope", "result"]),
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
    .output(ProjectOutput)
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST }),

  getProject: oc
    .route({ method: "GET", path: "/v1/projects/{id}" })
    .input(z.object({ id: z.string() }))
    .output(
      z.object({
        data: ProjectOutput.extend({
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

  getProjectBySlug: oc
    .route({ method: "GET", path: "/v1/projects/by-slug/{slug}" })
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .output(
      z.object({
        data: ProjectOutput.extend({
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

  updateProject: oc
    .route({ method: "PATCH", path: "/v1/projects/{id}" })
    .input(
      z.object({
        id: z.string(),
        kind: z.enum(["project", "idea", "scope", "result"]).optional(),
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
    .output(ProjectOutput)
    .errors({ UNAUTHORIZED, NOT_FOUND, FORBIDDEN, BAD_REQUEST }),

  deleteProject: oc
    .route({ method: "DELETE", path: "/v1/projects/{id}" })
    .input(z.object({ id: z.string() }))
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
        data: z.array(ProjectOutput),
      }),
    )
    .errors({ BAD_REQUEST }),

  listEvents: oc
    .route({ method: "GET", path: "/v1/events" })
    .input(
      z.object({
        ownerId: z.string().optional(),
        visibility: z.enum(["private", "unlisted", "public"]).optional(),
        status: z.enum(["active", "cancelled"]).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(EventOutput),
        meta: z.object({
          total: z.number().int().nonnegative(),
          hasMore: z.boolean(),
          nextCursor: z.string().nullable(),
        }),
      }),
    )
    .errors({ BAD_REQUEST }),

  fetchLumaEvent: oc
    .route({ method: "GET", path: "/v1/luma/event" })
    .input(z.object({ url: z.string().url().max(500) }))
    .output(z.object({ data: LumaEventOutput }))
    .errors({ BAD_REQUEST }),

  createEvent: oc
    .route({ method: "POST", path: "/v1/events" })
    .input(
      z.object({
        title: z.string().min(1).max(200),
        slug: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[a-z0-9-]+$/),
        description: z.string().max(1000).optional(),
        content: z.string().max(50000).optional(),
        visibility: z.enum(["private", "unlisted", "public"]).optional(),
        status: z.enum(["active", "cancelled"]).optional(),
        lumaUrl: z.string().url().max(500).optional(),
        startAt: z.iso.datetime(),
        endAt: z.iso.datetime().optional(),
        location: z.string().max(200).optional(),
        ownerId: z.string().optional(),
      }),
    )
    .output(EventOutput)
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST }),

  getEvent: oc
    .route({ method: "GET", path: "/v1/events/{id}" })
    .input(z.object({ id: z.string() }))
    .output(z.object({ data: EventOutput }))
    .errors({ NOT_FOUND }),

  getEventBySlug: oc
    .route({ method: "GET", path: "/v1/events/by-slug/{slug}" })
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .output(z.object({ data: EventOutput }))
    .errors({ NOT_FOUND }),

  listEventParticipants: oc
    .route({ method: "GET", path: "/v1/events/{eventId}/participants" })
    .input(z.object({ eventId: z.string() }))
    .output(z.object({ data: z.array(EventParticipantOutput) }))
    .errors({ NOT_FOUND }),

  joinEvent: oc
    .route({ method: "POST", path: "/v1/events/{eventId}/participants" })
    .input(z.object({ eventId: z.string() }))
    .output(z.object({ data: EventParticipantOutput }))
    .errors({ UNAUTHORIZED, NOT_FOUND, BAD_REQUEST }),

  leaveEvent: oc
    .route({ method: "DELETE", path: "/v1/events/{eventId}/participants/me" })
    .input(z.object({ eventId: z.string() }))
    .output(z.object({ deleted: z.boolean() }))
    .errors({ UNAUTHORIZED, NOT_FOUND }),

  updateEvent: oc
    .route({ method: "PATCH", path: "/v1/events/{id}" })
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(1000).optional(),
        content: z.string().max(50000).optional(),
        visibility: z.enum(["private", "unlisted", "public"]).optional(),
        status: z.enum(["active", "cancelled"]).optional(),
        lumaUrl: z.string().url().max(500).optional(),
        startAt: z.iso.datetime().optional(),
        endAt: z.iso.datetime().optional(),
        location: z.string().max(200).optional(),
        ownerId: z.string().optional(),
      }),
    )
    .output(EventOutput)
    .errors({ UNAUTHORIZED, NOT_FOUND, FORBIDDEN, BAD_REQUEST }),

  deleteEvent: oc
    .route({ method: "DELETE", path: "/v1/events/{id}" })
    .input(z.object({ id: z.string() }))
    .output(z.object({ deleted: z.boolean() }))
    .errors({ UNAUTHORIZED, NOT_FOUND, FORBIDDEN }),

  listMentions: oc
    .route({ method: "GET", path: "/v1/projects/{id}/mentions" })
    .input(z.object({ id: z.string() }))
    .output(z.object({ data: z.array(ProjectOutput) }))
    .errors({ NOT_FOUND }),

  listMentionedBy: oc
    .route({ method: "GET", path: "/v1/projects/{id}/mentioned-by" })
    .input(z.object({ id: z.string() }))
    .output(z.object({ data: z.array(ProjectOutput) }))
    .errors({ NOT_FOUND }),
  listBuilders: oc
    .route({ method: "GET", path: "/v1/builders" })
    .input(
      z.object({
        search: z.string().optional(),
        skill: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(BuilderOutput),
        meta: z.object({
          total: z.number().int().nonnegative(),
          hasMore: z.boolean(),
          nextCursor: z.string().nullable(),
        }),
      }),
    )
    .errors({ BAD_REQUEST }),

  getBuilder: oc
    .route({ method: "GET", path: "/v1/builders/{nearAccount}" })
    .input(z.object({ nearAccount: z.string() }))
    .output(z.object({ data: BuilderOutput }))
    .errors({ NOT_FOUND }),

  getMyBuilderProfile: oc
    .route({ method: "GET", path: "/v1/builders/me" })
    .input(z.object({}))
    .output(z.object({ data: BuilderOutput.nullable() }))
    .errors({ UNAUTHORIZED }),

  updateBuilderProfile: oc
    .route({ method: "PATCH", path: "/v1/builders/{nearAccount}" })
    .input(
      z.object({
        nearAccount: z.string(),
        name: z.string().min(1).max(100).optional(),
        bio: z.string().max(1000).optional(),
        skills: z.array(z.string().max(50)).max(20).optional(),
        location: z.string().max(100).optional(),
        links: z.record(z.string(), z.string()).optional(),
      }),
    )
    .output(z.object({ data: BuilderOutput }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND }),

  listRegistryApps: oc
    .route({ method: "GET", path: "/v1/registry/apps" })
    .input(
      z.object({
        q: z.string().optional(),
        parent: z.string().optional(),
        root: z.string().optional(),
        ancestor: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(registryAppSummarySchema),
        meta: registryMetaSchema,
      }),
    )
    .errors({ BAD_REQUEST }),

  getRegistryAppsByAccount: oc
    .route({ method: "GET", path: "/v1/registry/apps/account/{accountId}" })
    .input(z.object({ accountId: z.string() }))
    .output(
      z.object({
        data: z.array(registryAppSummarySchema),
        meta: registryMetaSchema,
      }),
    )
    .errors({ NOT_FOUND }),

  getRegistryApp: oc
    .route({ method: "GET", path: "/v1/registry/apps/{accountId}/{gatewayId}" })
    .input(
      z.object({
        accountId: z.string(),
        gatewayId: z.string(),
      }),
    )
    .output(z.object({ data: registryAppDetailSchema }))
    .errors({ NOT_FOUND }),

  getRegistryStatus: oc.route({ method: "GET", path: "/v1/registry/status" }).output(
    z.object({
      discoveredApps: z.number().int().nonnegative(),
      metadataContractId: z.string(),
      metadataFastKvUrl: z.string().url(),
      relayEnabled: z.boolean(),
      relayAccountId: z.string().nullable(),
      timestamp: z.iso.datetime(),
    }),
  ),

  prepareRegistryMetadataWrite: oc
    .route({ method: "POST", path: "/v1/registry/apps/{accountId}/{gatewayId}/metadata/prepare" })
    .input(
      z.object({
        accountId: z.string(),
        gatewayId: z.string(),
        claimedBy: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        repoUrl: z.string().url().optional(),
        homepageUrl: z.string().url().optional(),
        imageUrl: z.string().url().optional(),
      }),
    )
    .output(z.object({ data: preparedRegistryMetadataWriteSchema }))
    .errors({ BAD_REQUEST }),
});

export type ContractType = typeof contract;
