import { BAD_REQUEST, FORBIDDEN, NOT_FOUND, UNAUTHORIZED } from "every-plugin/errors";
import { oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

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

const LumaCalendarOutput = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().nullable(),
  url: z.string().url(),
  avatarUrl: z.string().url().nullable(),
  coverImageUrl: z.string().url().nullable(),
  description: z.string().nullable(),
  timezone: z.string().nullable(),
});

const LumaCalendarEventOutput = z.object({
  id: z.string(),
  calendarId: z.string(),
  platform: z.enum(["luma", "external"]),
  title: z.string(),
  url: z.string().url(),
  coverUrl: z.string().url().nullable(),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime().nullable(),
  timezone: z.string(),
  location: z.string().nullable(),
  locationType: z.string().nullable(),
  visibility: z.enum(["public", "members-only", "private"]),
  access: z.enum(["manage", "view"]).nullable(),
});

const LumaEventDetailsOutput = LumaCalendarEventOutput.extend({
  description: z.string().nullable(),
  descriptionMarkdown: z.string().nullable(),
  hosts: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      avatarUrl: z.string().url().nullable(),
    }),
  ),
  guestCount: z.number().int().nonnegative(),
  registrationOpen: z.boolean(),
  spotsRemaining: z.number().int().nonnegative().nullable(),
  requireApproval: z.boolean(),
  waitlistEnabled: z.boolean(),
  displayPrice: z
    .object({
      amount: z.number().nonnegative(),
      currency: z.string(),
      isFlexible: z.boolean(),
    })
    .nullable(),
});

export const contract = oc.router({
  listLumaCalendars: oc.route({ method: "GET", path: "/v1/luma/calendars" }).output(
    z.object({
      data: z.array(LumaCalendarOutput),
      unavailableCount: z.number().int().nonnegative(),
    }),
  ),

  listLumaEvents: oc
    .route({ method: "GET", path: "/v1/luma/events" })
    .input(
      z.object({
        after: z.iso.datetime().optional(),
        before: z.iso.datetime().optional(),
        cursor: z.string().optional(),
        limitPerCalendar: z.number().int().min(1).max(50).optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(LumaCalendarEventOutput),
        meta: z.object({
          hasMore: z.boolean(),
          nextCursor: z.string().nullable(),
        }),
        unavailableCalendarIds: z.array(z.string()),
      }),
    )
    .errors({ BAD_REQUEST }),

  getLumaEvent: oc
    .route({ method: "GET", path: "/v1/luma/calendars/{calendarId}/events/{eventId}" })
    .input(z.object({ calendarId: z.string().min(1), eventId: z.string().min(1) }))
    .output(z.object({ data: LumaEventDetailsOutput }))
    .errors({ NOT_FOUND }),

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

  createEvent: oc
    .route({ method: "POST", path: "/v1/events" })
    .input(
      z.object({
        id: z.string().optional(),
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
});

export type ContractType = typeof contract;
