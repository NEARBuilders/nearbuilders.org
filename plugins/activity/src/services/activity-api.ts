import { z } from "every-plugin/zod";

/**
 * Responses from activity.nearbuilders.org's public API. Activity's contract is not published as a
 * package yet, so responses are parsed at this boundary and their types inferred from these schemas.
 */
export const ActivityApiEventSchema = z.object({
  id: z.string(),
  source: z.string(),
  type: z.string(),
  actor: z.string(),
  timestamp: z.string(),
  payload: z.unknown(),
  provenance: z.object({ approvalStatus: z.string().optional() }).optional(),
});
export type ActivityApiEvent = z.infer<typeof ActivityApiEventSchema>;

export const ActivityApiFeedSchema = z.object({
  data: z.array(ActivityApiEventSchema),
  meta: z.object({ hasMore: z.boolean(), nextCursor: z.string().nullable() }),
});

export const ActivityApiLeaderboardSchema = z.object({
  data: z.array(
    z.object({
      rank: z.number().int().positive(),
      actor: z.string(),
      score: z.number().nonnegative(),
      eventCount: z.number().int().nonnegative(),
      breakdown: z.array(z.object({ source: z.string() })).default([]),
    }),
  ),
});

export const ActivityApiProjectStatusSchema = z.object({
  status: z.enum(["none", "connected", "tracked", "rejected"]).default("none"),
  sourceId: z.string().nullable().default(null),
  displayName: z.string().nullable().default(null),
  reviewReason: z.string().nullable().default(null),
});

export const ActivityApiBindingSessionSchema = z.object({
  url: z.string(),
  expiresAt: z.string(),
});
