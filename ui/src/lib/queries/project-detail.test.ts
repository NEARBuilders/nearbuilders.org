import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiClient, AuthClient } from "@/app";
import { nearProfileOptions } from "./builders";
import {
  prefetchProjectDetail,
  projectBySlugOptions,
  projectCollaboratorsOptions,
  projectLastCommitOptions,
  projectReadmeOptions,
  projectUpvoteCountOptions,
  projectUserVoteOptions,
  REPOSITORY_CONTENT_STALE_TIME,
} from "./project-detail";

const nearSocial = vi.hoisted(() => ({ fetchResolvedNearProfile: vi.fn() }));
vi.mock("../near-social/index", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...nearSocial,
}));

const repo = vi.hoisted(() => ({
  fetchRepositoryReadme: vi.fn(),
  fetchRepositoryLastCommitDate: vi.fn(),
}));
vi.mock("../repository-content", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...repo,
}));

const SLUG = "my-project";
const PROJECT = {
  id: "p1",
  slug: SLUG,
  kind: "project",
  title: "My Project",
  ownerId: "alice.near",
  repository: "https://github.com/acme/my-project",
};

function setup() {
  const calls: string[] = [];
  const never = () => new Promise(() => {});
  const apiClient = {
    getProjectBySlug: vi.fn(async () => {
      calls.push("getProjectBySlug");
      return { data: PROJECT };
    }),
    getUpvoteCount: vi.fn(async () => {
      calls.push("getUpvoteCount");
      return { totalCount: 3 };
    }),
    getUserVote: vi.fn(async () => {
      calls.push("getUserVote");
      return { hasUpvote: true };
    }),
    listCollaborators: vi.fn(async () => {
      calls.push("listCollaborators");
      return { data: [] };
    }),
  };
  const authClient = {
    organization: {
      list: vi.fn(async () => {
        calls.push("organizations");
        return { data: [] };
      }),
    },
  };
  nearSocial.fetchResolvedNearProfile.mockImplementation(async () => {
    calls.push("nearProfile");
    return null;
  });
  // GitHub never answers: the loader must not wait for it.
  repo.fetchRepositoryReadme.mockImplementation(() => {
    calls.push("readme");
    return never();
  });
  repo.fetchRepositoryLastCommitDate.mockImplementation(() => {
    calls.push("lastCommit");
    return never();
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    calls,
    queryClient,
    apiClient: apiClient as unknown as ApiClient,
    authClient: authClient as unknown as AuthClient,
    rawApi: apiClient,
  };
}

describe("prefetchProjectDetail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches the project once and primes every first-render query", async () => {
    const { calls, queryClient, apiClient, authClient, rawApi } = setup();
    const project = await prefetchProjectDetail({
      queryClient,
      apiClient,
      authClient,
      slug: SLUG,
      isAuthenticated: true,
    });

    expect(project).toEqual(PROJECT);
    expect(rawApi.getProjectBySlug).toHaveBeenCalledTimes(1);
    // Follow-ups are dispatched synchronously once the project lands.
    expect([...calls].sort()).toEqual(
      [
        "getProjectBySlug",
        "getUpvoteCount",
        "getUserVote",
        "lastCommit",
        "listCollaborators",
        "nearProfile",
        "organizations",
        "readme",
      ].sort(),
    );
    for (const options of [
      projectBySlugOptions(apiClient, SLUG),
      projectUpvoteCountOptions(apiClient, PROJECT.id),
      projectUserVoteOptions(apiClient, PROJECT.id, true),
      projectCollaboratorsOptions(apiClient, PROJECT.id),
      nearProfileOptions(authClient, PROJECT.ownerId),
    ]) {
      await vi.waitFor(() => expect(queryClient.getQueryData(options.queryKey)).toBeDefined());
    }

    // The page's own query reads the cache instead of fetching again.
    await queryClient.ensureQueryData(projectBySlugOptions(apiClient, SLUG));
    expect(rawApi.getProjectBySlug).toHaveBeenCalledTimes(1);
  });

  it("does not block on README / last-commit and caches them", async () => {
    const { queryClient, apiClient, authClient } = setup();
    await prefetchProjectDetail({
      queryClient,
      apiClient,
      authClient,
      slug: SLUG,
      isAuthenticated: false,
    });
    expect(queryClient.getQueryState(projectReadmeOptions(PROJECT).queryKey)?.fetchStatus).toBe(
      "fetching",
    );
    expect(projectReadmeOptions(PROJECT).staleTime).toBe(REPOSITORY_CONTENT_STALE_TIME);
    expect(projectLastCommitOptions(PROJECT).staleTime).toBe(REPOSITORY_CONTENT_STALE_TIME);
    expect(projectReadmeOptions(PROJECT).retry).toBe(false);
  });

  it("skips signed-in-only queries for visitors", async () => {
    const { calls, queryClient, apiClient, authClient } = setup();
    await prefetchProjectDetail({
      queryClient,
      apiClient,
      authClient,
      slug: SLUG,
      isAuthenticated: false,
    });
    expect(calls).not.toContain("getUserVote");
    expect(calls).not.toContain("organizations");
  });

  it("does not retry a missing project", () => {
    const { apiClient } = setup();
    const { retry } = projectBySlugOptions(apiClient, SLUG);
    expect(retry(0, { code: "NOT_FOUND" })).toBe(false);
    expect(retry(0, new Error("network"))).toBe(true);
    expect(retry(3, new Error("network"))).toBe(false);
  });

  it("returns null without follow-up fetches when the project is missing", async () => {
    const { calls, queryClient, apiClient, authClient, rawApi } = setup();
    rawApi.getProjectBySlug.mockRejectedValue(
      Object.assign(new Error("Project not found"), { code: "NOT_FOUND" }),
    );
    const project = await prefetchProjectDetail({
      queryClient,
      apiClient,
      authClient,
      slug: SLUG,
      isAuthenticated: false,
    });
    expect(project).toBeNull();
    expect(rawApi.getProjectBySlug).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([]);
  });
});
