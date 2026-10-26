import type { ApiClient } from "@/app";

type CityNodesApiClient = Pick<ApiClient, "listCityNodes">;

export type CityNodeList = Awaited<ReturnType<ApiClient["listCityNodes"]>>;
export type CityNode = CityNodeList["data"][number];

export const DEFAULT_CITY_NODE_BASE_URL = "https://citynode.app";

export const cityNodeKeys = {
  all: ["city-nodes"] as const,
};

export function cityNodesQueryOptions(apiClient: CityNodesApiClient) {
  return {
    queryKey: cityNodeKeys.all,
    queryFn: () => apiClient.listCityNodes(),
    staleTime: 10 * 60_000,
    retry: 1,
  };
}

export function cityNodeUrl(slug: string, baseUrl: string = DEFAULT_CITY_NODE_BASE_URL) {
  return `${baseUrl.replace(/\/+$/, "")}/n/${encodeURIComponent(slug)}`;
}

export function findCityNode(nodes: readonly CityNode[] | undefined, slug: string | null) {
  if (!slug) return undefined;
  return nodes?.find((node) => node.slug === slug);
}

function comparable(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function suggestCityNode(
  location: string | null | undefined,
  nodes: readonly CityNode[] | undefined,
): CityNode | undefined {
  if (!location?.trim() || !nodes?.length) return undefined;
  const parts = location
    .split(",")
    .map((part) => comparable(part))
    .filter(Boolean);
  for (const part of parts) {
    const match = nodes.find((node) => comparable(node.name) === part || node.slug === part);
    if (match) return match;
  }
  return undefined;
}

export function cityNodePath(node: CityNode, nodes: readonly CityNode[] | undefined) {
  const names = [node.name];
  let parentSlug = node.parentSlug;
  const seen = new Set([node.slug]);
  while (parentSlug && !seen.has(parentSlug)) {
    seen.add(parentSlug);
    const parent = findCityNode(nodes, parentSlug);
    if (!parent) break;
    names.unshift(parent.name);
    parentSlug = parent.parentSlug;
  }
  return names.join(" / ");
}
