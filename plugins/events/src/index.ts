import { ORPCError } from "@orpc/server";
import { Context, Effect, Layer } from "effect";
import { createPlugin } from "every-plugin";
import { z } from "zod";
import { contract } from "./contract";
import { DatabaseLive } from "./db/layer";
import type { AuthContext } from "./lib/auth";
import { EventService, EventServiceLive } from "./services/events";
import { LumaService, parseLumaApiKeys } from "./services/luma";

type EventsContext = AuthContext & {
  allowPublicVisibility?: boolean;
};

const EventsContextSchema = z.custom<EventsContext>();

class Luma extends Context.Service<Luma, LumaService>()("events/LumaService") {}

const internalError = (defect: unknown) =>
  defect instanceof ORPCError
    ? defect
    : new ORPCError("INTERNAL_SERVER_ERROR", {
        message: defect instanceof Error ? defect.message : String(defect),
      });

const runEvent = <A, E>(effect: Effect.Effect<A, E>) =>
  effect.pipe(Effect.catchDefect((defect) => Effect.fail(internalError(defect))));

export default createPlugin({
  variables: z.object({}),

  secrets: z.object({
    EVENTS_DATABASE_URL: z.string().default("pglite:.bos/events/:memory:"),
    LUMA_CALENDAR_API_KEYS: z.string().default(""),
  }),

  context: EventsContextSchema,

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const Database = DatabaseLive(config.secrets.EVENTS_DATABASE_URL);
      const luma = new LumaService(parseLumaApiKeys(config.secrets.LUMA_CALENDAR_API_KEYS));

      console.log("[Events] Services Initialized");
      return Layer.mergeAll(
        EventServiceLive.pipe(Layer.provide(Database)),
        Layer.succeed(Luma, luma),
        Layer.effectDiscard(Effect.addFinalizer(() => Effect.log("[Events] Shutdown"))),
      );
    }),

  createRouter: (builder) => {
    const requireAuth = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "Authentication required",
        });
      }
      return next({ context: { ...context, userId: context.userId!, user: context.user! } });
    });

    const requireAdmin = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
      }
      if (context.user.role !== "admin") {
        throw new ORPCError("FORBIDDEN", { message: "Admin access required" });
      }
      return next({ context: { ...context, userId: context.userId!, user: context.user! } });
    });

    /**
     * Every id besides the canonical owner id that the caller's rows may be owned by: their
     * other linked NEAR accounts and their user id (#362). A primary switch or a later NEAR
     * link must not cost the caller their own records.
     */
    const getAlternateOwnerIds = (context: {
      userId?: string | null;
      near?: {
        primaryAccountId?: string | null;
        linkedAccounts?: Array<{ accountId?: string | null }> | null;
      };
    }): string[] => {
      const ownerId = context.near?.primaryAccountId ?? context.userId;
      const ids = [
        ...(context.near?.linkedAccounts ?? []).map((account) => account.accountId),
        context.userId,
      ].filter((id): id is string => Boolean(id) && id !== ownerId);
      return [...new Set(ids)];
    };

    return {
      listLumaCalendars: builder.listLumaCalendars.effect(function* () {
        const luma = yield* Luma;
        return yield* Effect.promise(() => luma.listCalendars());
      }),

      listLumaEvents: builder.listLumaEvents.effect(function* ({ input, errors, context }) {
        const luma = yield* Luma;
        return yield* Effect.tryPromise({
          try: () =>
            luma.listEvents({
              ...input,
              isAdmin: context.user?.role === "admin",
            }),
          catch: (error) =>
            errors.BAD_REQUEST({
              message: error instanceof Error ? error.message : "Could not list Luma events",
              data: {},
            }),
        });
      }),

      getLumaEvent: builder.getLumaEvent.effect(function* ({ input, errors, context }) {
        const luma = yield* Luma;
        return yield* Effect.tryPromise({
          try: () =>
            luma.getEvent(input.calendarId, input.eventId, {
              isAdmin: context.user?.role === "admin",
            }),
          catch: () =>
            errors.NOT_FOUND({
              message: "Luma event not found",
              data: { resource: "luma-event", resourceId: input.eventId },
            }),
        });
      }),

      listEvents: builder.listEvents.effect(function* ({ input, context }) {
        const event = yield* EventService;
        return yield* runEvent(
          event.listEvents(
            input,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            getAlternateOwnerIds(context),
            context.user?.role ?? undefined,
          ),
        );
      }),

      getEvent: builder.getEvent.effect(function* ({ input, errors, context }) {
        const event = yield* EventService;
        const result = yield* runEvent(
          event.getEvent(
            input.id,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            getAlternateOwnerIds(context),
            context.user?.role ?? undefined,
          ),
        );
        if (!result) {
          return yield* Effect.fail(
            errors.NOT_FOUND({
              message: "Event not found",
              data: { resource: "event", resourceId: input.id },
            }),
          );
        }
        return { data: result };
      }),

      getEventBySlug: builder.getEventBySlug.effect(function* ({ input, errors, context }) {
        const event = yield* EventService;
        const result = yield* runEvent(
          event.getEventBySlug(
            input.slug,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            getAlternateOwnerIds(context),
            context.user?.role ?? undefined,
          ),
        );
        if (!result) {
          return yield* Effect.fail(
            errors.NOT_FOUND({
              message: "Event not found",
              data: { resource: "event", resourceId: input.slug },
            }),
          );
        }
        return { data: result };
      }),

      listEventParticipants: builder.listEventParticipants.effect(function* ({
        input,
        errors,
        context,
      }) {
        const event = yield* EventService;
        const data = yield* runEvent(
          event.listEventParticipants(
            input.eventId,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            getAlternateOwnerIds(context),
            context.user?.role ?? undefined,
          ),
        ).pipe(
          Effect.mapError((error) =>
            error.code === "NOT_FOUND"
              ? errors.NOT_FOUND({
                  message: "Event not found",
                  data: { resource: "event", resourceId: input.eventId },
                })
              : error,
          ),
        );
        return { data };
      }),

      joinEvent: builder.joinEvent.use(requireAuth).effect(function* ({ input, context, errors }) {
        const event = yield* EventService;
        const data = yield* runEvent(
          event.joinEvent(
            input.eventId,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            context.near?.primaryAccountId ?? undefined,
            context.user.name ?? context.user.email,
            getAlternateOwnerIds(context),
          ),
        ).pipe(
          Effect.mapError((error) =>
            error.code === "NOT_FOUND"
              ? errors.NOT_FOUND({
                  message: "Event not found",
                  data: { resource: "event", resourceId: input.eventId },
                })
              : error,
          ),
        );
        return { data };
      }),

      leaveEvent: builder.leaveEvent.use(requireAuth).effect(function* ({
        input,
        context,
        errors,
      }) {
        const event = yield* EventService;
        return yield* runEvent(
          event.leaveEvent(
            input.eventId,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            getAlternateOwnerIds(context),
          ),
        ).pipe(
          Effect.mapError((error) =>
            error.code === "NOT_FOUND"
              ? errors.NOT_FOUND({
                  message: "Event not found",
                  data: { resource: "event", resourceId: input.eventId },
                })
              : error,
          ),
        );
      }),

      createEvent: builder.createEvent.use(requireAuth).effect(function* ({ input, context }) {
        const event = yield* EventService;
        const isAdmin = context.user.role === "admin";
        if (!isAdmin && !context.near?.primaryAccountId) {
          return yield* Effect.fail(
            new ORPCError("FORBIDDEN", { message: "Link a NEAR account to create content" }),
          );
        }
        const visibility =
          isAdmin || input.visibility !== "public" || context.allowPublicVisibility === true
            ? input.visibility
            : "private";
        return yield* runEvent(
          event.createEvent(
            { ...input, visibility },
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            context.user.role ?? undefined,
            getAlternateOwnerIds(context),
          ),
        );
      }),

      updateEvent: builder.updateEvent.use(requireAuth).effect(function* ({
        input,
        context,
        errors,
      }) {
        const event = yield* EventService;
        return yield* runEvent(
          event.updateEvent(
            input.id,
            input,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            context.user.role ?? undefined,
            getAlternateOwnerIds(context),
            context.allowPublicVisibility === true,
          ),
        ).pipe(
          Effect.mapError((error) =>
            error.code === "NOT_FOUND"
              ? errors.NOT_FOUND({
                  message: "Event not found",
                  data: { resource: "event", resourceId: input.id },
                })
              : error,
          ),
        );
      }),

      applyReviewedEvent: builder.applyReviewedEvent.use(requireAdmin).effect(function* ({
        input,
      }) {
        const event = yield* EventService;
        return yield* runEvent(
          event.updateEvent(input.id, input, input.ownerId, undefined, undefined, true),
        );
      }),

      deleteEvent: builder.deleteEvent.use(requireAuth).effect(function* ({
        input,
        context,
        errors,
      }) {
        const event = yield* EventService;
        return yield* runEvent(
          event.deleteEvent(
            input.id,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            getAlternateOwnerIds(context),
          ),
        ).pipe(
          Effect.mapError((error) =>
            error.code === "NOT_FOUND"
              ? errors.NOT_FOUND({
                  message: "Event not found",
                  data: { resource: "event", resourceId: input.id },
                })
              : error,
          ),
        );
      }),
    };
  },
});
