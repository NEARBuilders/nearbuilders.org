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

export function cityNodeUrl(
  key: string,
  node?: Pick<CityNode, "slug" | "parentId">,
  baseUrl: string = DEFAULT_CITY_NODE_BASE_URL,
) {
  const slug = node?.slug ?? key.split("/").pop() ?? key;
  const query = node?.parentId ? `?parentId=${encodeURIComponent(node.parentId)}` : "";
  return `${baseUrl.replace(/\/+$/, "")}/n/${encodeURIComponent(slug)}${query}`;
}

export function findCityNode(nodes: readonly CityNode[] | undefined, key: string | null) {
  if (!key) return undefined;
  return nodes?.find((node) => node.key === key);
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
  const city = comparable(location.split(",")[0] ?? "");
  if (!city) return undefined;
  return nodes.find(
    (node) => node.kind === "city" && (comparable(node.name) === city || node.slug === city),
  );
}

export function cityNodePath(node: CityNode, nodes: readonly CityNode[] | undefined) {
  const names = [node.name];
  let parentKey = node.parentKey;
  const seen = new Set([node.key]);
  while (parentKey && !seen.has(parentKey)) {
    seen.add(parentKey);
    const parent = findCityNode(nodes, parentKey);
    if (!parent) break;
    names.unshift(parent.name);
    parentKey = parent.parentKey;
  }
  return names.join(" / ");
}
