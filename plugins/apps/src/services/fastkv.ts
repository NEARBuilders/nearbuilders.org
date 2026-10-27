import { Context, Layer } from "effect";

export type NetworkId = "mainnet" | "testnet";

export interface FastKvEntry {
  current_account_id: string;
  predecessor_id: string;
  key: string;
  value: unknown;
  block_height?: number;
  block_timestamp?: number;
  tx_hash?: string;
  signer_id?: string;
  action_index?: number;
  receipt_id?: string;
}

interface FastKvListResponse {
  entries?: Array<FastKvEntry | null>;
  page_token?: string;
}

const FASTKV_TIMEOUT_MS = 10_000;

const DEFAULT_REGISTRY_NAMESPACE = "dev.everything.near";

export interface RegistryConfig {
  namespace: string;
  relayAccountId?: string;
  relayPrivateKey?: string;
  relayNetwork?: NetworkId;
}

export class RegistryConfigService extends Context.Tag("registry/RegistryConfigService")<
  RegistryConfigService,
  RegistryConfig
>() {
  static Live = (config: {
    namespace?: string;
    relayAccountId?: string;
    relayPrivateKey?: string;
    relayNetwork?: NetworkId;
  }) =>
    Layer.succeed(RegistryConfigService, {
      namespace:
        config.namespace ??
        process.env.REGISTRY_FASTKV_MAINNET_NAMESPACE ??
        DEFAULT_REGISTRY_NAMESPACE,
      relayAccountId: config.relayAccountId,
      relayPrivateKey: config.relayPrivateKey,
      relayNetwork: config.relayNetwork,
    });
}

export function getNetworkIdForAccount(accountId: string): NetworkId {
  return accountId.endsWith(".testnet") ? "testnet" : "mainnet";
}

export function getFastKvBaseUrlForNetwork(network: NetworkId): string {
  return network === "testnet"
    ? process.env.REGISTRY_FASTKV_TESTNET_URL || "https://kv.test.fastnear.com"
    : process.env.REGISTRY_FASTKV_MAINNET_URL || "https://kv.main.fastnear.com";
}

export function getFastKvBaseUrlForAccount(accountId: string): string {
  return getFastKvBaseUrlForNetwork(getNetworkIdForAccount(accountId));
}

export function getRegistryNamespaceForNetwork(
  _network: NetworkId,
  config: RegistryConfig,
): string {
  return config.namespace;
}

export function getRegistryNamespaceForAccount(accountId: string, config: RegistryConfig): string {
  return getRegistryNamespaceForNetwork(getNetworkIdForAccount(accountId), config);
}

export function getRegistryConfigKey(
  accountId: string,
  gatewayId: string,
  pathSegments: string[] = [],
): string {
  const suffix =
    pathSegments.length > 0
      ? `/${pathSegments.map((segment) => encodeURIComponent(segment)).join("/")}`
      : "";
  return `apps/${accountId}/${gatewayId}${suffix}/bos.config.json`;
}

export function getRegistryMetadataKey(accountId: string, gatewayId: string): string {
  return `apps/${accountId}/${gatewayId}/manifest`;
}

export function parseBosUrl(bosUrl: string): {
  accountId: string;
  gatewayId: string;
  pathSegments: string[];
} {
  const match = bosUrl.match(/^bos:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid BOS URL: ${bosUrl}`);
  }

  const [, accountId, path] = match;
  if (!accountId || !path) {
    throw new Error(`Invalid BOS URL: ${bosUrl}`);
  }
  const pathSegments = path
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
  if (pathSegments.length === 0) {
    throw new Error(`Invalid BOS URL: ${bosUrl}`);
  }
  const [gatewayId, ...pathSegmentsTail] = pathSegments;
  if (!gatewayId) {
    throw new Error(`Invalid BOS URL: ${bosUrl}`);
  }
  return { accountId, gatewayId, pathSegments: pathSegmentsTail };
}

export function buildRegistryConfigUrl(
  accountId: string,
  gatewayId: string,
  config: RegistryConfig,
): string {
  const baseUrl = getFastKvBaseUrlForAccount(accountId);
  const namespace = getRegistryNamespaceForAccount(accountId, config);
  const key = encodeURIComponent(getRegistryConfigKey(accountId, gatewayId));
  return `${baseUrl}/v0/latest/${encodeURIComponent(namespace)}/${encodeURIComponent(accountId)}/${key}`;
}

export async function fetchBosConfigFromFastKv<T>(
  bosUrl: string,
  config: RegistryConfig,
): Promise<T> {
  const { accountId, gatewayId, pathSegments } = parseBosUrl(bosUrl);
  const value = await readLatestValue({
    baseUrl: getFastKvBaseUrlForAccount(accountId),
    currentAccountId: getRegistryNamespaceForAccount(accountId, config),
    predecessorId: accountId,
    key: getRegistryConfigKey(accountId, gatewayId, pathSegments),
  });

  if (!value) {
    throw new Error(`No config found for ${bosUrl}`);
  }

  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }

  if (typeof value !== "object") {
    throw new Error(`Invalid config value for ${bosUrl}`);
  }

  return value as T;
}

export async function readLatestValue(options: {
  baseUrl: string;
  currentAccountId: string;
  predecessorId?: string;
  key: string;
}): Promise<unknown | null> {
  const result = await listLatestValues({
    ...options,
    limit: 1,
  });
  const entry = result.entries.find(Boolean);
  return entry?.value ?? null;
}

export async function listLatestValues(options: {
  baseUrl: string;
  currentAccountId: string;
  predecessorId?: string;
  key?: string;
  keyPrefix?: string;
  pageToken?: string;
  limit?: number;
  includeMetadata?: boolean;
}): Promise<{ entries: FastKvEntry[]; pageToken: string | null }> {
  const path = options.predecessorId
    ? `/v0/latest/${encodeURIComponent(options.currentAccountId)}/${encodeURIComponent(options.predecessorId)}`
    : `/v0/latest/${encodeURIComponent(options.currentAccountId)}`;
  const body: Record<string, unknown> = {
    limit: options.limit ?? 50,
  };

  if (options.key) {
    body.key = options.key;
  }

  if (options.keyPrefix) {
    body.key_prefix = options.keyPrefix;
  }

  if (options.pageToken) {
    body.page_token = options.pageToken;
  }

  if (options.includeMetadata) {
    body.include_metadata = true;
  }

  const payload = await fetchJson<FastKvListResponse>(`${options.baseUrl}${path}`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    entries: (payload?.entries ?? []).filter((entry): entry is FastKvEntry => Boolean(entry)),
    pageToken: payload?.page_token ?? null,
  };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FASTKV_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}
