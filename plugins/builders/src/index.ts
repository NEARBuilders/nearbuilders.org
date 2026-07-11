import { createPlugin } from "every-plugin";
import { Cause, Effect, Exit, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { DatabaseLive } from "./db/layer";
import { ContextSchema } from "./lib/context";
import { BuilderService, BuilderServiceLive } from "./services/builders";

export default createPlugin({
  variables: z.object({}),

  secrets: z.object({
    BUILDERS_DATABASE_URL: z.string().default("pglite:.bos/builders/:memory:"),
  }),

  context: ContextSchema,

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
      return next({ context: { ...context, userId: context.userId!, user: context.user! } });
    });

    const requireAdmin = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
      }
      if (context.user.role !== "admin") {
        throw new ORPCError("FORBIDDEN", { message: "Admin access required" });
      }
      return next({ context: { ...context, userId: context.userId!, user: context.user! } });
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
            services.builder.getBuilderByUserId(
              context.userId,
              context.near?.primaryAccountId ?? undefined,
            ),
          );
          return { data: result };
        }),

      createBuilder: builder.createBuilder.use(requireAdmin).handler(async ({ input }) => {
        const result = await runEffect(services.builder.createBuilder(input));
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
              context.near?.primaryAccountId ?? undefined,
              context.user.role ?? undefined,
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

      deleteBuilder: builder.deleteBuilder.use(requireAdmin).handler(async ({ input }) => {
        return await runEffect(services.builder.deleteBuilder(input.nearAccount));
      }),
    };
  },
});
