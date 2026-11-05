import { ORPCError } from "@orpc/server";
import { Context, Effect, Layer } from "effect";
import { buildScoped, createPlugin } from "every-plugin";
import { z } from "zod";
import { contract } from "./contract";
import { DatabaseLive } from "./db/layer";
import { ContextSchema } from "./lib/context";
import { BuilderService, BuilderServiceLive } from "./services/builders";

class NominationConfig extends Context.Service<
  NominationConfig,
  { joinBaseUrl: string; tokenSecret: string }
>()("builders/NominationConfig") {}

const toORPCError = (defect: unknown) =>
  defect instanceof ORPCError
    ? defect
    : new ORPCError("INTERNAL_SERVER_ERROR", {
        message: defect instanceof Error ? defect.message : String(defect),
      });

const runService = <A>(effect: Effect.Effect<A, ORPCError<string, unknown>>) =>
  effect.pipe(Effect.catchDefect((defect) => Effect.fail(toORPCError(defect))));

/** The caller's linked NEAR accounts, for finding their own records across all of them (#365). */
function linkedAccountIds(context: {
  near?: { linkedAccounts?: Array<{ accountId?: string | null }> | null } | null;
}): string[] {
  return (context.near?.linkedAccounts ?? [])
    .map((account) => account.accountId)
    .filter((id): id is string => Boolean(id));
}

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

  initialize: (config) =>
    Effect.gen(function* () {
      const builder = yield* buildScoped(
        BuilderService,
        BuilderServiceLive.pipe(Layer.provide(DatabaseLive(config.secrets.BUILDERS_DATABASE_URL))),
      );
      yield* builder.backfillNormalizedTags();
      yield* Effect.addFinalizer(() => Effect.log("[Builders] Shutdown"));

      console.log("[Builders] Services Initialized");
      return Layer.mergeAll(
        Layer.succeed(BuilderService, builder),
        Layer.succeed(NominationConfig, {
          joinBaseUrl: config.variables.nominationJoinBaseUrl,
          tokenSecret: config.secrets.NOMINATION_TOKEN_SECRET,
        }),
      );
    }),

  createRouter: (builder) => {
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

    // Nomination bots act for other people, so their key must belong to an admin
    // or carry the admin-granted nominations:write permission.
    const requireNominationKey = builder.middleware(async ({ context, next }) => {
      if (!context.apiKey) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "API key required",
        });
      }
      const canNominate =
        context.user?.role === "admin" ||
        (context.apiKey.permissions?.nominations ?? []).includes("write");
      if (!canNominate) {
        throw new ORPCError("FORBIDDEN", {
          message: "This API key can't submit nominations",
        });
      }
      return next({ context: { ...context, apiKey: context.apiKey } });
    });

    return {
      createTelegramNomination: builder.createTelegramNomination
        .use(requireNominationKey)
        .effect(function* ({ input, context, errors }) {
          const builders = yield* BuilderService;
          const nominationConfig = yield* NominationConfig;
          const expectedIdempotencyKey = `telegram-nomination:${input.body.sourceNominationId}`;
          if (input.headers["idempotency-key"] !== expectedIdempotencyKey) {
            throw errors.BAD_REQUEST({
              message: "Invalid idempotency-key header",
              data: { invalidFields: ["idempotency-key"] },
            });
          }

          const result = yield* runService(
            builders.createTelegramNomination({
              nomination: input.body,
              apiKeyId: context.apiKey.id,
              joinBaseUrl: nominationConfig.joinBaseUrl,
              tokenSecret: nominationConfig.tokenSecret,
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

      createXNomination: builder.createXNomination.use(requireNominationKey).effect(function* ({
        input,
        context,
        errors,
      }) {
        const builders = yield* BuilderService;
        const nominationConfig = yield* NominationConfig;
        const expectedIdempotencyKey = `x-nomination:${input.body.sourceNominationId}`;
        if (input.headers["idempotency-key"] !== expectedIdempotencyKey) {
          throw errors.BAD_REQUEST({
            message: "Invalid idempotency-key header",
            data: { invalidFields: ["idempotency-key"] },
          });
        }
        const result = yield* runService(
          builders.createXNomination({
            nomination: input.body,
            apiKeyId: context.apiKey.id,
            tokenSecret: nominationConfig.tokenSecret,
          }),
        );
        return {
          status: result.created ? (201 as const) : (200 as const),
          headers: { "cache-control": "no-store" },
          body: { nominationId: result.nominationId },
        };
      }),

      claimTelegramNomination: builder.claimTelegramNomination
        .use(requireNominationKey)
        .effect(function* ({ input }) {
          const builders = yield* BuilderService;
          const nominationConfig = yield* NominationConfig;
          return yield* runService(
            builders.claimTelegramNomination({
              ...input,
              joinBaseUrl: nominationConfig.joinBaseUrl,
              tokenSecret: nominationConfig.tokenSecret,
            }),
          );
        }),

      resolveTelegramNomination: builder.resolveTelegramNomination.effect(function* ({ input }) {
        const builders = yield* BuilderService;
        return yield* runService(builders.resolveTelegramNomination(input.token));
      }),

      resolveNomination: builder.resolveNomination.effect(function* ({ input }) {
        const builders = yield* BuilderService;
        return yield* runService(builders.resolveNomination(input.token, input.recordOpen ?? true));
      }),

      finalizeTelegramNomination: builder.finalizeTelegramNomination
        .use(requireAuth)
        .effect(function* ({ input, context }) {
          const builders = yield* BuilderService;
          const nearAccount = context.near?.primaryAccountId;
          if (!nearAccount) {
            throw new ORPCError("FORBIDDEN", {
              message: "A linked NEAR account is required",
            });
          }
          return yield* runService(
            builders.finalizeTelegramNomination(
              input.token,
              input.proposalId,
              nearAccount,
              context.userId,
            ),
          );
        }),

      finalizeNomination: builder.finalizeNomination.use(requireAuth).effect(function* ({
        input,
        context,
      }) {
        const builders = yield* BuilderService;
        const nearAccount = context.near?.primaryAccountId;
        if (!nearAccount) {
          throw new ORPCError("FORBIDDEN", {
            message: "A linked NEAR account is required",
          });
        }
        return yield* runService(
          builders.finalizeNomination(input.token, input.proposalId, nearAccount, context.userId),
        );
      }),

      listXNominationQueue: builder.listXNominationQueue.use(requireAdmin).effect(function* ({
        input,
      }) {
        const builders = yield* BuilderService;
        const nominationConfig = yield* NominationConfig;
        return yield* runService(
          builders.listXNominationQueue({
            ...input,
            joinBaseUrl: nominationConfig.joinBaseUrl,
            tokenSecret: nominationConfig.tokenSecret,
          }),
        );
      }),

      updateXNomination: builder.updateXNomination.use(requireAdmin).effect(function* ({
        input,
        context,
      }) {
        const builders = yield* BuilderService;
        const nominationConfig = yield* NominationConfig;
        return yield* runService(
          builders.updateXNomination({
            ...input,
            actorUserId: context.userId,
            joinBaseUrl: nominationConfig.joinBaseUrl,
            tokenSecret: nominationConfig.tokenSecret,
          }),
        );
      }),

      getXNominationMetrics: builder.getXNominationMetrics.use(requireAdmin).effect(function* () {
        const builders = yield* BuilderService;
        return yield* runService(builders.getXNominationMetrics());
      }),

      listBuilders: builder.listBuilders.effect(function* ({ input }) {
        const builders = yield* BuilderService;
        return yield* runService(builders.listBuilders(input));
      }),

      getBuilder: builder.getBuilder.effect(function* ({ input, context, errors }) {
        const builders = yield* BuilderService;
        const result = yield* runService(
          builders.getBuilder(input.nearAccount, {
            userId: context.userId,
            walletAddress: context.near?.primaryAccountId ?? undefined,
            role: context.user?.role ?? undefined,
          }),
        );
        if (!result) {
          throw errors.NOT_FOUND({
            message: "Builder not found",
            data: { resource: "builder", resourceId: input.nearAccount },
          });
        }
        return { data: result };
      }),

      getBuildersByUserIds: builder.getBuildersByUserIds.effect(function* ({ input }) {
        const builders = yield* BuilderService;
        const result = yield* runService(builders.getBuildersByUserIds(input.userIds));
        return { data: result };
      }),

      getMyBuilderProfile: builder.getMyBuilderProfile.use(requireAuth).effect(function* ({
        context,
      }) {
        const builders = yield* BuilderService;
        const result = yield* runService(
          builders.getBuilderByUserId(
            context.userId,
            context.near?.primaryAccountId ?? undefined,
            linkedAccountIds(context),
          ),
        );
        return { data: result };
      }),

      withdrawMyBuilderProfile: builder.withdrawMyBuilderProfile
        .use(requireAuth)
        .effect(function* ({ context }) {
          const builders = yield* BuilderService;
          const result = yield* runService(
            builders.setBuilderWithdrawn(
              {
                userId: context.userId,
                walletAddress: context.near?.primaryAccountId ?? undefined,
                linkedAccounts: linkedAccountIds(context),
              },
              true,
            ),
          );
          return { data: result };
        }),

      restoreMyBuilderProfile: builder.restoreMyBuilderProfile.use(requireAuth).effect(function* ({
        context,
      }) {
        const builders = yield* BuilderService;
        const result = yield* runService(
          builders.setBuilderWithdrawn(
            {
              userId: context.userId,
              walletAddress: context.near?.primaryAccountId ?? undefined,
              linkedAccounts: linkedAccountIds(context),
            },
            false,
          ),
        );
        return { data: result };
      }),

      createBuilder: builder.createBuilder.use(requireAdmin).effect(function* ({ input }) {
        const builders = yield* BuilderService;
        const result = yield* runService(builders.createBuilder(input));
        return { data: result };
      }),

      updateBuilderProfile: builder.updateBuilderProfile.use(requireAuth).effect(function* ({
        input,
        context,
        errors,
      }) {
        const builders = yield* BuilderService;
        const result = yield* runService(
          builders.updateBuilderProfile(
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

      deleteBuilder: builder.deleteBuilder.use(requireAdmin).effect(function* ({ input }) {
        const builders = yield* BuilderService;
        return yield* runService(builders.deleteBuilder(input.nearAccount));
      }),
    };
  },
});
