import { ORPCError } from "@orpc/server";
import { Effect, Layer } from "effect";
import { createPlugin } from "every-plugin";
import { z } from "zod";
import { contract } from "./contract";
import { DatabaseLive } from "./db/layer";
import { type Context, ContextSchema } from "./lib/context";
import type { PluginsClient } from "./lib/plugins-client.gen";
import {
  CreditService,
  CreditServiceLive,
  clientIp,
  creditEligibility,
  parseCreditsConfig,
} from "./services/credits";

function attempt<A>(run: () => Promise<A>) {
  return Effect.tryPromise({
    try: run,
    catch: (error) =>
      error instanceof ORPCError
        ? error
        : new ORPCError("INTERNAL_SERVER_ERROR", {
            message: error instanceof Error ? error.message : String(error),
          }),
  });
}

export default createPlugin.withPlugins<PluginsClient>()({
  variables: z.object({}),

  secrets: z.object({
    CREDITS_DATABASE_URL: z.string().default("pglite:.bos/credits/:memory:"),
    CREDITS_ENABLED: z.string().default(""),
    CREDITS_AMOUNT_USD: z.string().default(""),
    CREDITS_CLAIMS_CLOSE_AT: z.string().default(""),
    CREDITS_KEY_EXPIRES_AT: z.string().default(""),
    NEARAI_CREDITS_REFRESH_TOKEN: z.string().default(""),
    NEARAI_CREDITS_USER_AGENT: z.string().default(""),
    NEARAI_CREDITS_WORKSPACE_ID: z.string().default(""),
  }),

  context: ContextSchema,

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const creditsConfig = parseCreditsConfig(config.secrets);
      if (creditsConfig.enabled && creditsConfig.problems.length > 0) {
        yield* Effect.logError(
          `[Credits] Credit claims are enabled but misconfigured: ${creditsConfig.problems.join("; ")}`,
        );
      } else {
        yield* Effect.logInfo(
          `[Credits] Credit claims: ${creditsConfig.enabled ? "enabled" : "disabled"}`,
        );
      }
      return CreditServiceLive(creditsConfig).pipe(Layer.provide(DatabaseLive(config)));
    }),

  createRouter: (builder, plugins) => {
    const requireAuth = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
      }
      return next({ context: { ...context, userId: context.userId, user: context.user } });
    });

    const requireAdmin = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
      }
      if (context.user.role !== "admin") {
        throw new ORPCError("FORBIDDEN", { message: "Admin access required" });
      }
      return next({ context: { ...context, userId: context.userId, user: context.user } });
    });

    const resolveEligibility = async (context: Context) => {
      const nearAccountId = context.near?.primaryAccountId?.toLowerCase() ?? null;
      const profile = nearAccountId
        ? await plugins.builders.client(context).getMyBuilderProfile({})
        : null;
      return {
        nearAccountId,
        eligibility: creditEligibility(nearAccountId, profile?.data ?? null),
      };
    };

    return {
      getCreditStatus: builder.getCreditStatus.use(requireAuth).effect(function* ({ context }) {
        const credits = yield* CreditService;
        const { nearAccountId, eligibility } = yield* attempt(() => resolveEligibility(context));
        return yield* attempt(() => credits.getStatus(nearAccountId, eligibility));
      }),

      claimCredits: builder.claimCredits.use(requireAuth).effect(function* ({ context }) {
        const credits = yield* CreditService;
        const { nearAccountId, eligibility } = yield* attempt(() => resolveEligibility(context));
        if (!nearAccountId) {
          return yield* Effect.fail(
            new ORPCError("FORBIDDEN", { message: "Link a NEAR account to claim API credits" }),
          );
        }
        return yield* attempt(() =>
          credits.claim({
            nearAccountId,
            userId: context.userId,
            ip: clientIp(context.reqHeaders),
            eligibility,
          }),
        );
      }),

      listCreditClaims: builder.listCreditClaims.use(requireAdmin).effect(function* ({ input }) {
        const credits = yield* CreditService;
        return yield* attempt(() =>
          credits.listClaims({ limit: input.limit, offset: Number(input.cursor ?? 0) }),
        );
      }),

      revokeCreditClaim: builder.revokeCreditClaim.use(requireAdmin).effect(function* ({ input }) {
        const credits = yield* CreditService;
        return yield* attempt(() => credits.revokeClaim(input.id));
      }),
    };
  },
});
