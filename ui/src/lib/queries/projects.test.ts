import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "@/app";
import {
  claimedCatalogProjectsInfiniteOptions,
  flattenUniquePages,
  PAGE_SIZE,
  projectsInfiniteOptions,
} from "./projects";

function page(ids: string[], nextCursor: string | null) {
  return {
    data: ids.map((id) => ({ id })),
    meta: { total: 0, hasMore: nextCursor !== null, nextCursor },
  };
}

describe("projectsInfiniteOptions", () => {
  it("passes filters and the page cursor to listProjects", async () => {
    const listProjects = vi.fn().mockResolvedValue(page([], null));
    const options = projectsInfiniteOptions({ listProjects } as unknown as ApiClient, {
      kind: "idea",
      ownerId: "owner.near",
      privateOnly: true,
      query: "agent",
      status: "active",
      sort: "oldest",
    });

    await options.queryFn({ pageParam: "48" });

    expect(listProjects).toHaveBeenCalledWith({
      limit: PAGE_SIZE,
      cursor: "48",
      kind: "idea",
      ownerId: "owner.near",
      visibility: "private",
      query: "agent",
      status: "active",
      sort: "oldest",
    });
    expect(options.initialPageParam).toBeUndefined();
  });

  it("keys every filter so a filter change starts a fresh list", () => {
    const apiClient = {} as ApiClient;
    const base = projectsInfiniteOptions(apiClient, { sort: "newest" }).queryKey;

    expect(base).toEqual(["projects", "all", null, false, null, null, "newest"]);
    for (const filters of [
      { sort: "oldest" as const },
      { sort: "newest" as const, kind: "scope" as const },
      { sort: "newest" as const, query: "bot" },
      { sort: "newest" as const, status: "paused" as const },
      { sort: "newest" as const, ownerId: "owner.near" },
      { sort: "newest" as const, ownerId: "owner.near", privateOnly: true },
    ]) {
      expect(projectsInfiniteOptions(apiClient, filters).queryKey).not.toEqual(base);
    }
  });

  it("stops paging when the API reports no more results", () => {
    const { getNextPageParam } = projectsInfiniteOptions({} as ApiClient, { sort: "newest" });

    expect(getNextPageParam(page(["a"], "24"))).toBe("24");
    expect(getNextPageParam(page(["a"], null))).toBeUndefined();
    expect(getNextPageParam({ meta: { hasMore: true, nextCursor: null } })).toBeUndefined();
  });
});

describe("claimedCatalogProjectsInfiniteOptions", () => {
  it("keys by account and query and forwards the cursor", async () => {
    const listClaimedCatalogProjects = vi.fn().mockResolvedValue(page([], null));
    const options = claimedCatalogProjectsInfiniteOptions(
      { listClaimedCatalogProjects } as unknown as ApiClient,
      { query: "wallet" },
    );

    await options.queryFn({ pageParam: "24" });

    expect(options.queryKey).toEqual(["catalog-projects", null, "wallet"]);
    expect(listClaimedCatalogProjects).toHaveBeenCalledWith({
      nearAccount: undefined,
      query: "wallet",
      limit: PAGE_SIZE,
      cursor: "24",
    });
  });
});

describe("flattenUniquePages", () => {
  it("keeps page order and drops entries repeated across pages", () => {
    const pages = [page(["a", "b", "c"], "3"), page(["c", "d"], "5"), page(["a", "e"], null)];

    expect(flattenUniquePages(pages, (item) => item.id).map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });

  it("returns an empty list before the first page loads", () => {
    expect(flattenUniquePages<{ id: string }>(undefined, (item) => item.id)).toEqual([]);
  });
});
