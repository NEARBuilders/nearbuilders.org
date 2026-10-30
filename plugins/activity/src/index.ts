import { randomUUID } from "node:crypto";
import { MemoryPublisher } from "@orpc/publisher/memory";
import { ORPCError } from "@orpc/server";
import { Cause, Context, Effect, Exit, Layer } from "effect";
import { createPlugin } from "every-plugin";
import { z } from "zod";
import { type ActivityEventSchema, contract } from "./contract";
import type { Database } from "./db";
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

class ActivityPublisher extends Context.Service<
  ActivityPublisher,
  MemoryPublisher<ActivityEvents>
>()("activity/Publisher") {}

function createActivityIntegrations(
  database: Database,
  secrets: {
    ACTIVITY_GATEWAY_URL?: string;
    ACTIVITY_GATEWAY_API_KEY?: string;
    ACTIVITY_SOURCE_ID: string;
  },
) {
  const gatewayUrl = secrets.ACTIVITY_GATEWAY_URL?.trim();
  const gatewayApiKey = secrets.ACTIVITY_GATEWAY_API_KEY?.trim();
  const gatewayClient =
    gatewayUrl && gatewayApiKey
      ? createHttpActivityGatewayClient({ baseUrl: gatewayUrl, apiKey: gatewayApiKey })
      : null;
  const gateway = createActivityGatewayMethods(database, gatewayClient);
  const gatewayWorker = new ActivityGatewayWorker(gateway);
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
  const ownSource = secrets.ACTIVITY_SOURCE_ID.trim() || NEARBUILDERS_SOURCE;

  return {
    gatewayEnabled: gatewayClient !== null,
    gateway,
    gatewayWorker,
    historyImport,
    registration,
    reader,
    liveStream,
    ownSource,
  };
}

class ActivityIntegrations extends Context.Service<
  ActivityIntegrations,
  ReturnType<typeof createActivityIntegrations>
