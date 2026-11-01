import { describe, expect, it, vi } from "vitest";
import {
  buildCityNodeTree,
  type CityNodeAppClient,
  createCityNodeAppClient,
  createCityNodeDirectory,
} from "../../src/services/city-nodes";

function summary(id: string, slug: string, name: string, kind: string, parentId: string | null) {
  return {
    node: {
      id,
      kind,
      slug,
      name,
      parentId,
      tenantId: null,
      metadata: {},
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
    childrenCount: 0,
    validatorCount: 0,
  };
}

const summaries = [
  summary("c-2", "hill-valley", "Hill Valley", "city", "s-1"),
  summary("k-1", "freedonia", "Freedonia", "country", null),
  summary("s-1", "west-province", "West Province", "state", "k-1"),
  summary("c-1", "lakeside", "Lakeside", "city", null),
];

type Summaries = typeof summaries;

function fakeClient(listNodeSummaries: (...args: unknown[]) => Promise<Summaries>) {
  const fn = vi.fn(listNodeSummaries);
  return { fn, client: { listNodeSummaries: fn } as unknown as CityNodeAppClient };
}

describe("buildCityNodeTree", () => {
  it("orders nodes as a country / state / city tree", () => {
    const tree = buildCityNodeTree(
      summaries.map(({ node }) => ({
        id: node.id,
        slug: node.slug,
        name: node.name,
        kind: node.kind,
        parentId: node.parentId,
      })),
    );
    expect(tree.map((node) => [node.key, node.depth, node.parentKey, node.parentId])).toEqual([
      ["freedonia", 0, null, null],
      ["freedonia/west-province", 1, "freedonia", "k-1"],
      ["freedonia/west-province/hill-valley", 2, "freedonia/west-province", "s-1"],
      ["lakeside", 0, null, null],
    ]);
  });

  it("gives child nodes with the same slug different keys", () => {
    const tree = buildCityNodeTree([
      { id: "s-1", slug: "north", name: "North", kind: "state", parentId: null },
      { id: "s-2", slug: "south", name: "South", kind: "state", parentId: null },
      { id: "c-1", slug: "springfield", name: "Springfield", kind: "city", parentId: "s-1" },
      { id: "c-2", slug: "springfield", name: "Springfield", kind: "city", parentId: "s-2" },
    ]);
    expect(tree.filter((node) => node.slug === "springfield").map((node) => node.key)).toEqual([
      "north/springfield",
      "south/springfield",
    ]);
  });

  it("treats a node with a missing parent as a root", () => {
    const tree = buildCityNodeTree([
      { id: "c-9", slug: "orphan-town", name: "Orphan Town", kind: "city", parentId: "gone" },
    ]);
    expect(tree).toEqual([
      {
        key: "orphan-town",
        slug: "orphan-town",
        name: "Orphan Town",
        kind: "city",
        parentKey: null,
        parentId: null,
        depth: 0,
      },
    ]);
  });
});

describe("createCityNodeAppClient", () => {
  it("calls listNodeSummaries on citynode.app's oRPC endpoint as JSON", async () => {
    const fetch = vi.fn(
      async (_input: Request | string, _init?: RequestInit) =>
        new Response(JSON.stringify({ json: summaries }), {
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    try {
      const result = await createCityNodeAppClient("https://citynode.test/").listNodeSummaries({
        scope: "all",
      });

      expect(result).toHaveLength(4);
      const [input, init] = fetch.mock.calls[0] ?? [""];
      const request = typeof input === "string" ? new Request(input, init) : input;
      expect(request.method).toBe("POST");
      expect(request.url).toBe("https://citynode.test/api/rpc/listNodeSummaries");
      expect(request.headers.get("content-type")).toContain("application/json");
      expect(await request.json()).toEqual({ json: { scope: "all" } });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("createCityNodeDirectory", () => {
  it("reads citynode.app summaries once and serves the cached list", async () => {
    const { fn, client } = fakeClient(async () => summaries);
    const directory = createCityNodeDirectory({ baseUrl: "https://citynode.test/", client });

    const first = await directory.list();
    await directory.list();

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ scope: "all" }, expect.anything());
    expect(first.meta).toMatchObject({ baseUrl: "https://citynode.test", available: true });
    expect(first.data).toHaveLength(4);
  });

  it("serves the stale list while refreshing in the background", async () => {
    let now = 0;
    let release: (value: Summaries) => void = () => {};
    const responses = [
      Promise.resolve(summaries),
      new Promise<Summaries>((resolve) => (release = resolve)),
    ];
    const { fn, client } = fakeClient(() => responses.shift() as Promise<Summaries>);
    const directory = createCityNodeDirectory({
      baseUrl: "https://citynode.test",
      client,
      now: () => now,
    });
    await directory.list();

    now = 60 * 60_000;
    const stale = await directory.list();

    expect(fn).toHaveBeenCalledTimes(2);
    expect(stale.data).toHaveLength(4);
    release(summaries.slice(0, 1));
    await vi.waitFor(async () => expect((await directory.list()).data).toHaveLength(1));
  });

  it("keeps the last good list when citynode.app goes down", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let now = 0;
    let up = true;
    const { fn, client } = fakeClient(async () => {
      if (!up) throw new Error("Bad Gateway");
      return summaries;
    });
    const directory = createCityNodeDirectory({
      baseUrl: "https://citynode.test",
      client,
      now: () => now,
    });
    await directory.list();

    up = false;
    now = 60 * 60_000;
    await directory.list();
    await vi.waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
    const stale = await directory.list();

    expect(stale.meta.available).toBe(true);
    expect(stale.data.map((node) => node.key)).toContain("lakeside");
    await expect(directory.assertKnown("lakeside")).resolves.toBeNull();
  });

  it("returns an empty list and backs off when citynode.app has never answered", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fn, client } = fakeClient(async () => {
      throw new Error("connect ECONNREFUSED");
    });
    const directory = createCityNodeDirectory({
      baseUrl: "https://citynode.test",
      client,
      now: () => 0,
    });

    const result = await directory.list();
    await directory.list();

    expect(result).toEqual({
      data: [],
      meta: { baseUrl: "https://citynode.test", available: false, fetchedAt: null },
    });
    expect(fn).toHaveBeenCalledTimes(1);
    await expect(directory.assertKnown(undefined)).resolves.toBeNull();
    await expect(directory.assertKnown("lakeside")).resolves.toMatch(/can't be checked/);
  });

  it("rejects slugs that are not on citynode.app", async () => {
    const { client } = fakeClient(async () => summaries);
    const directory = createCityNodeDirectory({ baseUrl: "https://citynode.test", client });
    await expect(directory.assertKnown("freedonia/west-province/hill-valley")).resolves.toBeNull();
    await expect(directory.assertKnown("hill-valley")).resolves.toBe(
      "Unknown city node: hill-valley",
    );
    await expect(directory.assertKnown("atlantis")).resolves.toBe("Unknown city node: atlantis");
  });
});
