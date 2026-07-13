import { createPlugin } from "every-plugin";
import { Cause, Effect, Exit, Layer } from "every-plugin/effect";
import { MemoryPublisher, ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { type ActivityEventSchema, contract } from "./contract";
import { DatabaseLive } from "./db/layer";
import { ContextSchema } from "./lib/context";
import { ActivityService, ActivityServiceLive } from "./services/activity";

type ActivityEvent = z.infer<typeof ActivityEventSchema>;

type ActivityEvents = {
  activity: ActivityEvent;
};

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
  }),

  context: ContextSchema,

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const Database = DatabaseLive(config.secrets.ACTIVITY_DATABASE_URL);
      const ActivityServices = ActivityServiceLive.pipe(Layer.provide(Database));
      const activity = yield* Effect.provide(ActivityService, ActivityServices);
      const publisher = new MemoryPublisher<ActivityEvents>({ resumeRetentionSeconds: 120 });

      console.log("[Activity] Services Initialized");
      return { activity, publisher };
    }),

  shutdown: () => Effect.log("[Activity] Shutdown"),

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
          const event = await runEffect(
            services.activity.emitActivity({ ...input, verified: true }),
          );
          await services.publisher.publish("activity", event);
          return event;
        }),

      hideActivity: builder.hideActivity.use(requireAdmin).handler(async ({ input }) => {
        const event = await runEffect(services.activity.hideActivity(input.id));
        await services.publisher.publish("activity", event);
        return event;
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
