import { randomUUID } from "node:crypto";
import { createPlugin } from "every-plugin";
import { Cause, Effect, Exit, Layer } from "every-plugin/effect";
import { MemoryPublisher, ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { type ActivityEventSchema, contract } from "./contract";
import { DatabaseLive, DatabaseTag } from "./db/layer";
import { ContextSchema } from "./lib/context";
import { ActivityService, ActivityServiceLive, SELF_REPORTED_SOURCE } from "./services/activity";
import {
  ActivityGatewayWorker,
  createActivityGatewayMethods,
  createHttpActivityGatewayClient,
  type GatewayMode,
} from "./services/activity-gateway";
import { createActivityImportMethods } from "./services/activity-import";
import {
  createActivityReaderClient,
  createSharedActivityStream,
  DEFAULT_ACTIVITY_API_URL,
  isPubliclyVisible,
  NEARBUILDERS_SOURCE,
  toActivityEvent,
  toActivityQuery,
  withReadCache,
} from "./services/activity-reader";
import { createActivityRegistrationClient } from "./services/activity-registration";

type ActivityEvent = z.infer<typeof ActivityEventSchema>;

type ActivityEvents = {
  activity: ActivityEvent;
};

/**
 * In standalone-only mode nothing is written to the legacy table, so responses are built from the
 * request. Callers keep the returned id and pass it back to hideActivity, which finds the outbox row.
 */
function standaloneOnlyEvent(input: {
  source: string;
  type: string;
  actor: string;
  payload: unknown;
}): ActivityEvent {
  return {
    id: `gateway_${randomUUID()}`,
    source: input.source,
    type: input.type,
    actor: input.actor,
    payload: input.payload ?? null,
    verified: true,
    hiddenAt: null,
    createdAt: new Date().toISOString(),
  };
}

async function runEffect<A>(effect: Effect.Effect<A, ORPCError<string, unknown>>) {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isFailure(exit)) {
    const squashed = Cause.squash(exit.cause);
    if (squashed instanceof ORPCError) throw squashed;
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: squashed instanceof Error ? squashed.message : String(squashed),
    });
  }
  return exit.value;
}

