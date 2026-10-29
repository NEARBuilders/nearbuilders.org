import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginRuntime } from "every-plugin";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Plugin from "../index";

function testNear(primaryAccountId: string) {
  return { primaryAccountId, linkedAccounts: [], hasNearAccount: true };
}

function testUser(id: string, role: string) {
  return {
    id,
    name: id,
    email: `${id}@example.com`,
    emailVerified: true,
    image: null,
    role,
    isAnonymous: false,
    locale: null,
  };
}

vi.mock("virtual:drizzle-migrations.sql", async () => {
  const files = [
    "0000_nice_pepper_potts.sql",
    "0001_wise_crusher_hogan.sql",
    "0002_lowly_darkstar.sql",
    "0003_tidy_ideas.sql",
    "0004_lively_hex.sql",
    "0005_scope_result_mentions.sql",
    "0006_global_project_slugs.sql",
    "0007_project_logo_url.sql",
    "0008_project_collaborators.sql",
  ];
  const timestamps = [
    1778189697079, 1778192982329, 1778251917340, 1778260000000, 1778515758620, 1749700000000,
    1781818000000, 1781900000000, 1782000000000,
  ];
  const sources = await Promise.all(
    files.map((file) => readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8")),
  );
  return {
    default: sources.map((source, index) => ({
      idx: index,
      when: timestamps[index],
      hash: `projects-test-${index}`,
      tag: files[index],
      sql: source.split("--> statement-breakpoint").map((statement) => statement.trim()),
    })),
  };
});

describe("projects router organization co-edit", () => {
  const runtime = createPluginRuntime({ registry: { projects: { module: Plugin } } });
  let dataDir: string;
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"projects">>>;
  let orgProjectId: string;
  let orgPrivateProjectId: string;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-projects-org-"));
    loaded = await runtime.usePlugin("projects", {
      variables: {},
      secrets: { PROJECTS_DATABASE_URL: `pglite:${dataDir}` },
    });

    const orgOwner = loaded.createClient({
      userId: "org-owner",
      near: testNear("owner.near"),
      user: testUser("org-owner", "member"),
      organizations: [{ id: "org-guild", role: "owner" }],
    });
    const project = await orgOwner.createProject({
      kind: "idea",
      title: "Guild idea",
      slug: "guild-idea",
      content: "Owned by the guild",
      visibility: "public",
      organizationId: "org-guild",
    });
    orgProjectId = project.id;

    const privateProject = await orgOwner.createProject({
      kind: "idea",
      title: "Guild secret",
      slug: "guild-secret",
      content: "Guild-only content",
      visibility: "private",
      organizationId: "org-guild",
    });
    orgPrivateProjectId = privateProject.id;
  }, 30_000);

  afterAll(async () => {
    await runtime.shutdown();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("lets an org member edit an org project", async () => {
    const member = loaded.createClient({
      userId: "guild-member",
      near: testNear("guild.near"),
      user: testUser("guild-member", "member"),
      organizations: [
        { id: "org-guild", role: "member" },
        { id: "org-other", role: "admin" },
      ],
    });

    const updated = await member.updateProject({
      id: orgProjectId,
      title: "Guild idea (updated)",
    });
    expect(updated.title).toBe("Guild idea (updated)");
  });

  it("lets an org member view the org's private project", async () => {
    const member = loaded.createClient({
      userId: "guild-member",
      near: testNear("guild.near"),
      user: testUser("guild-member", "member"),
      organizations: [{ id: "org-guild", role: "member" }],
    });

    expect((await member.getProject({ id: orgPrivateProjectId })).data.id).toBe(
      orgPrivateProjectId,
    );
  });

  it("denies users without the org membership", async () => {
    const outsider = loaded.createClient({
      userId: "outsider",
      near: testNear("outsider.near"),
      user: testUser("outsider", "member"),
      organizations: [{ id: "org-other", role: "admin" }],
    });

    await expect(outsider.updateProject({ id: orgProjectId, title: "hijack" })).rejects.toThrow(
      "permission",
    );
  });

  it("only org members view the org's private project", async () => {
    const outsider = loaded.createClient({
      userId: "outsider",
      near: testNear("outsider.near"),
      user: testUser("outsider", "member"),
      organizations: [{ id: "org-other", role: "admin" }],
    });

    await expect(outsider.getProject({ id: orgPrivateProjectId })).rejects.toThrow(
      "Project not found",
    );
  });
});
