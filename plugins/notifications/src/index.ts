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

class NotificationStreamConfig extends Context.Service<
  NotificationStreamConfig,
  { maxAgeMs: number }
>()("notifications/StreamConfig") {}

export default createPlugin({
  variables: z.object({
    /**
     * How long one notification stream stays open. The caller's ids are fixed when the
     * stream opens, so it is closed after this long and the client reopens it with a fresh
     * context; an account unlinked mid-stream stops receiving within this window.
     */
    streamMaxAgeMs: z
      .number()
      .int()
      .positive()
      .default(10 * 60_000),
  }),

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
        Layer.succeed(NotificationStreamConfig, { maxAgeMs: config.variables.streamMaxAgeMs }),
      );
    }),

  createRouter: (builder) => {
    /**
     * Every id a notification for the caller may be addressed to (#364): the id the host
     * passes as `userId` (their primary account, or user id without NEAR), each linked NEAR
     * account, and the auth user id, so notifications sent to a linked account or an old
     * primary still reach them.
     */
    const recipientIds = (context: {
      userId?: string | null;
      user?: { id?: string | null } | null;
      near?: {
        primaryAccountId?: string | null;
        linkedAccounts?: Array<{ accountId?: string | null }> | null;
      } | null;
    }): string[] => {
      const ids = [
        context.userId,
        context.near?.primaryAccountId,
        ...(context.near?.linkedAccounts ?? []).map((account) => account.accountId),
        context.user?.id,
      ].filter((id): id is string => Boolean(id));
      return [...new Set(ids)];
    };

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
        if (
          !serverCall &&
          !recipientIds(context).includes(input.userId) &&
          context.user?.role !== "admin"
        ) {
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
        return yield* notification.getMyNotifications(recipientIds(context), input);
      }),

      markAsRead: builder.markAsRead.use(requireAuth).effect(function* ({ input, context }) {
        const notification = yield* NotificationService;
        const data = yield* notification.markAsRead(input.id, recipientIds(context));
        return { data };
      }),

      markAllAsRead: builder.markAllAsRead.use(requireAuth).effect(function* ({ context }) {
        const notification = yield* NotificationService;
        return yield* notification.markAllAsRead(recipientIds(context));
      }),

      subscribeNotifications: builder.subscribeNotifications
        .use(requireAuth)
        .handler(async function* ({ context, signal, lastEventId }) {
          const publisher = Context.get(context["effect/context"], NotificationPublisher);
          const { maxAgeMs } = Context.get(context["effect/context"], NotificationStreamConfig);
          const mine = recipientIds(context);
          // `mine` is a snapshot of the caller's accounts, so end the stream after maxAgeMs
          // and let the client reconnect with its current accounts.
          const expiry = new AbortController();
          // Spread expiries out so clients that connected together don't all reconnect at once.
          const timer = setTimeout(() => expiry.abort(), maxAgeMs * (0.8 + Math.random() * 0.2));
          const iterator = publisher.subscribe("notification", {
            signal: signal ? AbortSignal.any([signal, expiry.signal]) : expiry.signal,
            lastEventId,
          });
          try {
            for await (const event of iterator) {
              if (!mine.includes(event.userId)) continue;
              yield event;
            }
          } catch (error) {
            if (error !== expiry.signal.reason || signal?.aborted) throw error;
          } finally {
            clearTimeout(timer);
          }
        }),
    };
  },
});
