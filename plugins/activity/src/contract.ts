import { UNAUTHORIZED } from "every-plugin/errors";
import { eventIterator, oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

export const ActivityEventSchema = z.object({
  id: z.string(),
  source: z.string(),
  type: z.string(),
  actor: z.string(),
  payload: z.unknown(),
  verified: z.boolean(),
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
  actor: z.string().min(1),
  payload: z.unknown(),
  verified: z.boolean().optional(),
});

export const ActivityFeedInputSchema = ActivityFiltersSchema.extend({
  limit: z.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

export const ActivityLeaderboardInputSchema = z.object({
  period: z.enum(["week", "month", "all-time"]),
  limit: z.number().int().min(1).max(100).optional(),
});

export const contract = oc.router({
  emitActivity: oc
    .route({ method: "POST", path: "/v1/activity" })
    .input(EmitActivityInputSchema)
    .output(ActivityEventSchema)
    .errors({ UNAUTHORIZED }),

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
});

export type ContractType = typeof contract;
