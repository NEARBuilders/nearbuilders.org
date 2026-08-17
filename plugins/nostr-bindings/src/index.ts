import { createPlugin } from "every-plugin";
import { Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { contract } from "./contract.js";
import { ContextSchema } from "./lib/context.js";
import { BindingService } from "./services/binding.js";

export default createPlugin({
  variables: z.object({
    KV_API_URL: z.string().default("https://kv.main.fastnear.com"),
    BINDING_CONTRACT: z.string().default("contextual.near"),
    STANDARD_RELAYS: z
      .string()
      .default("wss://nos.lol,wss://relay.damus.io,wss://relay.primal.net"),
    CHALLENGE_EXPIRY_SECONDS: z.coerce.number().default(300),
  }),

  secrets: z.object({}),

  context: ContextSchema,

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const service = new BindingService({
        kvApiUrl: config.variables.KV_API_URL,
        bindingContract: config.variables.BINDING_CONTRACT,
        standardRelays: config.variables.STANDARD_RELAYS.split(","),
        challengeExpirySeconds: config.variables.CHALLENGE_EXPIRY_SECONDS,
      });

      console.log("[NostrBindings] Service Initialized");
      return { service };
    }),

  shutdown: () => Effect.log("[NostrBindings] Shutdown"),

  createRouter: (services, builder) => {
    const requireAuth = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "Authentication required",
        });
      }
      return next({
        context: { ...context, userId: context.userId!, user: context.user! },
      });
    });

    return {
      getBinding: builder.getBinding.handler(async ({ input }) => {
        return await services.service.getBindingOutput(input.nearAccountId);
      }),

      getIdentity: builder.getIdentity.handler(async ({ input }) => {
        return await services.service.getIdentity(
          input.nearAccountId,
          input.enrichProfile,
        );
      }),

      createChallenge: builder.createChallenge
        .use(requireAuth)
        .handler(async ({ context }) => {
          const nearAccountId =
            context.near?.primaryAccountId ?? context.userId;
          if (!nearAccountId) {
            throw new ORPCError("UNAUTHORIZED", {
              message: "NEAR account required for binding",
            });
          }
          return services.service.createChallenge(nearAccountId);
        }),

      verifyBinding: builder.verifyBinding
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          try {
            const nearAccountId =
              context.near?.primaryAccountId ?? context.userId;
            if (!nearAccountId) {
              throw new ORPCError("UNAUTHORIZED", {
                message: "NEAR account required",
              });
            }

            const { verifyEvent } = await import("nostr-tools/pure");
            if (!verifyEvent(input.event as any)) {
              throw new ORPCError("BAD_REQUEST", {
                message: "Invalid Nostr event signature",
              });
            }

            const result = services.service.verifyChallenge(
              input.event,
              nearAccountId,
            );

            return {
              valid: result.valid,
              nearAccountId,
              nostrPubkey: result.nostrPubkey,
              proof: result.proof,
            };
          } catch (error) {
            if (error instanceof ORPCError) throw error;
            throw errors.BAD_REQUEST({
              message:
                error instanceof Error ? error.message : "Verification failed",
              data: {},
            });
          }
        }),

      prepareBindingWrite: builder.prepareBindingWrite
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          try {
            const nearAccountId =
              context.near?.primaryAccountId ?? context.userId;
            if (!nearAccountId) {
              throw new ORPCError("UNAUTHORIZED", {
                message: "NEAR account required",
              });
            }

            return services.service.prepareBindingWrite({
              nostrPubkey: input.nostrPubkey,
              relay: input.relay,
              proof: input.proof,
              nearAccountId,
            });
          } catch (error) {
            if (error instanceof ORPCError) throw error;
            throw errors.BAD_REQUEST({
              message:
                error instanceof Error ? error.message : "Prepare failed",
              data: {},
            });
          }
        }),
    };
  },
});
