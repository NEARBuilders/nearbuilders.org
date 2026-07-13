import { Cause, Effect, Exit } from "every-plugin/effect";
import type { ORPCError } from "every-plugin/orpc";
import { describe, expect, it } from "vitest";
import { createCatalogMethods } from "../services/catalog";

const activeProject = {
  slug: "ref-finance",
  profile: {
    name: "Ref Finance",
    tagline: "DeFi on NEAR",
    description: "Decentralized exchange",
    image: { url: "https://example.com/ref.png" },
    linktree: { github: "https://github.com/ref-finance/ref-ui" },
    tags: { defi: "DeFi", dex: "DEX" },
    phase: "mainnet",
    status: "active",
  },
};

function response(body: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

async function effectError(effect: Effect.Effect<unknown, ORPCError<string, unknown>>) {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isFailure(exit)) return Cause.squash(exit.cause) as ORPCError<string, unknown>;
  throw new Error("Expected effect to fail");
}

describe("Catalog adapter", () => {
  it("filters inactive search results and normalizes project metadata", async () => {
    const fetchMock = async () =>
      response({
        active: activeProject,
        inactive: {
          ...activeProject,
          slug: "inactive-project",
          profile: { ...activeProject.profile, status: "", phase: "inactive" },
        },
      });
    const catalog = createCatalogMethods("https://api.nearcatalog.xyz", fetchMock);

    const projects = await Effect.runPromise(catalog.searchProjects("ref", 10));

    expect(projects).toEqual([
      {
        slug: "ref-finance",
        projectRef: "nearcatalog:ref-finance",
        name: "Ref Finance",
        tagline: "DeFi on NEAR",
        description: "Decentralized exchange",
        imageUrl: "https://example.com/ref.png",
        repositoryUrl: "https://github.com/ref-finance/ref-ui",
        catalogUrl: "https://nearcatalog.xyz/project/ref-finance",
        tags: ["DeFi", "DEX"],
        phase: "mainnet",
        status: "active",
      },
    ]);
  });

  it("drops invalid optional URLs without rejecting the project", async () => {
    const fetchMock = async () =>
      response({
        ...activeProject,
        profile: {
          ...activeProject.profile,
          image: { url: "not-a-url" },
          linktree: { github: "https://gitlab.com/example/repo" },
        },
      });
    const catalog = createCatalogMethods("https://api.nearcatalog.xyz", fetchMock);

    const project = await Effect.runPromise(catalog.getProject("ref-finance"));

    expect(project.imageUrl).toBeNull();
    expect(project.repositoryUrl).toBeNull();
  });

  it.each([
    ["an empty object", {}],
    ["an empty array", []],
  ])("returns an empty list when search returns %s", async (_description, body) => {
    const catalog = createCatalogMethods("https://api.nearcatalog.xyz", async () => response(body));

    const projects = await Effect.runPromise(catalog.searchProjects("no matches"));

    expect(projects).toEqual([]);
  });

  it("accepts the live empty-array tags shape without failing search", async () => {
    const catalog = createCatalogMethods("https://api.nearcatalog.xyz", async () =>
      response({
        "sample-page": {
          slug: "sample-page",
          profile: {
            name: "📒 NEARCatalog",
            tagline: "",
            image: { url: "" },
            tags: [],
            phase: "",
            status: "",
          },
        },
      }),
    );

    const projects = await Effect.runPromise(catalog.searchProjects("nearcatalog"));

    expect(projects).toEqual([]);
  });

  it.each([
    [404, "NOT_FOUND"],
    [429, "RATE_LIMITED"],
    [503, "SERVICE_UNAVAILABLE"],
  ])("maps HTTP %s to %s", async (status, code) => {
    const fetchMock = async () => response({}, status, { "retry-after": "10" });
    const catalog = createCatalogMethods("https://api.nearcatalog.xyz", fetchMock);

    const error = await effectError(catalog.getProject("ref-finance"));

    expect(error.code).toBe(code);
  });

  it("maps malformed data to a service error", async () => {
    const fetchMock = async () => response({ slug: "missing-profile" });
    const catalog = createCatalogMethods("https://api.nearcatalog.xyz", fetchMock);

    const error = await effectError(catalog.getProject("ref-finance"));

    expect(error.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("maps the Catalog false sentinel to not found", async () => {
    const catalog = createCatalogMethods("https://api.nearcatalog.xyz", async () =>
      response(false),
    );

    const error = await effectError(catalog.getProject("missing-project"));

    expect(error.code).toBe("NOT_FOUND");
  });

  it("maps timeouts and connection failures", async () => {
    const timeoutCatalog = createCatalogMethods("https://api.nearcatalog.xyz", () =>
      Promise.reject(new DOMException("Timed out", "TimeoutError")),
    );
    const connectionCatalog = createCatalogMethods("https://api.nearcatalog.xyz", () =>
      Promise.reject(new Error("ENOTFOUND")),
    );

    const timeout = await effectError(timeoutCatalog.getProject("ref-finance"));
    const connection = await effectError(connectionCatalog.getProject("ref-finance"));

    expect(timeout.code).toBe("TIMEOUT");
    expect(connection.code).toBe("CONNECTION_ERROR");
  });
});
