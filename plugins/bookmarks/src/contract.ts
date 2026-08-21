import { NOT_FOUND, UNAUTHORIZED } from "every-plugin/errors";
import { oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

export const contract = oc.router({
  bookmark: oc
    .route({ method: "POST", path: "/v1/bookmarks" })
    .input(z.object({ entityId: z.string() }))
    .output(
      z.object({
        entityId: z.string(),
        userId: z.string(),
      }),
    )
    .errors({ UNAUTHORIZED }),

  unbookmark: oc
    .route({ method: "DELETE", path: "/v1/bookmarks/{entityId}" })
    .input(z.object({ entityId: z.string() }))
    .output(z.object({ entityId: z.string() }))
    .errors({ UNAUTHORIZED, NOT_FOUND }),

  getUserBookmark: oc
    .route({ method: "GET", path: "/v1/bookmarks/{entityId}/me" })
    .input(z.object({ entityId: z.string() }))
    .output(
      z.object({
        entityId: z.string(),
        isBookmarked: z.boolean(),
      }),
    )
    .errors({ UNAUTHORIZED }),
});

export type ContractType = typeof contract;
