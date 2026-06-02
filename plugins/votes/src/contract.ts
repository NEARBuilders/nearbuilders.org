import { BAD_REQUEST, NOT_FOUND, UNAUTHORIZED } from "every-plugin/errors";
import { eventIterator, oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

export const VoteEventSchema = z.object({
  type: z.enum(["upvote", "downvote"]),
  entityId: z.string(),
  userId: z.string(),
  timestamp: z.string(),
  totalCount: z.number().int().nonnegative(),
});

export const contract = oc.router({
  upvote: oc
    .route({ method: "POST", path: "/v1/upvotes" })
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
    .route({ method: "DELETE", path: "/v1/upvotes/{entityId}" })
    .input(z.object({ entityId: z.string() }))
    .output(
      z.object({
        entityId: z.string(),
        totalCount: z.number().int().nonnegative(),
      }),
    )
    .errors({ UNAUTHORIZED, NOT_FOUND }),

  getUpvoteCount: oc
    .route({ method: "GET", path: "/v1/upvotes/{entityId}/count" })
    .input(z.object({ entityId: z.string() }))
    .output(
      z.object({
        entityId: z.string(),
        totalCount: z.number().int().nonnegative(),
      }),
    ),

  getUserVote: oc
    .route({ method: "GET", path: "/v1/upvotes/{entityId}/me" })
    .input(z.object({ entityId: z.string() }))
    .output(
      z.object({
        entityId: z.string(),
        hasUpvote: z.boolean(),
      }),
    )
    .errors({ UNAUTHORIZED }),

  getUpvoteFeed: oc
    .route({ method: "GET", path: "/v1/upvotes/feed" })
    .input(
      z.object({
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

  subscribe: oc
    .route({ method: "GET", path: "/v1/upvotes/stream" })
    .output(eventIterator(VoteEventSchema)),
});

export type ContractType = typeof contract;
