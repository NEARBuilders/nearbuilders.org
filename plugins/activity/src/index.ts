import { randomUUID } from "node:crypto";
import { createPlugin } from "every-plugin";
import { Cause, Effect, Exit, Layer } from "every-plugin/effect";
import { MemoryPublisher, ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { type ActivityEventSchema, contract } from "./contract";
import { DatabaseLive, DatabaseTag } from "./db/layer";
import { ContextSchema } from "./lib/context";
import { ActivityService, ActivityServiceLive } from "./services/activity";
import {
  ActivityGatewayWorker,
  createActivityGatewayMethods,
  createHttpActivityGatewayClient,
  type GatewayMode,
} from "./services/activity-gateway";

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

      console.log("[Activity] Services Initialized");
      return { activity, publisher, gateway, gatewayWorker };
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

    return {
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

      getActivityFeed: builder.getActivityFeed.handler(async ({ input }) => {
        return await runEffect(services.activity.getActivityFeed(input));
      }),

      subscribeActivity: builder.subscribeActivity.handler(async function* ({
        input,
        signal,
        lastEventId,
      }) {
        const iterator = services.publisher.subscribe("activity", { signal, lastEventId });
        for await (const event of iterator) {
          if (input.source && event.source !== input.source) continue;
          if (input.type && event.type !== input.type) continue;
          if (input.actor && event.actor !== input.actor) continue;
          yield event;
        }
      }),

      getLeaderboard: builder.getLeaderboard.handler(async ({ input }) => {
        return await runEffect(services.activity.getLeaderboard(input));
      }),
    };
  },
});
