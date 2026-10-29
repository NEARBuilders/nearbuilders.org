import { ORPCError } from "@orpc/server";
import { Effect, Layer } from "effect";
import { createPlugin } from "every-plugin";
import { z } from "zod";
import { contract } from "./contract";
import { ContextSchema } from "./lib/context";
import { RegistryConfigService } from "./services/fastkv";
import { RegistryService } from "./services/registry";

export default createPlugin({
  variables: z.object({
    registryNamespace: z.string().optional(),
  }),

  secrets: z.object({
    REGISTRY_RELAY_ACCOUNT_ID: z.string().optional(),
    REGISTRY_RELAY_PRIVATE_KEY: z.string().optional(),
    REGISTRY_RELAY_NETWORK: z.enum(["mainnet", "testnet"]).optional(),
  }),

  context: ContextSchema,

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const RegistryConfig = RegistryConfigService.Live({
        namespace: config.variables.registryNamespace,
        relayAccountId: config.secrets.REGISTRY_RELAY_ACCOUNT_ID,
        relayPrivateKey: config.secrets.REGISTRY_RELAY_PRIVATE_KEY,
        relayNetwork: config.secrets.REGISTRY_RELAY_NETWORK,
      });

      console.log("[Registry] Services Initialized");
      return Layer.mergeAll(
        RegistryService.Live.pipe(Layer.provide(RegistryConfig)),
        Layer.effectDiscard(Effect.addFinalizer(() => Effect.log("[Registry] Shutdown"))),
      );
    }),

  createRouter: (builder) => {
    const requireNearAccount = builder.middleware(async ({ context, next }) => {
      if (!context.near?.primaryAccountId) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "NEAR wallet required",
          data: {
            authType: "near",
            hint: "Link a NEAR wallet to perform this action",
          },
        });
      }

      return next({ context });
    });

    return {
      listRegistryApps: builder.listRegistryApps.effect(function* ({ input }) {
        const registry = yield* RegistryService;
        return yield* Effect.promise(() => registry.listRegistryApps(input));
      }),

      getRegistryAppsByAccount: builder.getRegistryAppsByAccount.effect(function* ({ input }) {
        const registry = yield* RegistryService;
        return yield* Effect.promise(() => registry.getRegistryAppsByAccount(input.accountId));
      }),

      getRegistryApp: builder.getRegistryApp.effect(function* ({ input, errors }) {
        const registry = yield* RegistryService;
        const result = yield* Effect.promise(() =>
          registry.getRegistryApp(input.accountId, input.gatewayId),
        );
        if (!result) {
          return yield* Effect.fail(
            errors.NOT_FOUND({
              message: "Published app not found",
              data: {
                resource: "published-app",
                resourceId: `${input.accountId}/${input.gatewayId}`,
              },
            }),
          );
        }

        return { data: result };
      }),

      getRegistryAppByHost: builder.getRegistryAppByHost.effect(function* ({ input, errors }) {
        const registry = yield* RegistryService;
        const result = yield* Effect.promise(() => registry.getRegistryAppByHost(input.hostUrl));
        if (!result) {
          return yield* Effect.fail(
            errors.NOT_FOUND({
              message: "Published app not found for host",
              data: {
                resource: "published-app-host",
                resourceId: input.hostUrl,
              },
            }),
          );
        }

        return { data: result };
      }),

      getRegistryStatus: builder.getRegistryStatus.effect(function* () {
        const registry = yield* RegistryService;
        return yield* Effect.promise(() => registry.getRegistryStatus());
      }),

      prepareRegistryMetadataWrite: builder.prepareRegistryMetadataWrite.effect(function* ({
        input,
      }) {
        const registry = yield* RegistryService;
        return { data: registry.prepareRegistryMetadataWrite(input) };
      }),

      relayRegistryMetadataWrite: builder.relayRegistryMetadataWrite
        .use(requireNearAccount)
        .effect(function* ({ input, context, errors }) {
          const registry = yield* RegistryService;
          return yield* Effect.tryPromise({
            try: async () => {
              const senderId = registry.getRegistryRelaySender(input.payload);

              if (context.near?.primaryAccountId && senderId !== context.near?.primaryAccountId) {
                throw errors.FORBIDDEN({
                  message: "Signed delegate payload does not match your linked NEAR account",
                  data: { action: "relay" },
                });
              }

              const result = await registry.relayRegistryMetadataWrite(input.payload);

              return { data: result };
            },
            catch: (error) => {
              if (error instanceof ORPCError) {
                return error;
              }

              return errors.BAD_REQUEST({
                message: error instanceof Error ? error.message : "Failed to relay metadata write",
                data: {},
              });
            },
          });
        }),

      kvGet: builder.kvGet.effect(function* ({ input, errors }) {
        const registry = yield* RegistryService;
        const value = yield* Effect.promise(() => registry.kvGet(input.path));
        if (value == null) {
          return yield* Effect.fail(
            errors.NOT_FOUND({
              message: "Key not found",
              data: { resource: "kv-key", resourceId: input.path },
            }),
          );
        }
        return { data: value };
      }),

      kvList: builder.kvList.effect(function* ({ input }) {
        const registry = yield* RegistryService;
        return yield* Effect.promise(() => registry.kvList(input));
      }),

      kvPrepareWrite: builder.kvPrepareWrite.effect(function* ({ input }) {
        const registry = yield* RegistryService;
        return { data: registry.kvPrepareWrite(input.entries) };
      }),

      kvRelayWrite: builder.kvRelayWrite.use(requireNearAccount).effect(function* ({
        input,
        context,
        errors,
      }) {
        const registry = yield* RegistryService;
        return yield* Effect.tryPromise({
          try: async () => {
            const senderId = registry.getRegistryRelaySender(input.payload);

            if (context.near?.primaryAccountId && senderId !== context.near?.primaryAccountId) {
              throw errors.FORBIDDEN({
                message: "Signed delegate payload does not match your linked NEAR account",
                data: { action: "relay" },
              });
            }

            const result = await registry.kvRelayWrite(input.payload);

            return { data: result };
          },
          catch: (error) => {
            if (error instanceof ORPCError) {
              return error;
            }

            return errors.BAD_REQUEST({
              message: error instanceof Error ? error.message : "Failed to relay KV write",
              data: {},
            });
          },
        });
      }),
    };
  },
});
