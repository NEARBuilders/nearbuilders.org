import { createPlugin } from "every-plugin";
import { Cause, Effect, Exit, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { DatabaseLive } from "./db/layer";
import { BuilderService, BuilderServiceLive } from "./services/builders";

export default createPlugin({
  variables: z.object({}),

  secrets: z.object({
    BUILDERS_DATABASE_URL: z.string().default("pglite:.bos/builders/:memory:"),
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
    reqHeaders: z.custom<Headers>().optional(),
    getRawBody: z.custom<() => Promise<string>>().optional(),
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const Database = DatabaseLive(config.secrets.BUILDERS_DATABASE_URL);
      const BuilderServices = BuilderServiceLive.pipe(Layer.provide(Database));
      const builder = yield* Effect.provide(BuilderService, BuilderServices);

      console.log("[Builders] Services Initialized");
      return { builder };
    }),

  shutdown: () => Effect.log("[Builders] Shutdown"),

  createRouter: (services, builder) => {
    const requireAuth = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "Authentication required",
        });
      }
      return next({
        context: {
          userId: context.userId,
          walletAddress: context.walletAddress,
          user: context.user,
          reqHeaders: context.reqHeaders,
        },
      });
    });

    const requireAdmin = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
      }
      if (context.user.role !== "admin") {
        throw new ORPCError("FORBIDDEN", { message: "Admin access required" });
      }
      return next({
        context: {
          userId: context.userId,
          walletAddress: context.walletAddress,
          user: context.user,
          reqHeaders: context.reqHeaders,
        },
      });
    });

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
      listBuilders: builder.listBuilders.handler(async ({ input }) => {
        return await runEffect(services.builder.listBuilders(input));
      }),

      listPendingBuilders: builder.listPendingBuilders
        .use(requireAdmin)
        .handler(async ({ input }) => {
          return await runEffect(services.builder.listPendingBuilders(input));
        }),

      getBuilder: builder.getBuilder.handler(async ({ input, errors }) => {
        const result = await runEffect(services.builder.getBuilder(input.nearAccount));
        if (!result) {
          throw errors.NOT_FOUND({
            message: "Builder not found",
            data: { resource: "builder", resourceId: input.nearAccount },
          });
        }
        return { data: result };
      }),

      getMyBuilderProfile: builder.getMyBuilderProfile
        .use(requireAuth)
        .handler(async ({ context }) => {
          const result = await runEffect(
            services.builder.getBuilderByUserId(context.userId, context.walletAddress),
          );
          return { data: result };
        }),

      registerBuilder: builder.registerBuilder
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const nearAccount = context.walletAddress ?? context.userId;
          const result = await runEffect(
            services.builder.registerBuilder(input, nearAccount, context.userId),
          );
          return { data: result };
        }),

      updateBuilderProfile: builder.updateBuilderProfile
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const result = await runEffect(
            services.builder.updateBuilderProfile(
              input.nearAccount,
              input,
              context.userId,
              context.walletAddress,
              context.user.role,
            ),
          );
          if (!result) {
            throw errors.NOT_FOUND({
              message: "Builder not found",
              data: { resource: "builder", resourceId: input.nearAccount },
            });
          }
          return { data: result };
        }),

      approveBuilder: builder.approveBuilder
        .use(requireAdmin)
        .handler(async ({ input, errors }) => {
          const result = await runEffect(services.builder.approveBuilder(input.nearAccount));
          if (!result) {
            throw errors.NOT_FOUND({
              message: "Builder not found",
              data: { resource: "builder", resourceId: input.nearAccount },
            });
          }
          return { data: result };
        }),

      rejectBuilder: builder.rejectBuilder.use(requireAdmin).handler(async ({ input, errors }) => {
        const result = await runEffect(
          services.builder.rejectBuilder(input.nearAccount, input.reason),
        );
        if (!result) {
          throw errors.NOT_FOUND({
            message: "Builder not found",
            data: { resource: "builder", resourceId: input.nearAccount },
          });
        }
        return { data: result };
      }),
    };
  },
});
