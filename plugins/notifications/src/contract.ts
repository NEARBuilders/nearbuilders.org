import "@orpc/openapi/extensions/route";
import { eventIterator, oc } from "@orpc/contract";
import { FORBIDDEN, NOT_FOUND, UNAUTHORIZED } from "every-plugin/errors";
import { z } from "zod";

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

export const contract = oc.router({
  createNotification: oc
    .route({ method: "POST", path: "/v1/notifications" })
    .input(
      z.object({
        userId: z.string(),
        type: z.string(),
        source: z.string(),
        subject: z.string(),
        body: z.string().optional(),
        link: z.string().optional(),
      }),
    )
    .output(z.object({ data: NotificationSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN }),

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

  markAsRead: oc
    .route({ method: "POST", path: "/v1/notifications/{id}/read" })
    .input(z.object({ id: z.string() }))
    .output(z.object({ data: NotificationSchema }))
    .errors({ UNAUTHORIZED, NOT_FOUND }),

  markAllAsRead: oc
    .route({ method: "POST", path: "/v1/notifications/me/read-all" })
    .output(z.object({ updated: z.number().int().nonnegative() }))
    .errors({ UNAUTHORIZED }),

  subscribeNotifications: oc
    .route({ method: "GET", path: "/v1/notifications/stream" })
    .output(eventIterator(NotificationSchema))
    .errors({ UNAUTHORIZED }),
});

export type ContractType = typeof contract;
