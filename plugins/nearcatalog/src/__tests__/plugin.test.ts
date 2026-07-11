import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginRuntime } from "every-plugin";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Plugin from "../index";

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

vi.mock("virtual:drizzle-migrations.sql", () => ({
  default: [
    {
      hash: "nearcatalog-test",
      tag: "nearcatalog-test",
      sql: [
        `CREATE TABLE "nearcatalog_claims" (
          "id" text PRIMARY KEY NOT NULL,
          "near_account" text NOT NULL,
          "project_slug" text NOT NULL,
          "roles" jsonb NOT NULL,
          "activity_event_id" text,
          "revoked_at" timestamp with time zone,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        )`,
        `CREATE UNIQUE INDEX "nearcatalog_claims_builder_project_unique"
          ON "nearcatalog_claims" USING btree ("near_account", "project_slug")`,
        `CREATE TABLE "nearcatalog_claim_history" (
          "id" text PRIMARY KEY NOT NULL,
          "claim_id" text NOT NULL,
          "near_account" text NOT NULL,
          "project_slug" text NOT NULL,
          "roles" jsonb NOT NULL,
          "activity_event_id" text,
          "action" text NOT NULL,
          "occurred_at" timestamp with time zone DEFAULT now() NOT NULL
        )`,
      ],
    },
  ],
}));

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
          return new Response(JSON.stringify({ "ref-finance": catalogProject }));
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

  it("exposes normalized Catalog search and lookup", async () => {
    const publicClient = loaded.createClient();

    const search = await publicClient.searchCatalogProjects({ query: "ref" });
    const project = await publicClient.getCatalogProject({ slug: "ref-finance" });

    expect(search.data).toHaveLength(1);
    expect(search.data[0]?.projectRef).toBe("nearcatalog:ref-finance");
    expect(project.data.repositoryUrl).toBe("https://github.com/ref-finance/ref-ui");
  });

  it("requires admin access for claim mutations", async () => {
    const anonymous = loaded.createClient();
    const member = loaded.createClient({
      userId: "member",
      user: { id: "member", role: "member" },
    });
    const input = {
      nearAccount: "alice.near",
      projectSlug: "ref-finance",
      roles: ["Developer"],
    };

    await expect(anonymous.applyCatalogClaim(input)).rejects.toThrow("Authentication required");
    await expect(member.applyCatalogClaim(input)).rejects.toThrow("Admin access required");
  });

  it("allows admins to apply and publicly read a claim", async () => {
    const admin = loaded.createClient({
      userId: "admin",
      user: { id: "admin", role: "admin" },
    });
    const publicClient = loaded.createClient();

    const applied = await admin.applyCatalogClaim({
      nearAccount: "alice.near",
      projectSlug: "ref-finance",
      roles: ["Developer"],
    });
    const listed = await publicClient.listCatalogClaims({ nearAccount: "alice.near" });

    expect(applied.data.id).toBe("claim:alice.near:ref-finance");
    expect(listed.data).toHaveLength(1);
  });

  it("keeps revocation history internal and excludes revoked public claims", async () => {
    const admin = loaded.createClient({
      userId: "admin",
      user: { id: "admin", role: "admin" },
    });
    const publicClient = loaded.createClient();
    const id = "claim:alice.near:ref-finance";

    await admin.setCatalogClaimActivity({ id, activityEventId: "activity_1" });
    await admin.revokeCatalogClaim({ id });

    const history = await admin.getCatalogClaimHistory({ id });
    const listed = await publicClient.listCatalogClaims({ nearAccount: "alice.near" });

    expect(history.data.some((entry) => entry.action === "revoked")).toBe(true);
    expect(listed.data).toEqual([]);
  });

  it("omits temporarily unavailable projects from claimed-project reads", async () => {
    const admin = loaded.createClient({
      userId: "admin",
      user: { id: "admin", role: "admin" },
    });
    const publicClient = loaded.createClient();

    await admin.applyCatalogClaim({
      nearAccount: "alice.near",
      projectSlug: "ref-finance",
      roles: ["Developer"],
    });
    await admin.applyCatalogClaim({
      nearAccount: "bob.near",
      projectSlug: "offline-project",
      roles: ["Contributor"],
    });
    offlineProjectUnavailable = true;

    const claimedProjects = await publicClient.listClaimedCatalogProjects({});

    expect(claimedProjects.data).toHaveLength(1);
    expect(claimedProjects.data[0]?.project.slug).toBe("ref-finance");
  });
});
