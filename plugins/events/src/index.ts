import { createPlugin } from "every-plugin";
import { Cause, Effect, Exit, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { DatabaseLive } from "./db/layer";
import { ContextSchema } from "./lib/context";
import { EventService, EventServiceLive } from "./services/events";
import { LumaService, parseLumaApiKeys } from "./services/luma";

export default createPlugin({
  variables: z.object({}),

  secrets: z.object({
    EVENTS_DATABASE_URL: z.string().default("pglite:.bos/events/:memory:"),
    LUMA_CALENDAR_API_KEYS: z.string().default("[]"),
  }),

  context: ContextSchema,

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const Database = DatabaseLive(config.secrets.EVENTS_DATABASE_URL);
      const EventServices = EventServiceLive.pipe(Layer.provide(Database));
      const event = yield* Effect.provide(EventService, EventServices);
      const luma = new LumaService(parseLumaApiKeys(config.secrets.LUMA_CALENDAR_API_KEYS));

      console.log("[Events] Services Initialized");
      return { event, luma };
    }),

  shutdown: () => Effect.log("[Events] Shutdown"),

  createRouter: (services, builder) => {
    const requireAuth = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "Authentication required",
        });
      }
      return next({ context: { ...context, userId: context.userId!, user: context.user! } });
    });

    const getAlternateOwnerId = (context: {
      userId?: string | null;
      near?: { primaryAccountId?: string | null };
    }) =>
      context.near?.primaryAccountId && context.near.primaryAccountId !== context.userId
        ? (context.userId ?? undefined)
        : undefined;

    const runEffect = async <A>(effect: Effect.Effect<A, ORPCError<string, unknown>>) => {
      const exit = await Effect.runPromiseExit(effect);
      if (Exit.isFailure(exit)) {
        const squashed = Cause.squash(exit.cause);
        if (squashed instanceof ORPCError) throw squashed;
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: squashed instanceof Error ? squashed.message : String(squashed),
        });
      }
      return exit.value;
    };

    return {
      listLumaCalendars: builder.listLumaCalendars.handler(async () => {
        return await services.luma.listCalendars();
      }),

      listLumaEvents: builder.listLumaEvents.handler(async ({ input, errors }) => {
        try {
          return await services.luma.listEvents(input);
        } catch (error) {
          throw errors.BAD_REQUEST({
            message: error instanceof Error ? error.message : "Could not list Luma events",
            data: {},
          });
        }
      }),

      getLumaEvent: builder.getLumaEvent.handler(async ({ input, errors }) => {
        try {
          return await services.luma.getEvent(input.calendarId, input.eventId);
        } catch {
          throw errors.NOT_FOUND({
            message: "Luma event not found",
            data: { resource: "luma-event", resourceId: input.eventId },
          });
        }
      }),

      listEvents: builder.listEvents.handler(async ({ input, context }) => {
        return await runEffect(
          services.event.listEvents(
            input,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            getAlternateOwnerId(context),
          ),
        );
      }),

      getEvent: builder.getEvent.handler(async ({ input, errors, context }) => {
        const result = await runEffect(
          services.event.getEvent(
            input.id,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            getAlternateOwnerId(context),
          ),
        );
        if (!result) {
          throw errors.NOT_FOUND({
            message: "Event not found",
            data: { resource: "event", resourceId: input.id },
          });
        }
        return { data: result };
      }),

      getEventBySlug: builder.getEventBySlug.handler(async ({ input, errors, context }) => {
        const result = await runEffect(
          services.event.getEventBySlug(
            input.slug,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            getAlternateOwnerId(context),
          ),
        );
        if (!result) {
          throw errors.NOT_FOUND({
            message: "Event not found",
            data: { resource: "event", resourceId: input.slug },
          });
        }
        return { data: result };
      }),

      listEventParticipants: builder.listEventParticipants.handler(
        async ({ input, errors, context }) => {
          try {
            return {
              data: await runEffect(
                services.event.listEventParticipants(
                  input.eventId,
                  context.near?.primaryAccountId ?? context.userId ?? undefined,
                  getAlternateOwnerId(context),
                ),
              ),
            };
          } catch (error) {
            if (error instanceof ORPCError && error.code === "NOT_FOUND") {
              throw errors.NOT_FOUND({
                message: "Event not found",
                data: { resource: "event", resourceId: input.eventId },
              });
            }
            throw error;
          }
        },
      ),

      joinEvent: builder.joinEvent.use(requireAuth).handler(async ({ input, context, errors }) => {
        try {
          return {
            data: await runEffect(
              services.event.joinEvent(
                input.eventId,
                context.near?.primaryAccountId ?? context.userId ?? undefined,
                context.near?.primaryAccountId ?? undefined,
                context.user.name ?? context.user.email,
                getAlternateOwnerId(context),
              ),
            ),
          };
        } catch (error) {
          if (error instanceof ORPCError && error.code === "NOT_FOUND") {
            throw errors.NOT_FOUND({
              message: "Event not found",
              data: { resource: "event", resourceId: input.eventId },
            });
          }
          throw error;
        }
      }),

      leaveEvent: builder.leaveEvent
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          try {
            return await runEffect(
              services.event.leaveEvent(
                input.eventId,
                context.near?.primaryAccountId ?? context.userId ?? undefined,
                getAlternateOwnerId(context),
              ),
            );
          } catch (error) {
            if (error instanceof ORPCError && error.code === "NOT_FOUND") {
              throw errors.NOT_FOUND({
                message: "Event not found",
                data: { resource: "event", resourceId: input.eventId },
              });
            }
            throw error;
          }
        }),

      createEvent: builder.createEvent.use(requireAuth).handler(async ({ input, context }) => {
        return await runEffect(
          services.event.createEvent(
            input,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            context.user.role ?? undefined,
            getAlternateOwnerId(context),
          ),
        );
      }),

      updateEvent: builder.updateEvent
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          try {
            return await runEffect(
              services.event.updateEvent(
                input.id,
                input,
                context.near?.primaryAccountId ?? context.userId ?? undefined,
                context.user.role ?? undefined,
                getAlternateOwnerId(context),
              ),
            );
          } catch (error) {
            if (error instanceof ORPCError && error.code === "NOT_FOUND") {
              throw errors.NOT_FOUND({
                message: "Event not found",
                data: { resource: "event", resourceId: input.id },
              });
            }
            throw error;
          }
        }),

      deleteEvent: builder.deleteEvent
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          try {
            return await runEffect(
              services.event.deleteEvent(
                input.id,
                context.near?.primaryAccountId ?? context.userId ?? undefined,
                context.user.role ?? undefined,
                getAlternateOwnerId(context),
              ),
            );
          } catch (error) {
            if (error instanceof ORPCError && error.code === "NOT_FOUND") {
              throw errors.NOT_FOUND({
                message: "Event not found",
                data: { resource: "event", resourceId: input.id },
              });
            }
            throw error;
          }
        }),
    };
  },
});
