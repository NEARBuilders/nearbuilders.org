import { createPlugin } from "every-plugin";
import { Cause, Effect, Exit, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { DatabaseLive } from "./db/layer";
import { ContextSchema } from "./lib/context";
import { BuilderService, BuilderServiceLive } from "./services/builders";

export default createPlugin({
  variables: z.object({
    nominationJoinBaseUrl: z.string().url().default("https://nearbuilders.org"),
  }),

  secrets: z.object({
    BUILDERS_DATABASE_URL: z.string().default("pglite:.bos/builders/:memory:"),
    NOMINATION_TOKEN_SECRET: z.string().min(32),
  }),

  context: ContextSchema,

  contract,

  initialize: (config, _plugins, tools) =>
    Effect.gen(function* () {
      const Database = DatabaseLive(config.secrets.BUILDERS_DATABASE_URL);
      const BuilderServices = BuilderServiceLive.pipe(Layer.provide(Database));
      const builder = yield* tools.buildService(BuilderService, BuilderServices);

      console.log("[Builders] Services Initialized");
      return {
        builder,
        nominationJoinBaseUrl: config.variables.nominationJoinBaseUrl,
        nominationTokenSecret: config.secrets.NOMINATION_TOKEN_SECRET,
      };
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

    const requireApiKey = builder.middleware(async ({ context, next }) => {
      if (!context.apiKey) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "API key required",
        });
      }
      return next({ context: { ...context, apiKey: context.apiKey } });
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
      createTelegramNomination: builder.createTelegramNomination
        .use(requireApiKey)
        .handler(async ({ input, context, errors }) => {
          const expectedIdempotencyKey = `telegram-nomination:${input.body.sourceNominationId}`;
          if (input.headers["idempotency-key"] !== expectedIdempotencyKey) {
            throw errors.BAD_REQUEST({
              message: "Invalid idempotency-key header",
              data: { invalidFields: ["idempotency-key"] },
            });
          }

          const result = await runEffect(
            services.builder.createTelegramNomination({
              nomination: input.body,
              apiKeyId: context.apiKey.id,
              joinBaseUrl: services.nominationJoinBaseUrl,
              tokenSecret: services.nominationTokenSecret,
            }),
          );

          return {
            status: result.created ? (201 as const) : (200 as const),
            headers: {
              "cache-control": "no-store",
            },
            body: {
              nominationId: result.nominationId,
              status: result.status,
              ...(result.joinUrl ? { joinUrl: result.joinUrl } : {}),
              proposalId: result.proposalId,
              proposalEntityId: result.proposalEntityId,
            },
          };
        }),

      createXNomination: builder.createXNomination
        .use(requireApiKey)
        .handler(async ({ input, context, errors }) => {
          const expectedIdempotencyKey = `x-nomination:${input.body.sourceNominationId}`;
          if (input.headers["idempotency-key"] !== expectedIdempotencyKey) {
            throw errors.BAD_REQUEST({
              message: "Invalid idempotency-key header",
              data: { invalidFields: ["idempotency-key"] },
            });
          }
          const result = await runEffect(
            services.builder.createXNomination({
              nomination: input.body,
              apiKeyId: context.apiKey.id,
              tokenSecret: services.nominationTokenSecret,
            }),
          );
          return {
            status: result.created ? (201 as const) : (200 as const),
            headers: { "cache-control": "no-store" },
            body: { nominationId: result.nominationId },
          };
        }),

      claimTelegramNomination: builder.claimTelegramNomination
        .use(requireApiKey)
        .handler(async ({ input }) => {
          return await runEffect(
            services.builder.claimTelegramNomination({
              ...input,
              joinBaseUrl: services.nominationJoinBaseUrl,
              tokenSecret: services.nominationTokenSecret,
            }),
          );
        }),

      resolveTelegramNomination: builder.resolveTelegramNomination.handler(async ({ input }) => {
        return await runEffect(services.builder.resolveTelegramNomination(input.token));
      }),

      resolveNomination: builder.resolveNomination.handler(async ({ input }) => {
        return await runEffect(
          services.builder.resolveNomination(input.token, input.recordOpen ?? true),
        );
      }),

      finalizeTelegramNomination: builder.finalizeTelegramNomination
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const nearAccount = context.near?.primaryAccountId;
          if (!nearAccount) {
            throw new ORPCError("FORBIDDEN", {
              message: "A linked NEAR account is required",
            });
          }
          return await runEffect(
            services.builder.finalizeTelegramNomination(
              input.token,
              input.proposalId,
              nearAccount,
              context.userId,
            ),
          );
        }),

      finalizeNomination: builder.finalizeNomination
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const nearAccount = context.near?.primaryAccountId;
          if (!nearAccount) {
            throw new ORPCError("FORBIDDEN", {
              message: "A linked NEAR account is required",
            });
          }
          return await runEffect(
            services.builder.finalizeNomination(
              input.token,
              input.proposalId,
              nearAccount,
              context.userId,
            ),
          );
        }),

      listXNominationQueue: builder.listXNominationQueue
        .use(requireAdmin)
        .handler(async ({ input }) => {
          return await runEffect(
            services.builder.listXNominationQueue({
              ...input,
              joinBaseUrl: services.nominationJoinBaseUrl,
              tokenSecret: services.nominationTokenSecret,
            }),
          );
        }),

      updateXNomination: builder.updateXNomination
        .use(requireAdmin)
        .handler(async ({ input, context }) => {
          return await runEffect(
            services.builder.updateXNomination({
              ...input,
              actorUserId: context.userId,
              joinBaseUrl: services.nominationJoinBaseUrl,
              tokenSecret: services.nominationTokenSecret,
            }),
          );
        }),

      getXNominationMetrics: builder.getXNominationMetrics
        .use(requireAdmin)
        .handler(async () => await runEffect(services.builder.getXNominationMetrics())),

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
