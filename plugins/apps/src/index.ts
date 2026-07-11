import { createPlugin } from "every-plugin";
import { Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
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

      const RegistryServices = RegistryService.Live.pipe(Layer.provide(RegistryConfig));

      const registryService = yield* Effect.provide(RegistryService, RegistryServices);

      console.log("[Registry] Services Initialized");
      return { registryService };
    }),

  shutdown: () => Effect.log("[Registry] Shutdown"),

  createRouter: (services, builder) => {
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
      listRegistryApps: builder.listRegistryApps.handler(async ({ input }) => {
        return await services.registryService.listRegistryApps(input);
      }),

      getRegistryAppsByAccount: builder.getRegistryAppsByAccount.handler(async ({ input }) => {
        return await services.registryService.getRegistryAppsByAccount(input.accountId);
      }),

      getRegistryApp: builder.getRegistryApp.handler(async ({ input, errors }) => {
        const result = await services.registryService.getRegistryApp(
          input.accountId,
          input.gatewayId,
        );
        if (!result) {
          throw errors.NOT_FOUND({
            message: "Published app not found",
            data: {
              resource: "published-app",
              resourceId: `${input.accountId}/${input.gatewayId}`,
            },
          });
        }

        return { data: result };
      }),

      getRegistryAppByHost: builder.getRegistryAppByHost.handler(async ({ input, errors }) => {
        const result = await services.registryService.getRegistryAppByHost(input.hostUrl);
        if (!result) {
          throw errors.NOT_FOUND({
            message: "Published app not found for host",
            data: {
              resource: "published-app-host",
              resourceId: input.hostUrl,
            },
          });
        }

        return { data: result };
      }),

      getRegistryStatus: builder.getRegistryStatus.handler(async () => {
        return services.registryService.getRegistryStatus();
      }),

      prepareRegistryMetadataWrite: builder.prepareRegistryMetadataWrite.handler(
        async ({ input }) => {
          return { data: services.registryService.prepareRegistryMetadataWrite(input) };
        },
      ),

      relayRegistryMetadataWrite: builder.relayRegistryMetadataWrite
        .use(requireNearAccount)
        .handler(async ({ input, context, errors }) => {
          try {
            const senderId = services.registryService.getRegistryRelaySender(input.payload);

            if (context.near?.primaryAccountId && senderId !== context.near?.primaryAccountId) {
              throw errors.FORBIDDEN({
                message: "Signed delegate payload does not match your linked NEAR account",
                data: { action: "relay" },
              });
            }

            const result = await services.registryService.relayRegistryMetadataWrite(input.payload);

            return { data: result };
          } catch (error) {
            if (error instanceof ORPCError) {
              throw error;
            }

            throw errors.BAD_REQUEST({
              message: error instanceof Error ? error.message : "Failed to relay metadata write",
              data: {},
            });
          }
        }),

      kvGet: builder.kvGet.handler(async ({ input, errors }) => {
        const value = await services.registryService.kvGet(input.path);
        if (value == null) {
          throw errors.NOT_FOUND({
            message: "Key not found",
            data: { resource: "kv-key", resourceId: input.path },
          });
        }
        return { data: value };
      }),

      kvList: builder.kvList.handler(async ({ input }) => {
        return services.registryService.kvList(input);
      }),

      kvPrepareWrite: builder.kvPrepareWrite.handler(async ({ input }) => {
        return { data: services.registryService.kvPrepareWrite(input.entries) };
      }),

      kvRelayWrite: builder.kvRelayWrite
        .use(requireNearAccount)
        .handler(async ({ input, context, errors }) => {
          try {
            const senderId = services.registryService.getRegistryRelaySender(input.payload);

            if (context.near?.primaryAccountId && senderId !== context.near?.primaryAccountId) {
              throw errors.FORBIDDEN({
                message: "Signed delegate payload does not match your linked NEAR account",
                data: { action: "relay" },
              });
            }

            const result = await services.registryService.kvRelayWrite(input.payload);

            return { data: result };
          } catch (error) {
            if (error instanceof ORPCError) {
              throw error;
            }

            throw errors.BAD_REQUEST({
              message: error instanceof Error ? error.message : "Failed to relay KV write",
              data: {},
            });
          }
        }),
    };
  },
});
