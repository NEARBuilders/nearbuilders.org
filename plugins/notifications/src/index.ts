import { MemoryPublisher } from "@orpc/publisher/memory";
import { ORPCError } from "@orpc/server";
import { Context, Effect, Layer } from "effect";
import { createPlugin } from "every-plugin";
import { z } from "zod";
import { contract, type NotificationSchema } from "./contract";
import { DatabaseLive } from "./db/layer";
import { ContextSchema } from "./lib/context";
import { NotificationService, NotificationServiceLive } from "./services/notifications";

type NotificationEvent = z.infer<typeof NotificationSchema>;

type NotificationEvents = {
  notification: NotificationEvent;
};

class NotificationPublisher extends Context.Service<
  NotificationPublisher,
  MemoryPublisher<NotificationEvents>
>()("notifications/Publisher") {}

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
      const publisher = new MemoryPublisher<NotificationEvents>({
        resume: { enabled: true, seconds: 120 },
      });

      yield* Effect.addFinalizer(() => Effect.log("[Notifications] Shutdown"));

      console.log("[Notifications] Services Initialized");
      return Layer.mergeAll(
        NotificationServiceLive.pipe(Layer.provide(Database)),
        Layer.succeed(NotificationPublisher, publisher),
      );
    }),

  createRouter: (builder) => {
    const requireAuth = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
      }
      return next({ context });
    });

    return {
      createNotification: builder.createNotification.use(requireAuth).effect(function* ({
        input,
        context,
      }) {
        const serverCall =
          (context as typeof context & { serverNotification?: boolean }).serverNotification ===
          true;
        if (!serverCall && input.userId !== context.userId && context.user?.role !== "admin") {
          return yield* Effect.fail(
            new ORPCError("FORBIDDEN", { message: "Cannot notify another user" }),
          );
        }
        const notification = yield* NotificationService;
        const publisher = yield* NotificationPublisher;
        const data = yield* notification.createNotification(input);
        yield* Effect.promise(() => publisher.publish("notification", data));
        return { data };
      }),

      getMyNotifications: builder.getMyNotifications.use(requireAuth).effect(function* ({
        input,
        context,
      }) {
        const notification = yield* NotificationService;
        return yield* notification.getMyNotifications(context.userId!, input);
      }),

      markAsRead: builder.markAsRead.use(requireAuth).effect(function* ({ input, context }) {
        const notification = yield* NotificationService;
        const data = yield* notification.markAsRead(input.id, context.userId!);
        return { data };
      }),

      markAllAsRead: builder.markAllAsRead.use(requireAuth).effect(function* ({ context }) {
        const notification = yield* NotificationService;
        return yield* notification.markAllAsRead(context.userId!);
      }),

      subscribeNotifications: builder.subscribeNotifications
        .use(requireAuth)
        .handler(async function* ({ context, signal, lastEventId }) {
          const publisher = Context.get(context["effect/context"], NotificationPublisher);
          const iterator = publisher.subscribe("notification", { signal, lastEventId });
          for await (const event of iterator) {
            if (event.userId !== context.userId) continue;
            yield event;
          }
        }),
    };
  },
});
