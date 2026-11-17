import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiClient, AuthClient } from "@/app";
import { activityKeys } from "./activity";
import {
  builderActivityFilters,
  builderOwnedProjectsOptions,
  builderTeamProjectsOptions,
  prefetchBuilderProfile,
} from "./builder-profile";
import {
  builderDetailOptions,
  builderProposalsOptions,
  builderStatsOptions,
  nearProfileOptions,
  upvoteCountsOptions,
  userVotesOptions,
} from "./builders";
import { claimedCatalogProjectsQueryOptions } from "./catalog";

const nearSocial = vi.hoisted(() => ({ fetchResolvedNearProfile: vi.fn() }));
vi.mock("../near-social/index", () => nearSocial);

const ACCOUNT = "alice.near";

type Deferred = { promise: Promise<unknown>; resolve: (value: unknown) => void };
function deferred(): Deferred {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function setup() {
  const pending = new Map<string, Deferred>();
  const calls: string[] = [];
  const call = (name: string) => {
    calls.push(name);
    const d = deferred();
    pending.set(name, d);
    return d.promise;
  };
  nearSocial.fetchResolvedNearProfile.mockImplementation(() => call("nearProfile"));
  const apiClient = {
    getBuilder: vi.fn(() => call("getBuilder")),
    getProposals: vi.fn(() => call("getProposals")),
    getActivityFeed: vi.fn(() => call("getActivityFeed")),
    listClaimedCatalogProjects: vi.fn(() => call("listClaimedCatalogProjects")),
    getBuilderStats: vi.fn(() => call("getBuilderStats")),
    listProjects: vi.fn((input: { ownerId?: string }) =>
      call(input.ownerId ? "listProjects:owner" : "listProjects:team"),
    ),
    getUpvoteCounts: vi.fn(() => call("getUpvoteCounts")),
    getUserVotes: vi.fn(() => call("getUserVotes")),
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } },
  });
  const resolve = (name: string, value: unknown) => pending.get(name)?.resolve(value);
  return {
    apiClient: apiClient as unknown as ApiClient & typeof apiClient,
    authClient: {} as AuthClient,
    queryClient,
    calls,
    resolve,
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

const INDEPENDENT = [
  "getBuilder",
  "getProposals",
  "nearProfile",
  "getActivityFeed",
  "listClaimedCatalogProjects",
  "getBuilderStats",
  "listProjects:owner",
  "listProjects:team",
];

function resolveIndependent(ctx: ReturnType<typeof setup>, proposalIds: string[]) {
  ctx.resolve("getBuilder", { data: { nearAccount: ACCOUNT, name: "Alice" } });
  ctx.resolve("getProposals", { data: proposalIds.map((id) => ({ id })) });
  ctx.resolve("nearProfile", null);
  ctx.resolve("getActivityFeed", { data: [], meta: { hasMore: false, nextCursor: null } });
  ctx.resolve("listClaimedCatalogProjects", { data: [] });
  ctx.resolve("getBuilderStats", { data: {} });
  ctx.resolve("listProjects:owner", { data: [] });
  ctx.resolve("listProjects:team", { data: [] });
}

describe("prefetchBuilderProfile", () => {
  beforeEach(() => {
    nearSocial.fetchResolvedNearProfile.mockReset();
  });

  it("starts every independent query before any of them resolves", async () => {
    const ctx = setup();
    const result = prefetchBuilderProfile({ ...ctx, account: ACCOUNT, isAuthenticated: true });
    await flush();

    expect([...ctx.calls].sort()).toEqual([...INDEPENDENT].sort());

    resolveIndependent(ctx, ["p1"]);
    await flush();
    expect(ctx.calls).toContain("getUpvoteCounts");
    expect(ctx.calls).toContain("getUserVotes");
    ctx.resolve("getUpvoteCounts", {});
    ctx.resolve("getUserVotes", {});

    await expect(result).resolves.toEqual({ nearAccount: ACCOUNT, name: "Alice" });
  });

  it("primes the exact cache entries the page components read", async () => {
    const ctx = setup();
    const result = prefetchBuilderProfile({ ...ctx, account: ACCOUNT, isAuthenticated: true });
    await flush();
    resolveIndependent(ctx, ["p1"]);
    await flush();
    ctx.resolve("getUpvoteCounts", {});
    ctx.resolve("getUserVotes", {});
    await result;

    const { apiClient, authClient, queryClient } = ctx;
    const keys = [
      builderDetailOptions(apiClient, ACCOUNT).queryKey,
      builderProposalsOptions(apiClient, ACCOUNT).queryKey,
      nearProfileOptions(authClient, ACCOUNT).queryKey,
      builderStatsOptions(apiClient, ACCOUNT).queryKey,
      builderOwnedProjectsOptions(apiClient, ACCOUNT).queryKey,
      builderTeamProjectsOptions(apiClient, ACCOUNT).queryKey,
      claimedCatalogProjectsQueryOptions(apiClient, ACCOUNT).queryKey,
      activityKeys.feed(builderActivityFilters(ACCOUNT)),
      upvoteCountsOptions(apiClient, ["p1"]).queryKey,
      userVotesOptions(apiClient, ["p1"], true).queryKey,
    ];
    for (const key of keys) {
      expect(queryClient.getQueryState(key)?.status, JSON.stringify(key)).toBe("success");
    }

    // Each endpoint was hit exactly once, so components reading this cache do not refetch.
    expect(apiClient.listProjects).toHaveBeenCalledTimes(2);
    expect(apiClient.getBuilder).toHaveBeenCalledTimes(1);
    expect(apiClient.getProposals).toHaveBeenCalledTimes(1);
    expect(apiClient.getActivityFeed).toHaveBeenCalledTimes(1);
    expect(apiClient.getBuilderStats).toHaveBeenCalledTimes(1);
    expect(apiClient.listClaimedCatalogProjects).toHaveBeenCalledTimes(1);
    expect(apiClient.getUpvoteCounts).toHaveBeenCalledTimes(1);
    expect(apiClient.getUserVotes).toHaveBeenCalledTimes(1);
    expect(nearSocial.fetchResolvedNearProfile).toHaveBeenCalledTimes(1);
  });

  it("skips user votes for anonymous visitors and returns null when the builder is missing", async () => {
    const ctx = setup();
    const result = prefetchBuilderProfile({ ...ctx, account: ACCOUNT, isAuthenticated: false });
    await flush();
    resolveIndependent(ctx, ["p1"]);
    ctx.resolve("getBuilder", { data: null });
    await flush();
    ctx.resolve("getUpvoteCounts", {});
    await result;
    expect(ctx.calls).not.toContain("getUserVotes");
  });

  it("still resolves when independent queries fail", async () => {
    const ctx = setup();
    ctx.apiClient.getBuilder.mockImplementation(() => Promise.reject(new Error("boom")));
    ctx.apiClient.getProposals.mockImplementation(() => Promise.reject(new Error("boom")));
    const result = prefetchBuilderProfile({ ...ctx, account: ACCOUNT, isAuthenticated: true });
    await flush();
    for (const name of INDEPENDENT.filter((n) => n !== "getBuilder" && n !== "getProposals")) {
      ctx.resolve(
        name,
        name === "getActivityFeed" ? { data: [], meta: { hasMore: false } } : { data: [] },
      );
    }
    await expect(result).resolves.toBeNull();
    expect(ctx.calls).not.toContain("getUpvoteCounts");
  });
});
