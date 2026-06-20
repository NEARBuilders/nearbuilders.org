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

export const contract = oc.router({
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