export default createPlugin({
  variables: z.object({}),

  secrets: z.object({
    ACTIVITY_DATABASE_URL: z.string().default("pglite:.bos/activity/:memory:"),
    ACTIVITY_GATEWAY_URL: z.string().optional(),
    ACTIVITY_GATEWAY_API_KEY: z.string().optional(),
    ACTIVITY_SOURCE_ID: z.string().default("nearbuilders"),
  }),

  context: ContextSchema,

  contract,

  initialize: (config, _plugins, tools) =>
    Effect.gen(function* () {
      const Database = DatabaseLive(config.secrets.ACTIVITY_DATABASE_URL);
      const ActivityServices = ActivityServiceLive.pipe(Layer.provide(Database));
      const activity = yield* tools.buildService(ActivityService, ActivityServices);
      const database = yield* tools.buildService(DatabaseTag, Database);
      const publisher = new MemoryPublisher<ActivityEvents>({ resumeRetentionSeconds: 120 });

      const gatewayUrl = config.secrets.ACTIVITY_GATEWAY_URL?.trim();
      const gatewayApiKey = config.secrets.ACTIVITY_GATEWAY_API_KEY?.trim();
      const gatewayClient =
        gatewayUrl && gatewayApiKey
          ? createHttpActivityGatewayClient({ baseUrl: gatewayUrl, apiKey: gatewayApiKey })
          : null;
      const gateway = createActivityGatewayMethods(database, gatewayClient);
      const gatewayWorker = new ActivityGatewayWorker(gateway);
      if (gatewayClient) gatewayWorker.start();
      const historyImport = createActivityImportMethods(database, gateway);
      const reader = withReadCache(
        createActivityReaderClient({ baseUrl: gatewayUrl || DEFAULT_ACTIVITY_API_URL }),
      );
      const liveStream = createSharedActivityStream(reader);
      const registration =
        gatewayUrl && gatewayApiKey
          ? createActivityRegistrationClient({
              baseUrl: gatewayUrl,
              apiKey: gatewayApiKey,
              reader,
            })
          : null;
      const ownSource = config.secrets.ACTIVITY_SOURCE_ID.trim() || NEARBUILDERS_SOURCE;

      console.log("[Activity] Services Initialized");
      return {
        activity,
        publisher,
        gateway,
        gatewayWorker,
        historyImport,
        registration,
        reader,
        liveStream,
        ownSource,
      };
    }),

  shutdown: (services) =>
    Effect.sync(() => {
      services.gatewayWorker.stop();
    }),

  createRouter: (services, builder) => {
    const requireAuth = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId || !context.near?.primaryAccountId) {
        throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
      }
      return next({ context });
    });

    const requireAdmin = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
      }
      if (context.user.role !== "admin") {
        throw new ORPCError("FORBIDDEN", { message: "Admin access required" });
      }
      return next({ context });
    });

    /** Activity is the source of reads; only self-reported uploads stay in this plugin's store. */
    const fromActivity = async <T>(read: () => Promise<T>): Promise<T> => {
      try {
        return await read();
      } catch (error) {
        console.error("[Activity] Read from activity.nearbuilders.org failed", error);
        throw new ORPCError("SERVICE_UNAVAILABLE", {
          message: "Activity is unavailable right now. Try again shortly.",
        });
      }
    };

    return {
      startActivityRegistration: builder.startActivityRegistration
        .use(requireAuth)
        .handler(async ({ input }) => {
          if (!services.registration) {
            throw new ORPCError("SERVICE_UNAVAILABLE", {
              message: "Activity registration is not configured",
            });
          }
          return services.registration.startSession(input);
        }),

      getProjectActivity: builder.getProjectActivity.handler(async ({ input }) => {
        if (!services.registration) {
          return {
            status: "none" as const,
            sourceId: null,
            displayName: null,
            reviewReason: null,
            activityUrl: "https://activity.nearbuilders.org",
          };
        }
        return services.registration.projectStatus(input.projectId);
      }),

      getProjectActivityEvents: builder.getProjectActivityEvents.handler(async ({ input }) => {
        if (!services.registration) return { events: [], nextCursor: null };
        return services.registration.projectEvents(input.projectId, input.cursor);
      }),

      getProjectActivityContributors: builder.getProjectActivityContributors.handler(
        async ({ input }) => {
          if (!services.registration) return [];
          return services.registration.projectContributors(input.projectId);
        },
      ),

      emitActivity: builder.emitActivity.use(requireAuth).handler(async ({ input, context }) => {
        const actor = context.near?.primaryAccountId;
        if (!actor) {
          throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
        }
        const event = await runEffect(
          services.activity.emitActivity({
            ...input,
            actor,
            verified: false,
          }),
        );
        await services.publisher.publish("activity", event);
        return event;
      }),

      emitTrustedActivity: builder.emitTrustedActivity
        .use(requireAdmin)
        .handler(async ({ input }) => {
          const mode = await services.gateway.getMode();
          const event =
            mode === "standalone-only"
              ? standaloneOnlyEvent(input)
              : await runEffect(services.activity.emitActivity({ ...input, verified: true }));

          if (mode !== "legacy-only") {
            await services.gateway.trySend(
              await services.gateway.enqueuePublish({
                legacyEventId: event.id,
                source: input.source,
                type: input.type,
                actor: input.actor,
                payload: input.payload,
                idempotencyKey: input.idempotencyKey,
              }),
            );
          }
          services.reader.clear();

          await services.publisher.publish("activity", event);
          return event;
        }),

      hideActivity: builder.hideActivity.use(requireAdmin).handler(async ({ input }) => {
        const mode = await services.gateway.getMode();
        const published =
          mode === "standalone-only" ? await services.gateway.findPublished(input.id) : null;
        if (mode === "standalone-only" && !published) {
          throw new ORPCError("NOT_FOUND", { message: "Activity event not found" });
        }
        const event = published
          ? {
              id: input.id,
              source: published.legacySource,
              type: published.legacyType,
              actor: published.actor,
              payload: published.payload ?? null,
              verified: true,
              hiddenAt: new Date().toISOString(),
              createdAt: new Date(published.createdAt).toISOString(),
            }
          : await runEffect(services.activity.hideActivity(input.id));

        if (mode !== "legacy-only") {
          await services.gateway.trySend(
            await services.gateway.enqueueRetract({
              legacyEventId: input.id,
              reason: "Hidden by nearbuilders.org",
            }),
          );
        }
        services.reader.clear();

        await services.publisher.publish("activity", event);
        return event;
      }),

      getActivityGatewayStatus: builder.getActivityGatewayStatus
        .use(requireAdmin)
        .handler(async () => services.gateway.status()),

      setActivityGatewayMode: builder.setActivityGatewayMode
        .use(requireAdmin)
        .handler(async ({ input }) => {
          await services.gateway.setMode(input.mode as GatewayMode);
          return services.gateway.status();
        }),

      retryActivityGateway: builder.retryActivityGateway.use(requireAdmin).handler(async () => {
        await services.gateway.processDue(100);
        return services.gateway.status();
      }),

      redateActivityHistory: builder.redateActivityHistory
        .use(requireAdmin)
        .handler(async ({ input }) => services.gateway.redate({ dryRun: input.dryRun })),

      importActivityHistory: builder.importActivityHistory
        .use(requireAdmin)
        .handler(async ({ input }) =>
          services.historyImport.plan({
            dryRun: input.dryRun,
            since: input.since ? new Date(input.since) : undefined,
            limit: input.limit,
          }),
        ),

      getActivityFeed: builder.getActivityFeed.handler(async ({ input }) => {
        if (input.source === SELF_REPORTED_SOURCE) {
          return await runEffect(services.activity.getActivityFeed(input));
        }
        const query = toActivityQuery(input, services.ownSource);
        if (!query) return { data: [], meta: { total: 0, hasMore: false, nextCursor: null } };
        const page = await fromActivity(() =>
          services.reader.listEvents({
            ...query,
            limit: Math.min(input.limit ?? 50, 100),
            cursor: input.cursor,
          }),
        );
        const visible = page.data.filter((event) => isPubliclyVisible(event, services.ownSource));
        const legacyIds = await services.gateway.legacyIdsFor(visible.map(({ id }) => id));
        const data = visible.map((event) => toActivityEvent(event, legacyIds, services.ownSource));
        return {
          data,
          meta: {
            total: data.length,
            hasMore: page.nextCursor !== null,
            nextCursor: page.nextCursor,
          },
        };
      }),

      subscribeActivity: builder.subscribeActivity.handler(async function* ({
        input,
        signal,
        lastEventId,
      }) {
        if (input.source === SELF_REPORTED_SOURCE) {
          const iterator = services.publisher.subscribe("activity", { signal, lastEventId });
          for await (const event of iterator) {
            if (event.source !== SELF_REPORTED_SOURCE) continue;
            if (input.actor && event.actor !== input.actor) continue;
            yield event;
          }
          return;
        }
        const query = toActivityQuery(input, services.ownSource);
        if (!query) return;
        for await (const event of services.liveStream.subscribe({ signal })) {
          if (query.source && event.source !== query.source) continue;
          if (query.type && event.type !== query.type) continue;
          if (query.actor && event.actor !== query.actor) continue;
          if (!isPubliclyVisible(event, services.ownSource)) continue;
          const legacyIds = await services.gateway.legacyIdsFor([event.id]);
          yield toActivityEvent(event, legacyIds, services.ownSource);
        }
      }),

      getLeaderboard: builder.getLeaderboard.handler(async ({ input }) => {
        const entries = await fromActivity(() =>
          services.reader.leaderboard({
            period: input.period,
            limit: Math.min(input.limit ?? 50, 100),
          }),
        );
        return entries.map((entry) => ({
          actor: entry.actor,
          eventCount: entry.eventCount,
          endorsementScore: entry.score,
          topSources: [...new Set(entry.breakdown.map(({ source }) => source))],
        }));
      }),
    };
  },
});
