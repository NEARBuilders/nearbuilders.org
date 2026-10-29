import "@orpc/openapi/extensions/route";
import { oc } from "@orpc/contract";
import { BAD_REQUEST, FORBIDDEN, NOT_FOUND, UNAUTHORIZED } from "every-plugin/errors";
import { z } from "zod";

const registryMetadataSchema = z.object({
  claimedBy: z.string().nullable(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  repoUrl: z.string().nullable(),
  homepageUrl: z.string().nullable(),
  imageUrl: z.string().nullable(),
  updatedAt: z.iso.datetime().nullable(),
});

const registryMetadataDraftInputSchema = z.object({
  accountId: z.string(),
  gatewayId: z.string(),
  claimedBy: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  repoUrl: z.string().url().optional(),
  homepageUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
});

const registryAppSummarySchema = z.object({
  accountId: z.string(),
  gatewayId: z.string(),
  canonicalKey: z.string(),
  canonicalConfigUrl: z.string().url(),
  startCommand: z.string(),
  domain: z.string().nullable(),
  openUrl: z.string().url().nullable(),
  hostUrl: z.string().url().nullable(),
  uiUrl: z.string().url().nullable(),
  uiSsrUrl: z.string().url().nullable(),
  apiUrl: z.string().url().nullable(),
  extends: z.string().nullable(),
  parent: z.string().nullable(),
  root: z.string().nullable(),
  depth: z.number().int().nonnegative(),
  status: z.enum(["ready", "invalid"]),
  metadata: registryMetadataSchema.nullable(),
});

const registryAppDetailSchema = registryAppSummarySchema.extend({
  metadata: registryMetadataSchema.nullable(),
  metadataKey: z.string(),
  metadataContractId: z.string(),
  metadataFastKvUrl: z.string().url(),
  extendsChain: z.array(z.string()),
  resolvedConfig: z.record(z.string(), z.unknown()),
});

const registryMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
  nextCursor: z.string().nullable(),
});

const preparedRegistryMetadataWriteSchema = z.object({
  contractId: z.string(),
  methodName: z.literal("__fastdata_kv"),
  key: z.string(),
  manifest: registryMetadataSchema,
  args: z.record(z.string(), z.string()),
  gas: z.string(),
  attachedDeposit: z.string(),
});

const registryRelayResultSchema = z.object({
  transactionHash: z.string().nullable(),
  relayerAccountId: z.string(),
  senderId: z.string(),
});

const kvEntrySchema = z.object({
  key: z.string(),
  value: z.unknown(),
  blockHeight: z.number().optional(),
  blockTimestamp: z.number().optional(),
  txHash: z.string().optional(),
  signerId: z.string().optional(),
});

const preparedKvWriteSchema = z.object({
  contractId: z.string(),
  methodName: z.literal("__fastdata_kv"),
  args: z.record(z.string(), z.string()),
  gas: z.string(),
  attachedDeposit: z.string(),
});

export const contract = oc.router({
  listRegistryApps: oc
    .route({ method: "GET", path: "/v1/registry/apps" })
    .input(
      z.object({
        q: z.string().optional(),
        parent: z.string().optional(),
        root: z.string().optional(),
        ancestor: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(registryAppSummarySchema),
        meta: registryMetaSchema,
      }),
    )
    .errors({ BAD_REQUEST }),

  getRegistryAppsByAccount: oc
    .route({ method: "GET", path: "/v1/registry/apps/account/{accountId}" })
    .input(z.object({ accountId: z.string() }))
    .output(
      z.object({
        data: z.array(registryAppSummarySchema),
        meta: registryMetaSchema,
      }),
    )
    .errors({ NOT_FOUND }),

  getRegistryApp: oc
    .route({ method: "GET", path: "/v1/registry/apps/{accountId}/{gatewayId}" })
    .input(
      z.object({
        accountId: z.string(),
        gatewayId: z.string(),
      }),
    )
    .output(z.object({ data: registryAppDetailSchema }))
    .errors({ NOT_FOUND }),

  getRegistryAppByHost: oc
    .route({ method: "GET", path: "/v1/registry/apps/by-host" })
    .input(
      z.object({
        hostUrl: z.string().url(),
      }),
    )
    .output(z.object({ data: registryAppDetailSchema }))
    .errors({ NOT_FOUND }),

  getRegistryStatus: oc.route({ method: "GET", path: "/v1/registry/status" }).output(
    z.object({
      discoveredApps: z.number().int().nonnegative(),
      metadataContractId: z.string(),
      metadataFastKvUrl: z.string().url(),
      relayEnabled: z.boolean(),
      relayAccountId: z.string().nullable(),
      timestamp: z.iso.datetime(),
    }),
  ),

  prepareRegistryMetadataWrite: oc
    .route({ method: "POST", path: "/v1/registry/apps/{accountId}/{gatewayId}/metadata/prepare" })
    .input(registryMetadataDraftInputSchema)
    .output(z.object({ data: preparedRegistryMetadataWriteSchema }))
    .errors({ BAD_REQUEST }),

  relayRegistryMetadataWrite: oc
    .route({ method: "POST", path: "/v1/registry/metadata/relay" })
    .input(z.object({ payload: z.string() }))
    .output(z.object({ data: registryRelayResultSchema }))
    .errors({ BAD_REQUEST, FORBIDDEN, UNAUTHORIZED }),

  kvGet: oc
    .route({ method: "GET", path: "/v1/kv" })
    .input(z.object({ path: z.string() }))
    .output(z.object({ data: z.unknown().nullable() }))
    .errors({ NOT_FOUND }),

  kvList: oc
    .route({ method: "GET", path: "/v1/kv/list" })
    .input(
      z.object({
        prefix: z.string(),
        limit: z.number().int().min(1).max(200).optional(),
        cursor: z.string().optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(kvEntrySchema),
        meta: registryMetaSchema,
      }),
    )
    .errors({ BAD_REQUEST }),

  kvPrepareWrite: oc
    .route({ method: "POST", path: "/v1/kv/prepare" })
    .input(
      z.object({
        entries: z.array(
          z.object({
            path: z.string(),
            value: z.unknown(),
          }),
        ),
      }),
    )
    .output(z.object({ data: preparedKvWriteSchema }))
    .errors({ BAD_REQUEST }),

  kvRelayWrite: oc
    .route({ method: "POST", path: "/v1/kv/relay" })
    .input(z.object({ payload: z.string() }))
    .output(z.object({ data: registryRelayResultSchema }))
    .errors({ BAD_REQUEST, FORBIDDEN, UNAUTHORIZED }),
});

export type ContractType = typeof contract;
