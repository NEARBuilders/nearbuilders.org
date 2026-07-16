import { and, count, desc, eq, inArray, or } from "drizzle-orm";
import { Context, Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { DatabaseTag } from "../db/layer";
import { eventParticipants, events } from "../db/schema";

function toIsoString(value: Date | string | null | undefined): string {
  if (!value) return "";
  return typeof value === "string" ? value : value.toISOString();
}

function normalizeOptionalText(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

type EventStatus = "active" | "cancelled";
type EventVisibility = "private" | "unlisted" | "public";

export interface EventRecord {
  id: string;
  ownerId: string;
  slug: string;
  title: string;
  description: string | null;
  content: string | null;
  status: EventStatus;
  visibility: EventVisibility;
  lumaUrl: string | null;
  startAt: string;
  endAt: string | null;
  location: string | null;
  participantCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EventParticipantRecord {
  id: string;
  eventId: string;
  userId: string;
  walletAddress: string | null;
  displayName: string | null;
  role: "participant" | "organizer";
  createdAt: string;
  updatedAt: string;
}

function generateId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateParticipantId(): string {
  return `evt_part_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function isOwner(eventOwnerId: string, userId?: string, alternateUserId?: string) {
  return eventOwnerId === userId || eventOwnerId === alternateUserId;
}

function rowToEvent(row: any, participantCount = 0): EventRecord {
  return {
    id: row.id,
    ownerId: row.ownerId,
    slug: row.slug,
    title: row.title,
    description: row.description ?? null,
    content: row.content ?? null,
    status: row.status as EventStatus,
    visibility: row.visibility as EventVisibility,
    lumaUrl: row.lumaUrl ?? null,
    startAt: toIsoString(row.startAt),
    endAt: row.endAt ? toIsoString(row.endAt) : null,
    location: row.location ?? null,
    participantCount,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function rowToParticipant(row: any): EventParticipantRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    userId: row.userId,
    walletAddress: row.walletAddress ?? null,
    displayName: row.displayName ?? null,
    role: row.role === "organizer" ? "organizer" : "participant",
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function parseDate(value: string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ORPCError("BAD_REQUEST", { message: `${label} must be a valid date` });
  }
  return date;
}

function assertEventDates(startAt: Date, endAt?: Date | null) {
  if (endAt && endAt.getTime() < startAt.getTime()) {
    throw new ORPCError("BAD_REQUEST", { message: "End date must be after start date" });
  }
}

function eventWriteError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/duplicate|unique|events_slug_unique|events_owner_slug_unique/i.test(message)) {
    return new ORPCError("BAD_REQUEST", { message: "An event with this slug already exists" });
  }
  return new ORPCError("BAD_REQUEST", { message: message || "Could not save event" });
}

export class EventService extends Context.Tag("events/EventService")<
  EventService,
  {
    listEvents: (
      input: {
        ownerId?: string;
        visibility?: EventVisibility;
        status?: EventStatus;
        limit?: number;
        cursor?: string;
      },
      userId?: string,
      alternateUserId?: string,
    ) => Effect.Effect<
      {
        data: EventRecord[];
        meta: { total: number; hasMore: boolean; nextCursor: string | null };
      },
      ORPCError<string, unknown>
    >;
    getEvent: (
      id: string,
      userId?: string,
      alternateUserId?: string,
    ) => Effect.Effect<EventRecord | null, ORPCError<string, unknown>>;
    getEventBySlug: (
      slug: string,
      userId?: string,
      alternateUserId?: string,
    ) => Effect.Effect<EventRecord | null, ORPCError<string, unknown>>;
    listEventParticipants: (
      eventId: string,
      userId?: string,
      alternateUserId?: string,
    ) => Effect.Effect<EventParticipantRecord[], ORPCError<string, unknown>>;
    joinEvent: (
      eventId: string,
      userId: string,
      walletAddress?: string,
      displayName?: string,
      alternateUserId?: string,
    ) => Effect.Effect<EventParticipantRecord, ORPCError<string, unknown>>;
    leaveEvent: (
      eventId: string,
      userId: string,
      alternateUserId?: string,
    ) => Effect.Effect<{ deleted: boolean }, ORPCError<string, unknown>>;
    createEvent: (
      input: {
        id?: string;
        title: string;
        slug: string;
        description?: string;
        content?: string;
        visibility?: EventVisibility;
        status?: EventStatus;
        lumaUrl?: string;
        startAt: string;
        endAt?: string;
        location?: string;
        ownerId?: string;
      },
      userId: string,
      userRole?: string,
      alternateUserId?: string,
    ) => Effect.Effect<EventRecord, ORPCError<string, unknown>>;
    updateEvent: (
      id: string,
      input: {
        title?: string;
        description?: string;
        content?: string;
        visibility?: EventVisibility;
        status?: EventStatus;
        lumaUrl?: string;
        startAt?: string;
        endAt?: string;
        location?: string;
        ownerId?: string;
      },
      userId: string,
      userRole?: string,
      alternateUserId?: string,
    ) => Effect.Effect<EventRecord, ORPCError<string, unknown>>;
    deleteEvent: (
      id: string,
      userId: string,
      userRole?: string,
      alternateUserId?: string,
    ) => Effect.Effect<{ deleted: boolean }, ORPCError<string, unknown>>;
  }
>() {}

const viewableEvent = (db: any, id: string, userId?: string, alternateUserId?: string) =>
  Effect.gen(function* () {
    const results = (yield* Effect.promise(() =>
      db.select().from(events).where(eq(events.id, id)).limit(1),
    )) as any[];
    const event = results[0];

    if (!event) return null;
    if (event.visibility === "public" || event.visibility === "unlisted") return event;
    if ((userId || alternateUserId) && isOwner(event.ownerId, userId, alternateUserId))
      return event;
    return null;
  });

const viewableEventBySlug = (db: any, slug: string, userId?: string, alternateUserId?: string) =>
  Effect.gen(function* () {
    const results = (yield* Effect.promise(() =>
      db.select().from(events).where(eq(events.slug, slug)).limit(1),
    )) as any[];
    const event = results[0];

    if (!event) return null;
    if (event.visibility === "public" || event.visibility === "unlisted") return event;
    if ((userId || alternateUserId) && isOwner(event.ownerId, userId, alternateUserId))
      return event;
    return null;
  });

const canEditEvent = (
  db: any,
  id: string,
  userId: string,
  userRole?: string,
  alternateUserId?: string,
) =>
  Effect.gen(function* () {
    if (userRole === "admin") return true;

    const results = (yield* Effect.promise(() =>
      db.select().from(events).where(eq(events.id, id)).limit(1),
    )) as any[];
    const event = results[0];

    return event ? isOwner(event.ownerId, userId, alternateUserId) : false;
  });

const countParticipants = (db: any, eventId: string) =>
  Effect.gen(function* () {
    const results = (yield* Effect.promise(() =>
      db
        .select({ count: count() })
        .from(eventParticipants)
        .where(eq(eventParticipants.eventId, eventId)),
    )) as Array<{ count: number }>;
    const [result] = results;
    return result?.count ?? 0;
  });

const participantOwnerConditions = (userId: string, alternateUserId?: string) =>
  [
    eq(eventParticipants.userId, userId),
    alternateUserId ? eq(eventParticipants.userId, alternateUserId) : undefined,
  ].filter(Boolean);

const viewableEventConditions = (userId?: string, alternateUserId?: string) => {
  const visibleConditions: any[] = [inArray(events.visibility, ["public", "unlisted"])];
  const ownerConditions = [
    userId ? eq(events.ownerId, userId) : undefined,
    alternateUserId ? eq(events.ownerId, alternateUserId) : undefined,
  ].filter(Boolean);
  if (ownerConditions.length > 0) visibleConditions.push(or(...ownerConditions));
  return or(...visibleConditions);
};

export const EventServiceLive = Layer.effect(
  EventService,
  Effect.gen(function* () {
    const db = yield* DatabaseTag;

    return {
      listEvents: (input, userId, alternateUserId) =>
        Effect.gen(function* () {
          const limit = Math.min(input.limit ?? 24, 100);
          const offset = input.cursor ? parseInt(input.cursor, 10) : 0;
          const conditions: any[] = [];

          if (input.ownerId) conditions.push(eq(events.ownerId, input.ownerId));
          if (input.status) conditions.push(eq(events.status, input.status));

          if (input.visibility) conditions.push(eq(events.visibility, input.visibility));
          conditions.push(viewableEventConditions(userId, alternateUserId));

          const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

          const [totalResult] = yield* Effect.promise(() =>
            db.select({ count: count() }).from(events).where(whereClause),
          );
          const total = totalResult?.count ?? 0;

          const records = yield* Effect.promise(() =>
            db
              .select()
              .from(events)
              .where(whereClause)
              .orderBy(desc(events.startAt))
              .limit(limit)
              .offset(offset),
          );

          const nextOffset = offset + limit;
          const hasMore = nextOffset < total;

          const data: EventRecord[] = [];
          for (const row of records) {
            const participantCount = yield* countParticipants(db, row.id);
            data.push(rowToEvent(row, participantCount));
          }

          return {
            data,
            meta: { total, hasMore, nextCursor: hasMore ? String(nextOffset) : null },
          };
        }),

      getEvent: (id, userId, alternateUserId) =>
        Effect.gen(function* () {
          const event = yield* viewableEvent(db, id, userId, alternateUserId);
          if (!event) return null;
          const participantCount = yield* countParticipants(db, event.id);
          return rowToEvent(event, participantCount);
        }),

      getEventBySlug: (slug, userId, alternateUserId) =>
        Effect.gen(function* () {
          const event = yield* viewableEventBySlug(db, slug, userId, alternateUserId);
          if (!event) return null;
          const participantCount = yield* countParticipants(db, event.id);
          return rowToEvent(event, participantCount);
        }),

      listEventParticipants: (eventId, userId, alternateUserId) =>
        Effect.gen(function* () {
          const event = yield* viewableEvent(db, eventId, userId, alternateUserId);
          if (!event) {
            return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Event not found" }));
          }

          const participants = yield* Effect.promise(() =>
            db
              .select()
              .from(eventParticipants)
              .where(eq(eventParticipants.eventId, eventId))
              .orderBy(desc(eventParticipants.createdAt)),
          );

          return participants.map(rowToParticipant);
        }),

      joinEvent: (eventId, userId, walletAddress, displayName, alternateUserId) =>
        Effect.gen(function* () {
          const event = yield* viewableEvent(db, eventId, userId, alternateUserId);
          if (!event) {
            return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Event not found" }));
          }
          if (event.status === "cancelled") {
            return yield* Effect.fail(
              new ORPCError("BAD_REQUEST", {
                message: "Cancelled events cannot accept participants",
              }),
            );
          }

          const ownerConditions = participantOwnerConditions(userId, alternateUserId);
          const [existing] = yield* Effect.promise(() =>
            db
              .select()
              .from(eventParticipants)
              .where(
                and(
                  eq(eventParticipants.eventId, eventId),
                  ownerConditions.length > 1 ? or(...ownerConditions) : ownerConditions[0],
                ),
              )
              .limit(1),
          );

          if (existing) return rowToParticipant(existing);

          const now = new Date();
          const id = generateParticipantId();
          yield* Effect.promise(() =>
            db.insert(eventParticipants).values({
              id,
              eventId,
              userId,
              walletAddress: normalizeOptionalText(walletAddress),
              displayName:
                normalizeOptionalText(displayName) ??
                normalizeOptionalText(walletAddress) ??
                userId,
              role: isOwner(event.ownerId, userId, alternateUserId) ? "organizer" : "participant",
              createdAt: now,
              updatedAt: now,
            }),
          );

          const [participant] = yield* Effect.promise(() =>
            db.select().from(eventParticipants).where(eq(eventParticipants.id, id)).limit(1),
          );

          return rowToParticipant(participant);
        }),

      leaveEvent: (eventId, userId, alternateUserId) =>
        Effect.gen(function* () {
          const event = yield* viewableEvent(db, eventId, userId, alternateUserId);
          if (!event) {
            return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Event not found" }));
          }

          const ownerConditions = participantOwnerConditions(userId, alternateUserId);
          yield* Effect.promise(() =>
            db
              .delete(eventParticipants)
              .where(
                and(
                  eq(eventParticipants.eventId, eventId),
                  ownerConditions.length > 1 ? or(...ownerConditions) : ownerConditions[0],
                ),
              ),
          );

          return { deleted: true };
        }),

      createEvent: (input, userId, userRole, alternateUserId) =>
        Effect.gen(function* () {
          const ownerId = input.ownerId?.trim() || userId;
          if (userRole !== "admin" && !isOwner(ownerId, userId, alternateUserId)) {
            return yield* Effect.fail(
              new ORPCError("FORBIDDEN", { message: "You can only create your own events" }),
            );
          }

          const now = new Date();
          const id = input.id ?? generateId();
          const startAt = parseDate(input.startAt, "Start date");
          const endAt = input.endAt ? parseDate(input.endAt, "End date") : null;
          assertEventDates(startAt, endAt);

          yield* Effect.tryPromise({
            try: () =>
              db.insert(events).values({
                id,
                ownerId,
                slug: input.slug,
                title: input.title.trim(),
                description: normalizeOptionalText(input.description),
                content: normalizeOptionalText(input.content),
                status: input.status ?? "active",
                visibility: input.visibility ?? "private",
                lumaUrl: normalizeOptionalText(input.lumaUrl),
                startAt,
                endAt,
                location: normalizeOptionalText(input.location),
                createdAt: now,
                updatedAt: now,
              }),
            catch: eventWriteError,
          });

          const [event] = yield* Effect.promise(() =>
            db.select().from(events).where(eq(events.id, id)).limit(1),
          );
          if (!event) {
            return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Event not found" }));
          }

          const participantCount = yield* countParticipants(db, event.id);
          return rowToEvent(event, participantCount);
        }),

      updateEvent: (id, input, userId, userRole, alternateUserId) =>
        Effect.gen(function* () {
          const canEdit = yield* canEditEvent(db, id, userId, userRole, alternateUserId);
          if (!canEdit) {
            return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Event not found" }));
          }

          const [existing] = yield* Effect.promise(() =>
            db.select().from(events).where(eq(events.id, id)).limit(1),
          );
          if (!existing) {
            return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Event not found" }));
          }

          const startAt = input.startAt ? parseDate(input.startAt, "Start date") : existing.startAt;
          const endAt =
            input.endAt !== undefined
              ? input.endAt
                ? parseDate(input.endAt, "End date")
                : null
              : existing.endAt;
          assertEventDates(startAt, endAt);

          const updates: any = { updatedAt: new Date(), startAt, endAt };
          if (input.title !== undefined) updates.title = input.title.trim();
          if (input.description !== undefined)
            updates.description = normalizeOptionalText(input.description);
          if (input.content !== undefined) updates.content = normalizeOptionalText(input.content);
          if (input.visibility !== undefined) updates.visibility = input.visibility;
          if (input.status !== undefined) updates.status = input.status;
          if (input.lumaUrl !== undefined) updates.lumaUrl = normalizeOptionalText(input.lumaUrl);
          if (input.location !== undefined)
            updates.location = normalizeOptionalText(input.location);
          if (input.ownerId !== undefined && userRole === "admin") {
            updates.ownerId = input.ownerId.trim();
          }

          yield* Effect.promise(() => db.update(events).set(updates).where(eq(events.id, id)));

          const [event] = yield* Effect.promise(() =>
            db.select().from(events).where(eq(events.id, id)).limit(1),
          );
          if (!event) {
            return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Event not found" }));
          }

          const participantCount = yield* countParticipants(db, event.id);
          return rowToEvent(event, participantCount);
        }),

      deleteEvent: (id, userId, userRole, alternateUserId) =>
        Effect.gen(function* () {
          const canEdit = yield* canEditEvent(db, id, userId, userRole, alternateUserId);
          if (!canEdit) {
            return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Event not found" }));
          }

          yield* Effect.promise(() => db.delete(events).where(eq(events.id, id)));
          return { deleted: true };
        }),
    };
  }),
);
