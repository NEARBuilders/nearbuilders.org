import { createPlugin } from "every-plugin";
import { Cause, Effect, Exit, Layer } from "every-plugin/effect";
import { MemoryPublisher, ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { type ActivityEventSchema, contract } from "./contract";
import { DatabaseLive } from "./db/layer";
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

  context: z.object({
    userId: z.string().optional(),
    walletAddress: z.string().optional(),
    user: z
      .object({
        id: z.string(),
        role: z.string().optional(),
        email: z.string().optional(),
        name: z.string().optional(),
      })
      .optional(),
    organizationId: z.string().optional(),
    apiKey: z
      .object({
        id: z.string(),
        name: z.string().nullable(),
        permissions: z.record(z.string(), z.array(z.string())).nullable(),
      })
      .optional(),
    reqHeaders: z.custom<Headers>().optional(),
    getRawBody: z.custom<() => Promise<string>>().optional(),
  }),

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
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
      }
      return next({ context });
    });

    return {
      emitActivity: builder.emitActivity.use(requireAuth).handler(async ({ input }) => {
        const event = await runEffect(services.activity.emitActivity(input));
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
