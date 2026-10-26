export type CityNodeKind = "country" | "state" | "city" | string;

export type CityNode = {
  key: string;
  slug: string;
  name: string;
  kind: CityNodeKind;
  parentKey: string | null;
  parentId: string | null;
  depth: number;
};

export type CityNodeList = {
  data: CityNode[];
  meta: { baseUrl: string; available: boolean; fetchedAt: string | null };
};

type RawNode = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  parentId: string | null;
};

const CACHE_TTL_MS = 10 * 60_000;
const RETRY_AFTER_FAILURE_MS = 60_000;
const FETCH_TIMEOUT_MS = 5_000;

function readRawNodes(body: unknown): RawNode[] {
  if (!Array.isArray(body)) return [];
  const nodes: RawNode[] = [];
  for (const entry of body) {
    const node =
      entry && typeof entry === "object" && "node" in entry
        ? (entry as { node: unknown }).node
        : entry;
    if (!node || typeof node !== "object") continue;
    const { id, slug, name, kind, parentId } = node as Record<string, unknown>;
    if (typeof id !== "string" || typeof slug !== "string" || typeof name !== "string") continue;
    nodes.push({
      id,
      slug: slug.toLowerCase(),
      name,
      kind: typeof kind === "string" ? kind : "city",
      parentId: typeof parentId === "string" ? parentId : null,
    });
  }
  return nodes;
}

export function buildCityNodeTree(raw: RawNode[]): CityNode[] {
  const byId = new Map(raw.map((node) => [node.id, node]));
  const children = new Map<string | null, RawNode[]>();
  for (const node of raw) {
    const parent = node.parentId && byId.has(node.parentId) ? node.parentId : null;
    const siblings = children.get(parent) ?? [];
    siblings.push(node);
    children.set(parent, siblings);
  }
  const ordered: CityNode[] = [];
  const seen = new Set<string>();
  const walk = (parentId: string | null, parentKey: string | null, depth: number) => {
    const siblings = [...(children.get(parentId) ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const node of siblings) {
      if (seen.has(node.id)) continue;
      seen.add(node.id);
      const key = parentKey ? `${parentKey}/${node.slug}` : node.slug;
      ordered.push({
        key,
        slug: node.slug,
        name: node.name,
        kind: node.kind,
        parentKey,
        parentId,
        depth,
      });
      walk(node.id, key, depth + 1);
    }
  };
  walk(null, null, 0);
  return ordered;
}

export function createCityNodeDirectory(options: {
  baseUrl: string;
  fetch?: typeof fetch;
  now?: () => number;
}) {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
  const now = options.now ?? Date.now;
  let cached: { nodes: CityNode[]; fetchedAt: number } | null = null;
  let lastFailureAt = Number.NEGATIVE_INFINITY;
  let inflight: Promise<void> | null = null;

  const refresh = async () => {
    try {
      const response = await fetchImpl(`${baseUrl}/api/nodes/summaries?scope=all`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`citynode.app responded ${response.status}`);
      const nodes = buildCityNodeTree(readRawNodes(await response.json()));
      cached = { nodes, fetchedAt: now() };
    } catch (error) {
      lastFailureAt = now();
      console.warn(
        "[API] City node list unavailable:",
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  const list = async (): Promise<CityNodeList> => {
    const fresh = cached && now() - cached.fetchedAt < CACHE_TTL_MS;
    const coolingDown = now() - lastFailureAt < RETRY_AFTER_FAILURE_MS;
    if (!fresh && !coolingDown) {
      inflight ??= refresh().finally(() => {
        inflight = null;
      });
      if (!cached) await inflight;
    }
    return {
      data: cached?.nodes ?? [],
      meta: {
        baseUrl,
        available: cached !== null,
        fetchedAt: cached ? new Date(cached.fetchedAt).toISOString() : null,
      },
    };
  };

  const assertKnown = async (key: string | null | undefined) => {
    if (!key) return null;
    const { data, meta } = await list();
    if (!meta.available) {
      return "City nodes can't be checked right now. Clear the city node or try again later.";
    }
    if (!data.some((node) => node.key === key)) {
      return `Unknown city node: ${key}`;
    }
    return null;
  };

  return { list, assertKnown };
}
