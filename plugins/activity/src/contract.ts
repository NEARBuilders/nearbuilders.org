import { FORBIDDEN, NOT_FOUND, SERVICE_UNAVAILABLE, UNAUTHORIZED } from "every-plugin/errors";
import { eventIterator, oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

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

export const ActivityFeedSchema = z.object({
  data: z.array(ActivityEventSchema),
  meta: z.object({
    total: z.number().int().nonnegative(),
    hasMore: z.boolean(),
    nextCursor: z.string().nullable(),
  }),
});

export const LeaderboardEntrySchema = z.object({
  actor: z.string(),
  eventCount: z.number().int().nonnegative(),
  endorsementScore: z.number().nonnegative(),
  topSources: z.array(z.string()),
});

export const ActivityFiltersSchema = z.object({
  source: z.string().optional(),
  type: z.string().optional(),
  actor: z.string().optional(),
});

export const EmitActivityInputSchema = z.object({
  source: z.string().min(1),
  type: z.string().min(1),
  payload: z.unknown(),
});

export const EmitTrustedActivityInputSchema = EmitActivityInputSchema.extend({
  actor: z.string().min(1),
  idempotencyKey: z.string().min(1).max(255),
});

export const ActivityFeedInputSchema = ActivityFiltersSchema.extend({
  limit: z.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

export const ActivityLeaderboardInputSchema = z.object({
  period: z.enum(["week", "month", "all-time"]),
  limit: z.number().int().min(1).max(100).optional(),
});

export const ActivityGatewayModeSchema = z.enum(["legacy-only", "dual-write", "standalone-only"]);

export const ActivityRedatePlanSchema = z.object({
  dryRun: z.boolean(),
  misdated: z.number().int().nonnegative(),
  hidden: z.number().int().nonnegative(),
  enqueued: z.number().int().nonnegative(),
  oldestOccurredAt: z.string().nullable(),
  newestOccurredAt: z.string().nullable(),
});

export const ActivityGatewayStatusSchema = z.object({
  mode: ActivityGatewayModeSchema,
  configured: z.boolean(),
  counts: z.object({
    pending: z.number().int().nonnegative(),
    sent: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  }),
  oldestPendingAt: z.string().nullable(),
  recentFailures: z.array(
    z.object({
      operation: z.string(),
      idempotencyKey: z.string(),
      attempts: z.number().int().nonnegative(),
      lastError: z.string().nullable(),
    }),
  ),
});

export const ActivityImportPlanSchema = z.object({
  dryRun: z.boolean(),
  scanned: z.number().int().nonnegative(),
  eligible: z.number().int().nonnegative(),
  alreadyForwarded: z.number().int().nonnegative(),
  toImport: z.number().int().nonnegative(),
  hidden: z.number().int().nonnegative(),
  synthesizedKeys: z.number().int().nonnegative(),
  skippedByType: z.array(
    z.object({
      source: z.string(),
      type: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
  oldestOccurredAt: z.string().nullable(),
  newestOccurredAt: z.string().nullable(),
  timestamps: z.object({
    preserved: z.boolean(),
    note: z.string(),
    olderThanCurrentWeek: z.number().int().nonnegative(),
    olderThanCurrentMonth: z.number().int().nonnegative(),
  }),
  enqueued: z.number().int().nonnegative(),
  enqueuedRetractions: z.number().int().nonnegative(),
});

export const ACTIVITY_EVENT_TYPE_NAME_REGEX = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

export const MAX_ACTIVITY_EVENT_TYPE_POINTS = 100;

export const ActivityRegistrationEventTypeSchema = z.object({
  name: z.string().min(1).max(100).regex(ACTIVITY_EVENT_TYPE_NAME_REGEX),
  pointValue: z.number().int().min(0).max(MAX_ACTIVITY_EVENT_TYPE_POINTS),
});

export const ActivityRegistrationInputSchema = z.object({
  projectId: z.string().min(1).max(200),
  nearAccountId: z.string().min(2).max(64).optional(),
  eventTypes: z
    .array(ActivityRegistrationEventTypeSchema)
    .min(1)
    .max(50)
    .refine(
      (eventTypes) => new Set(eventTypes.map(({ name }) => name)).size === eventTypes.length,
      {
        message: "Event type names must be unique",
      },
    ),
});

export const ActivityProjectStatusSchema = z.object({
  status: z.enum(["none", "connected", "tracked", "rejected"]),
  sourceId: z.string().nullable(),
  displayName: z.string().nullable(),
  reviewReason: z.string().nullable(),
  activityUrl: z.string(),
});

export const ActivityProjectEventsSchema = z.object({
  events: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      actor: z.string(),
      occurredAt: z.string(),
      underReview: z.boolean(),
    }),
  ),
  nextCursor: z.string().nullable(),
});

export const ActivityProjectContributorsSchema = z.array(
  z.object({
    rank: z.number().int().positive(),
    actor: z.string(),
    score: z.number().nonnegative(),
    eventCount: z.number().int().nonnegative(),
  }),
);

export const contract = oc.router({
  emitActivity: oc
    .route({ method: "POST", path: "/v1/activity" })
    .input(EmitActivityInputSchema)
    .output(ActivityEventSchema)
    .errors({ UNAUTHORIZED }),

  emitTrustedActivity: oc
    .route({ method: "POST", path: "/v1/internal/activity" })
    .input(EmitTrustedActivityInputSchema)
    .output(ActivityEventSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN }),

  hideActivity: oc
    .route({ method: "DELETE", path: "/v1/internal/activity/{id}" })
    .input(z.object({ id: z.string().min(1).max(255) }))
    .output(ActivityEventSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND }),

  getActivityFeed: oc
    .route({ method: "GET", path: "/v1/activity" })
    .input(ActivityFeedInputSchema)
    .output(ActivityFeedSchema),

  subscribeActivity: oc
    .route({ method: "GET", path: "/v1/activity/stream" })
    .input(ActivityFiltersSchema)
    .output(eventIterator(ActivityEventSchema)),

  getLeaderboard: oc
    .route({ method: "GET", path: "/v1/activity/leaderboard" })
    .input(ActivityLeaderboardInputSchema)
    .output(z.array(LeaderboardEntrySchema)),

  getActivityGatewayStatus: oc
    .route({ method: "GET", path: "/v1/internal/activity/gateway" })
    .output(ActivityGatewayStatusSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN }),

  setActivityGatewayMode: oc
    .route({ method: "PUT", path: "/v1/internal/activity/gateway/mode" })
    .input(z.object({ mode: ActivityGatewayModeSchema }))
    .output(ActivityGatewayStatusSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN }),

  retryActivityGateway: oc
    .route({ method: "POST", path: "/v1/internal/activity/gateway/retry" })
    .output(ActivityGatewayStatusSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN }),

  redateActivityHistory: oc
    .route({ method: "POST", path: "/v1/internal/activity/gateway/redate" })
    .input(z.object({ dryRun: z.boolean().default(true) }))
    .output(ActivityRedatePlanSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN }),

  startActivityRegistration: oc
    .route({ method: "POST", path: "/v1/internal/activity/registrations" })
    .input(ActivityRegistrationInputSchema)
    .output(z.object({ url: z.string(), expiresAt: z.string() }))
    .errors({ UNAUTHORIZED, SERVICE_UNAVAILABLE }),

  getProjectActivity: oc
    .route({ method: "GET", path: "/v1/activity/projects/{projectId}" })
    .input(z.object({ projectId: z.string().min(1).max(200) }))
    .output(ActivityProjectStatusSchema)
    .errors({ SERVICE_UNAVAILABLE }),

  getProjectActivityEvents: oc
    .route({ method: "GET", path: "/v1/activity/projects/{projectId}/events" })
    .input(
      z.object({
        projectId: z.string().min(1).max(200),
        cursor: z.string().max(500).optional(),
      }),
    )
    .output(ActivityProjectEventsSchema)
    .errors({ SERVICE_UNAVAILABLE }),

  getProjectActivityContributors: oc
    .route({ method: "GET", path: "/v1/activity/projects/{projectId}/contributors" })
    .input(z.object({ projectId: z.string().min(1).max(200) }))
    .output(ActivityProjectContributorsSchema)
    .errors({ SERVICE_UNAVAILABLE }),

  importActivityHistory: oc
    .route({ method: "POST", path: "/v1/internal/activity/gateway/import" })
    .input(
      z.object({
        dryRun: z.boolean().default(true),
        since: z.iso.datetime().optional(),
        limit: z.number().int().min(1).max(10_000).optional(),
      }),
    )
    .output(ActivityImportPlanSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN }),
});

export type ContractType = typeof contract;
