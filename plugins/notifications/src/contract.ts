import { BAD_REQUEST, FORBIDDEN, NOT_FOUND, UNAUTHORIZED } from "every-plugin/errors";
import { eventIterator, oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

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

export const EmailPreferenceSchema = z.object({
  email: z.string().nullable(),
  verified: z.boolean(),
  enabled: z.boolean(),
  pendingEmail: z.string().nullable(),
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

  getEmailPreference: oc
    .route({ method: "GET", path: "/v1/notifications/email" })
    .input(z.object({ userId: z.string() }))
    .output(EmailPreferenceSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN }),

  setEmailNotificationsEnabled: oc
    .route({ method: "POST", path: "/v1/notifications/email/enabled" })
    .input(z.object({ userId: z.string(), enabled: z.boolean() }))
    .output(EmailPreferenceSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN }),

  setEmailChallenge: oc
    .route({ method: "POST", path: "/v1/notifications/email/challenge" })
    .input(
      z.object({
        userId: z.string(),
        pendingEmail: z.string().email(),
        codeHash: z.string(),
        codeExpiresAt: z.iso.datetime(),
      }),
    )
    .output(z.object({ pendingEmail: z.string() }))
    .errors({ UNAUTHORIZED, FORBIDDEN }),

  confirmEmailCode: oc
    .route({ method: "POST", path: "/v1/notifications/email/confirm" })
    .input(z.object({ userId: z.string(), codeHash: z.string() }))
    .output(EmailPreferenceSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST }),

  syncVerifiedEmail: oc
    .route({ method: "POST", path: "/v1/notifications/email/sync" })
    .input(z.object({ userId: z.string(), email: z.string().email() }))
    .output(EmailPreferenceSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN }),
});

export type ContractType = typeof contract;
