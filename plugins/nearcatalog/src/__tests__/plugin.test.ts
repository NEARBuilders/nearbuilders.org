import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginRuntime } from "every-plugin";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Plugin from "../index";

function testUser(id: string, role: string) {
  return {
    id,
    name: id,
    email: `${id}@example.com`,
    emailVerified: true,
    image: null,
    role,
    isAnonymous: false,
  };
}

const catalogProject = {
  slug: "ref-finance",
  profile: {
    name: "Ref Finance",
    tagline: "DeFi on NEAR",
    description: "Decentralized exchange",
    image: { url: "https://example.com/ref.png" },
    linktree: { github: "https://github.com/ref-finance/ref-ui" },
    status: "active",
    phase: "mainnet",
    tags: { defi: "DeFi" },
  },
};

const encodedProjectSlug = "curate-fun-%ef%b8%8f-autonomous-news";

vi.mock("virtual:drizzle-migrations.sql", async () => {
  const { readFile } = await import("node:fs/promises");
  const files = ["0000_happy_black_bolt.sql", "0001_plain_tusk.sql"];
  const sources = await Promise.all(
    files.map((file) => readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8")),
  );
  return {
    default: sources.map((source, index) => ({
      hash: `nearcatalog-test-${index}`,
      tag: files[index],
      sql: source.split("--> statement-breakpoint").map((statement) => statement.trim()),
    })),
  };
});

describe("NearCatalog plugin", () => {
  const runtime = createPluginRuntime({
    registry: { nearcatalog: { module: Plugin } },
  });
  let dataDir: string;
  let offlineProjectUnavailable = false;
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"nearcatalog">>>;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-nearcatalog-plugin-"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL) => {
        const projectSlug = input.searchParams.get("pid");
        if (projectSlug === "offline-project" && offlineProjectUnavailable) {
          return new Response("Unavailable", { status: 503 });
        }
        if (input.pathname === "/search") {
          if (input.searchParams.get("kw") === "curate") {
            return new Response(
              JSON.stringify({
                [encodedProjectSlug]: {
                  ...catalogProject,
                  slug: encodedProjectSlug,
                  profile: { ...catalogProject.profile, phase: "inactive", status: "" },
                },
              }),
            );
          }
          return new Response(JSON.stringify({ "ref-finance": catalogProject }));
        }
        if (projectSlug === encodedProjectSlug) {
          return new Response(
            JSON.stringify({
              ...catalogProject,
              slug: encodedProjectSlug,
              profile: { ...catalogProject.profile, phase: "inactive", status: "" },
            }),
          );
        }
        if (projectSlug === "offline-project") {
          return new Response(JSON.stringify({ ...catalogProject, slug: projectSlug }));
        }
        return new Response(JSON.stringify(catalogProject));
      }),
    );
    loaded = await runtime.usePlugin("nearcatalog", {
      variables: { baseUrl: "https://api.nearcatalog.xyz" },
      secrets: { NEARCATALOG_DATABASE_URL: `pglite:${dataDir}` },
    });
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await runtime.shutdown();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("wires Catalog reads and admin-only claims without exposing unavailable projects", async () => {
    const anonymous = loaded.createClient();
    const member = loaded.createClient({
      userId: "member",
      user: testUser("member", "member"),
    });
    const admin = loaded.createClient({
      userId: "admin",
      user: testUser("admin", "admin"),
    });
    const publicClient = loaded.createClient();
    const search = await publicClient.searchCatalogProjects({ query: "ref" });
    const encodedSearch = await publicClient.searchCatalogProjects({ query: "curate" });
    const project = await publicClient.getCatalogProject({ slug: "ref-finance" });
    const input = {
      nearAccount: "alice.near",
      projectSlug: "ref-finance",
      roles: ["Developer"],
    };

    expect(search.data[0]?.projectRef).toBe("nearcatalog:ref-finance");
    expect(encodedSearch.data[0]).toMatchObject({
      slug: encodedProjectSlug,
      projectRef: `nearcatalog:${encodedProjectSlug}`,
    });
    expect(project.data.repositoryUrl).toBe("https://github.com/ref-finance/ref-ui");
    await expect(anonymous.applyCatalogClaim(input)).rejects.toThrow("Authentication required");
    await expect(member.applyCatalogClaim(input)).rejects.toThrow("Admin access required");
    const applied = await admin.applyCatalogClaim(input);
    const inactiveApplied = await admin.applyCatalogClaim({
      nearAccount: "curator.near",
      projectSlug: encodedProjectSlug,
      roles: ["Curator"],
    });
    await admin.revokeCatalogClaim({ id: inactiveApplied.data.id });
    await admin.setCatalogClaimActivity({ id: applied.data.id, activityEventId: "act-alice" });
    const offline = await admin.applyCatalogClaim({
      nearAccount: "bob.near",
      projectSlug: "offline-project",
      roles: ["Contributor"],
    });
    await admin.setCatalogClaimActivity({ id: offline.data.id, activityEventId: "act-bob" });
    const listed = await publicClient.listCatalogClaims({ nearAccount: "alice.near" });

    expect(applied.data.id).toBe("claim:alice.near:ref-finance");
    expect(inactiveApplied.data.id).toBe(`claim:curator.near:${encodedProjectSlug}`);
    expect(listed.data).toHaveLength(1);
    offlineProjectUnavailable = true;

    const claimedProjects = await publicClient.listClaimedCatalogProjects({});
    const personalProjects = await publicClient.listClaimedCatalogProjects({
      nearAccount: "alice.near",
    });

    expect(claimedProjects.data).toHaveLength(1);
    expect(claimedProjects.data[0]?.project.slug).toBe("ref-finance");
    expect(personalProjects.data[0]?.contributors).toEqual([
      expect.objectContaining({ nearAccount: "alice.near", roles: ["Developer"] }),
    ]);

    await admin.revokeCatalogClaim({ id: applied.data.id });
    const revokedClaims = await publicClient.listCatalogClaims({ nearAccount: "alice.near" });
    const projectsAfterRevocation = await publicClient.listClaimedCatalogProjects({});

    expect(revokedClaims.data).toEqual([]);
    expect(projectsAfterRevocation.data).toEqual([]);
  });
});
