import { BAD_REQUEST, FORBIDDEN, NOT_FOUND, UNAUTHORIZED } from "every-plugin/errors";
import { eventIterator, oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

const ReviewStatus = z.enum(["pending", "approved", "rejected", "removed"]);
const ApplyStatus = z.enum(["not_started", "applying", "applied", "failed"]);
const RemoveStatus = z.enum(["not_started", "removing", "removed", "failed"]);
const ExpectedProposalVersion = z.object({
  pluginId: z.string(),
  entityId: z.string(),
  expectedUpdatedAt: z.iso.datetime(),
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

export const ProposalSubmissionSchema = z.object({
  id: z.string(),
  pluginId: z.string(),
  entityId: z.string(),
  submittedBy: z.string(),
  source: z.string().nullable(),
  payload: z.unknown().nullable(),
  metadata: z.unknown().nullable(),
  createdAt: z.iso.datetime(),
});

export const ProposalReviewHistoryEntrySchema = ProposalAuditEntrySchema.extend({
  action: z.enum(["approved", "rejected"]),
  proposal: ProposalSchema,
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

export const contract = oc.router({
  propose: oc
    .route({ method: "POST", path: "/v1/proposals" })
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
    .route({ method: "POST", path: "/v1/proposals/{pluginId}/{entityId}/approve" })
    .input(ExpectedProposalVersion)
    .output(z.object({ data: ProposalSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST }),

  reject: oc
    .route({ method: "POST", path: "/v1/proposals/{pluginId}/{entityId}/reject" })
    .input(
      z.object({
        pluginId: z.string(),
        entityId: z.string(),
        expectedUpdatedAt: z.iso.datetime(),
        reason: z.string().max(1000).optional(),
      }),
    )
    .output(z.object({ data: ProposalSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST }),

  withdraw: oc
    .route({ method: "POST", path: "/v1/proposals/{pluginId}/{entityId}/withdraw" })
    .input(ExpectedProposalVersion)
    .output(z.object({ data: ProposalSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST }),

  reopen: oc
    .route({ method: "POST", path: "/v1/proposals/{pluginId}/{entityId}/reopen" })
    .input(ExpectedProposalVersion)
    .output(z.object({ data: ProposalSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST }),

  remove: oc
    .route({ method: "DELETE", path: "/v1/proposals/{pluginId}/{entityId}" })
    .input(ExpectedProposalVersion)
    .output(z.object({ data: ProposalSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST }),

  markApplied: oc
    .route({ method: "POST", path: "/v1/internal/proposals/{pluginId}/{entityId}/applied" })
    .input(
      z.object({
        pluginId: z.string(),
        entityId: z.string(),
        expectedUpdatedAt: z.iso.datetime(),
        appliedResourceId: z.string().optional(),
      }),
    )
    .output(z.object({ data: ProposalSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST }),

  markApplyFailed: oc
    .route({ method: "POST", path: "/v1/internal/proposals/{pluginId}/{entityId}/apply-failed" })
    .input(
      z.object({
        pluginId: z.string(),
        entityId: z.string(),
        expectedUpdatedAt: z.iso.datetime(),
        error: z.string().max(4000),
      }),
    )
    .output(z.object({ data: ProposalSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST }),

  markRemoved: oc
    .route({ method: "POST", path: "/v1/internal/proposals/{pluginId}/{entityId}/removed" })
    .input(
      z.object({
        pluginId: z.string(),
        entityId: z.string(),
        expectedUpdatedAt: z.iso.datetime(),
      }),
    )
    .output(z.object({ data: ProposalSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST }),

  markRemoveFailed: oc
    .route({ method: "POST", path: "/v1/internal/proposals/{pluginId}/{entityId}/remove-failed" })
    .input(
      z.object({
        pluginId: z.string(),
        entityId: z.string(),
        expectedUpdatedAt: z.iso.datetime(),
        error: z.string().max(4000),
      }),
    )
    .output(z.object({ data: ProposalSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST }),

  getProposals: oc
    .route({ method: "GET", path: "/v1/proposals" })
    .input(
      z.object({
        pluginId: z.string().optional(),
        entityId: z.string().optional(),
        reviewStatus: ReviewStatus.optional(),
        lifecycleStatus: z.literal("actionable").optional(),
        query: z.string().trim().min(1).max(200).optional(),
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
    .route({ method: "GET", path: "/v1/proposals/{pluginId}/{entityId}/count" })
    .input(z.object({ pluginId: z.string(), entityId: z.string() }))
    .output(
      z.object({
        pluginId: z.string(),
        entityId: z.string(),
        totalCount: z.number().int().nonnegative(),
      }),
    ),

  getAuditLog: oc
    .route({ method: "GET", path: "/v1/proposals/{pluginId}/{entityId}/audit" })
    .input(
      z.object({
        pluginId: z.string(),
        entityId: z.string(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(ProposalAuditEntrySchema),
        meta: z.object({
          total: z.number().int().nonnegative(),
          hasMore: z.boolean(),
          nextCursor: z.string().nullable(),
        }),
      }),
    ),

  getSubmissions: oc
    .route({ method: "GET", path: "/v1/proposals/{pluginId}/{entityId}/submissions" })
    .input(
      z.object({
        pluginId: z.string(),
        entityId: z.string(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(ProposalSubmissionSchema),
        meta: z.object({
          total: z.number().int().nonnegative(),
          hasMore: z.boolean(),
          nextCursor: z.string().nullable(),
        }),
      }),
    )
    .errors({ UNAUTHORIZED, FORBIDDEN }),

  getMySubmission: oc
    .route({ method: "GET", path: "/v1/proposals/{pluginId}/{entityId}/submissions/me" })
    .input(z.object({ pluginId: z.string(), entityId: z.string() }))
    .output(z.object({ hasSubmitted: z.boolean() }))
    .errors({ UNAUTHORIZED }),

  getReviewHistory: oc
    .route({ method: "GET", path: "/v1/proposals/review-history" })
    .input(
      z.object({
        pluginId: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(ProposalReviewHistoryEntrySchema),
        meta: z.object({
          total: z.number().int().nonnegative(),
          hasMore: z.boolean(),
          nextCursor: z.string().nullable(),
        }),
      }),
    )
    .errors({ UNAUTHORIZED, FORBIDDEN }),

  subscribe: oc
    .route({ method: "GET", path: "/v1/proposals/stream" })
    .input(
      z.object({
        pluginId: z.string().optional(),
        entityId: z.string().optional(),
      }),
    )
    .output(eventIterator(ProposalEventSchema)),
});

export type ContractType = typeof contract;
