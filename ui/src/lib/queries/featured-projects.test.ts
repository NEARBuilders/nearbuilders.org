import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "@/app";
import { buildGetInvolved } from "../build-content";
import {
  type FeaturedProject,
  fetchFeaturedProjects,
  getProjectAppUrl,
  orderFeaturedProjects,
} from "./featured-projects";

const LIVE_SITE_URL = "https://nearbuilders.org";

function project(slug: string, overrides: Partial<FeaturedProject> = {}): FeaturedProject {
  return {
    id: `proj_${slug}`,
    ownerId: "nearbuilding.near",
    organizationId: null,
    kind: "project",
    slug,
    title: slug,
    description: null,
    content: null,
    status: "active",
    visibility: "public",
    repository: null,
    domain: null,
    logoUrl: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("orderFeaturedProjects", () => {
  it("returns projects in configured order regardless of API order", () => {
    const projects = [project("c"), project("a"), project("b")];

    expect(orderFeaturedProjects(["a", "b", "c"], projects).map((p) => p.slug)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("skips configured slugs with no matching project", () => {
    expect(orderFeaturedProjects(["a", "missing", "b"], [project("b"), project("a")])).toEqual([
      project("a"),
      project("b"),
    ]);
  });

  it("skips private, paused and archived projects", () => {
    const projects = [
      project("private", { visibility: "private" }),
      project("paused", { status: "paused" }),
      project("archived", { status: "archived" }),
      project("unlisted", { visibility: "unlisted" }),
    ];

    expect(
      orderFeaturedProjects(["private", "paused", "archived", "unlisted"], projects).map(
        (p) => p.slug,
      ),
    ).toEqual(["unlisted"]);
  });

  it("shows each slug once", () => {
    expect(orderFeaturedProjects(["a", "a"], [project("a")])).toHaveLength(1);
  });
});

describe("getProjectAppUrl", () => {
  it("links to the project's domain when it has one", () => {
    expect(getProjectAppUrl(project("a", { domain: "feedback.nearbuilders.org" }))).toBe(
      "https://feedback.nearbuilders.org",
    );
  });

  it("keeps a domain that already has a protocol", () => {
    expect(getProjectAppUrl(project("a", { domain: "https://app.example.com" }))).toBe(
      "https://app.example.com",
    );
  });

  it("returns no app link without a domain", () => {
    expect(getProjectAppUrl(project("a"))).toBeNull();
    expect(getProjectAppUrl(project("a", { domain: "  " }))).toBeNull();
  });
});

describe("fetchFeaturedProjects", () => {
  it("loads every featured slug in one active-only request", async () => {
    const listProjects = vi.fn().mockResolvedValue({
      data: [project("b"), project("a")],
      meta: { total: 2, hasMore: false, nextCursor: null },
    });
    const apiClient = { listProjects } as unknown as Pick<ApiClient, "listProjects">;

    const result = await fetchFeaturedProjects(apiClient, ["a", "b"]);

    expect(listProjects).toHaveBeenCalledTimes(1);
    expect(listProjects).toHaveBeenCalledWith({ slugs: "a,b", status: "active" });
    expect(result.map((p) => p.slug)).toEqual(["a", "b"]);
  });

  it("skips the request when nothing is featured", async () => {
    const listProjects = vi.fn();
    const apiClient = { listProjects } as unknown as Pick<ApiClient, "listProjects">;

    expect(await fetchFeaturedProjects(apiClient, [])).toEqual([]);
    expect(listProjects).not.toHaveBeenCalled();
  });
});

describe.skipIf(!process.env.CHECK_LIVE_FEATURED_PROJECTS)("live featured projects", () => {
  it("resolves every featured slug on the live API", async () => {
    const liveApiClient = {
      listProjects: async (input: Record<string, string>) => {
        const url = new URL("/api/v1/projects", LIVE_SITE_URL);
        for (const [key, value] of Object.entries(input)) url.searchParams.set(key, value);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${url} responded ${response.status}`);
        return response.json();
      },
    } as unknown as Pick<ApiClient, "listProjects">;

    const projects = await fetchFeaturedProjects(
      liveApiClient,
      buildGetInvolved.featuredProjectSlugs,
    );

    expect(projects.map((p) => p.slug)).toEqual([...buildGetInvolved.featuredProjectSlugs]);
  }, 20_000);
});