>()("activity/Integrations") {}

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

  initialize: (config) =>
    Effect.sync(() => {
      const publisher = new MemoryPublisher<ActivityEvents>({
        resume: { enabled: true, seconds: 120 },
      });
      const Integrations = Layer.effect(
        ActivityIntegrations,
        Effect.gen(function* () {
          const database = yield* DatabaseTag;
          const integrations = createActivityIntegrations(database, config.secrets);
          yield* Effect.addFinalizer(() =>
            Effect.sync(() => {
              integrations.gatewayWorker.stop();
            }),
          );
          if (integrations.gatewayEnabled) integrations.gatewayWorker.start();
          console.log("[Activity] Services Initialized");
          return integrations;
        }),
      );

      return Layer.mergeAll(
        ActivityServiceLive,
        Integrations,
        Layer.succeed(ActivityPublisher, publisher),
      ).pipe(Layer.provide(DatabaseLive(config.secrets.ACTIVITY_DATABASE_URL)));
    }),

  createRouter: (builder) => {
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
        .effect(function* ({ input, context }) {
          const coreCall =
            (context as typeof context & { activityRegistration?: boolean })
              .activityRegistration === true;
          if (!coreCall) {
            return yield* Effect.fail(
              new ORPCError("FORBIDDEN", {
                message: "Register Activity from the project page",
              }),
            );
          }
          const { registration } = yield* ActivityIntegrations;
          return yield* Effect.promise(async () => {
            if (!registration) {
              throw new ORPCError("SERVICE_UNAVAILABLE", {
                message: "Activity registration is not configured",
              });
            }
            return registration.startSession(input);
          });
        }),

      getProjectActivity: builder.getProjectActivity.effect(function* ({ input }) {
        const { registration } = yield* ActivityIntegrations;
        if (!registration) {
          return {
            status: "none" as const,
            sourceId: null,
            displayName: null,
            reviewReason: null,
            activityUrl: "https://activity.nearbuilders.org",
          };
        }
        return yield* Effect.promise(() => registration.projectStatus(input.projectId));
      }),

      getProjectActivityEvents: builder.getProjectActivityEvents.effect(function* ({ input }) {
        const { registration } = yield* ActivityIntegrations;
        if (!registration) return { events: [], nextCursor: null };
        return yield* Effect.promise(() =>
          registration.projectEvents(input.projectId, input.cursor),
        );
      }),

      getProjectActivityContributors: builder.getProjectActivityContributors.effect(function* ({
        input,
      }) {
        const { registration } = yield* ActivityIntegrations;
        if (!registration) return [];
        return yield* Effect.promise(() => registration.projectContributors(input.projectId));
      }),

      emitActivity: builder.emitActivity.use(requireAuth).effect(function* ({ input, context }) {
        const activity = yield* ActivityService;
        const publisher = yield* ActivityPublisher;
        return yield* Effect.promise(async () => {
          const actor = context.near?.primaryAccountId;
          if (!actor) {
            throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
          }
          const event = await runEffect(
            activity.emitActivity({
              ...input,
              actor,
              verified: false,
            }),
          );
          await publisher.publish("activity", event);
          return event;
        });
      }),

      emitTrustedActivity: builder.emitTrustedActivity.use(requireAdmin).effect(function* ({
        input,
      }) {
        const activity = yield* ActivityService;
        const publisher = yield* ActivityPublisher;
        const { gateway, reader } = yield* ActivityIntegrations;
        return yield* Effect.promise(async () => {
          const mode = await gateway.getMode();
          const event =
            mode === "standalone-only"
              ? standaloneOnlyEvent(input)
              : await runEffect(activity.emitActivity({ ...input, verified: true }));

          if (mode !== "legacy-only") {
            await gateway.trySend(
              await gateway.enqueuePublish({
                legacyEventId: event.id,
                source: input.source,
                type: input.type,
                actor: input.actor,
                payload: input.payload,
                idempotencyKey: input.idempotencyKey,
              }),
            );
          }
          reader.clear();

          await publisher.publish("activity", event);
          return event;
        });
      }),

      hideActivity: builder.hideActivity.use(requireAdmin).effect(function* ({ input }) {
        const activity = yield* ActivityService;
        const publisher = yield* ActivityPublisher;
        const { gateway, reader } = yield* ActivityIntegrations;
        return yield* Effect.promise(async () => {
          const mode = await gateway.getMode();
          const published =
            mode === "standalone-only" ? await gateway.findPublished(input.id) : null;
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
            : await runEffect(activity.hideActivity(input.id));

          if (mode !== "legacy-only") {
            await gateway.trySend(
              await gateway.enqueueRetract({
                legacyEventId: input.id,
                reason: "Hidden by nearbuilders.org",
              }),
            );
          }
          reader.clear();

          await publisher.publish("activity", event);
          return event;
        });
      }),

      getActivityGatewayStatus: builder.getActivityGatewayStatus
        .use(requireAdmin)
        .effect(function* () {
          const { gateway } = yield* ActivityIntegrations;
          return yield* Effect.promise(() => gateway.status());
        }),

      setActivityGatewayMode: builder.setActivityGatewayMode.use(requireAdmin).effect(function* ({
        input,
      }) {
        const { gateway } = yield* ActivityIntegrations;
        return yield* Effect.promise(async () => {
          await gateway.setMode(input.mode as GatewayMode);
          return gateway.status();
        });
      }),

      retryActivityGateway: builder.retryActivityGateway.use(requireAdmin).effect(function* () {
        const { gateway } = yield* ActivityIntegrations;
        return yield* Effect.promise(async () => {
          await gateway.processDue(100);
          return gateway.status();
        });
      }),

      redateActivityHistory: builder.redateActivityHistory.use(requireAdmin).effect(function* ({
        input,
      }) {
        const { gateway } = yield* ActivityIntegrations;
        return yield* Effect.promise(() => gateway.redate({ dryRun: input.dryRun }));
      }),

      importActivityHistory: builder.importActivityHistory.use(requireAdmin).effect(function* ({
        input,
      }) {
        const { historyImport } = yield* ActivityIntegrations;
        return yield* Effect.promise(() =>
          historyImport.plan({
            dryRun: input.dryRun,
            since: input.since ? new Date(input.since) : undefined,
            limit: input.limit,
          }),
        );
      }),

      getActivityFeed: builder.getActivityFeed.effect(function* ({ input }) {
        const activity = yield* ActivityService;
        const { gateway, reader, ownSource } = yield* ActivityIntegrations;
        return yield* Effect.promise(async () => {
          if (input.source === SELF_REPORTED_SOURCE) {
            return await runEffect(activity.getActivityFeed(input));
          }
          const query = toActivityQuery(input, ownSource);
          if (!query) return { data: [], meta: { total: 0, hasMore: false, nextCursor: null } };
          const page = await fromActivity(() =>
            reader.listEvents({
              ...query,
              limit: Math.min(input.limit ?? 50, 100),
              cursor: input.cursor,
            }),
          );
          const visible = page.data.filter((event) => isPubliclyVisible(event, ownSource));
          const legacyIds = await gateway.legacyIdsFor(visible.map(({ id }) => id));
          const data = visible.map((event) => toActivityEvent(event, legacyIds, ownSource));
          return {
            data,
            meta: {
              total: data.length,
              hasMore: page.nextCursor !== null,
              nextCursor: page.nextCursor,
            },
          };
        });
      }),

      subscribeActivity: builder.subscribeActivity.handler(async function* ({
        input,
        context,
        signal,
        lastEventId,
      }) {
        const publisher = Context.get(context["effect/context"], ActivityPublisher);
        const { gateway, liveStream, ownSource } = Context.get(
          context["effect/context"],
          ActivityIntegrations,
        );
        if (input.source === SELF_REPORTED_SOURCE) {
          const iterator = publisher.subscribe("activity", { signal, lastEventId });
          for await (const event of iterator) {
            if (event.source !== SELF_REPORTED_SOURCE) continue;
            if (input.actor && event.actor !== input.actor) continue;
            yield event;
          }
          return;
        }
        const query = toActivityQuery(input, ownSource);
        if (!query) return;
        for await (const event of liveStream.subscribe({ signal })) {
          if (query.source && event.source !== query.source) continue;
          if (query.type && event.type !== query.type) continue;
          if (query.actor && event.actor !== query.actor) continue;
          if (!isPubliclyVisible(event, ownSource)) continue;
          const legacyIds = await gateway.legacyIdsFor([event.id]);
          yield toActivityEvent(event, legacyIds, ownSource);
        }
      }),

      getLeaderboard: builder.getLeaderboard.effect(function* ({ input }) {
        const { reader } = yield* ActivityIntegrations;
        return yield* Effect.promise(async () => {
          const entries = await fromActivity(() =>
            reader.leaderboard({
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
        });
      }),
    };
  },
});
