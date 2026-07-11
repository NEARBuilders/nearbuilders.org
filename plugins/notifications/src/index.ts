import { createPlugin } from "every-plugin";
import { Cause, Effect, Exit, Layer } from "every-plugin/effect";
import { MemoryPublisher, ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { contract, type NotificationSchema } from "./contract";
import { DatabaseLive } from "./db/layer";
import { ContextSchema } from "./lib/context";
import { NotificationService, NotificationServiceLive } from "./services/notifications";

type NotificationEvent = z.infer<typeof NotificationSchema>;

type NotificationEvents = {
  notification: NotificationEvent;
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
    NOTIFICATIONS_DATABASE_URL: z.string().default("pglite:.bos/notifications/:memory:"),
  }),

  context: ContextSchema,

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const Database = DatabaseLive(config.secrets.NOTIFICATIONS_DATABASE_URL);
      const NotificationServices = NotificationServiceLive.pipe(Layer.provide(Database));
      const notification = yield* Effect.provide(NotificationService, NotificationServices);
      const publisher = new MemoryPublisher<NotificationEvents>({ resumeRetentionSeconds: 120 });

      console.log("[Notifications] Services Initialized");
      return { notification, publisher };
    }),

  shutdown: () => Effect.log("[Notifications] Shutdown"),

  createRouter: (services, builder) => {
    const requireAuth = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
      }
      return next({ context });
    });

    return {
      createNotification: builder.createNotification
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          if (input.userId !== context.userId && context.user?.role !== "admin") {
            throw new ORPCError("FORBIDDEN", { message: "Cannot notify another user" });
          }
          const data = await runEffect(services.notification.createNotification(input));
          await services.publisher.publish("notification", data);
          return { data };
        }),

      getMyNotifications: builder.getMyNotifications
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          return await runEffect(services.notification.getMyNotifications(context.userId!, input));
        }),

      markAsRead: builder.markAsRead.use(requireAuth).handler(async ({ input, context }) => {
        const data = await runEffect(services.notification.markAsRead(input.id, context.userId!));
        return { data };
      }),

      markAllAsRead: builder.markAllAsRead.use(requireAuth).handler(async ({ context }) => {
        return await runEffect(services.notification.markAllAsRead(context.userId!));
      }),

      subscribeNotifications: builder.subscribeNotifications
        .use(requireAuth)
        .handler(async function* ({ context, signal, lastEventId }) {
          const iterator = services.publisher.subscribe("notification", { signal, lastEventId });
          for await (const event of iterator) {
            if (event.userId !== context.userId) continue;
            yield event;
          }
        }),
    };
  },
});
