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
  ];
  const timestamps = [
    1778189697079, 1778192982329, 1778251917340, 1778260000000, 1778515758620, 1749700000000,
    1781818000000,
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

describe("projects router visibility", () => {
  const runtime = createPluginRuntime({ registry: { projects: { module: Plugin } } });
  let dataDir: string;
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"projects">>>;
  let privateProjectId: string;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-projects-plugin-"));
    loaded = await runtime.usePlugin("projects", {
      variables: {},
      secrets: { PROJECTS_DATABASE_URL: `pglite:${dataDir}` },
    });

    const owner = loaded.createClient({
      userId: "owner-user",
      near: testNear("owner.near"),
      user: testUser("owner-user", "member"),
    });
    const privateProject = await owner.createProject({
      kind: "idea",
      title: "Private idea",
      slug: "private-idea",
      content: "Private proposal content",
      visibility: "private",
    });
    privateProjectId = privateProject.id;
    await owner.createProject({
      kind: "idea",
      title: "Public project",
      slug: "public-project",
      content: "Public project content",
      visibility: "public",
    });
  }, 30_000);

  afterAll(async () => {
    await runtime.shutdown();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("allows owners and admins to read private projects", async () => {
    const owner = loaded.createClient({
      userId: "owner-user",
      near: testNear("owner.near"),
      user: testUser("owner-user", "member"),
    });
    const admin = loaded.createClient({
      userId: "admin-user",
      near: testNear("admin.near"),
      user: testUser("admin-user", "admin"),
    });

    expect((await owner.getProject({ id: privateProjectId })).data.id).toBe(privateProjectId);
    expect((await owner.getProjectBySlug({ slug: "private-idea" })).data.id).toBe(privateProjectId);
    expect((await admin.getProject({ id: privateProjectId })).data.id).toBe(privateProjectId);
    expect((await admin.getProjectBySlug({ slug: "private-idea" })).data.id).toBe(privateProjectId);
  });

  it("hides private projects from unrelated and anonymous users", async () => {
    const member = loaded.createClient({
      userId: "member-user",
      near: testNear("member.near"),
      user: testUser("member-user", "member"),
    });
    const anonymous = loaded.createClient();

    await expect(member.getProject({ id: privateProjectId })).rejects.toThrow("Project not found");
    await expect(member.getProjectBySlug({ slug: "private-idea" })).rejects.toThrow(
      "Project not found",
    );
    await expect(anonymous.getProject({ id: privateProjectId })).rejects.toThrow(
      "Project not found",
    );
    expect((await member.listProjects({ visibility: "private" })).data).toEqual([]);
    expect((await anonymous.listProjects({ visibility: "private" })).data).toEqual([]);
  });

  it("only lists private projects for owners and admins", async () => {
    const owner = loaded.createClient({
      userId: "owner-user",
      near: testNear("owner.near"),
      user: testUser("owner-user", "member"),
    });
    const admin = loaded.createClient({
      userId: "admin-user",
      near: testNear("admin.near"),
      user: testUser("admin-user", "admin"),
    });

    expect((await owner.listProjects({ visibility: "private" })).data).toHaveLength(1);
    expect((await admin.listProjects({ visibility: "private" })).data).toHaveLength(1);
  });

  it("keeps admins read-only outside the reviewed lifecycle operation", async () => {
    const admin = loaded.createClient({
      userId: "admin-user",
      near: testNear("admin.near"),
      user: testUser("admin-user", "admin"),
    });

    await expect(
      admin.updateProject({ id: privateProjectId, title: "Admin edit" }),
    ).rejects.toThrow("permission");

    const applied = await admin.applyReviewedProject({
      id: privateProjectId,
      ownerId: "owner.near",
      title: "Approved title",
      visibility: "public",
    });

    expect(applied).toMatchObject({
      id: privateProjectId,
      ownerId: "owner.near",
      title: "Approved title",
      visibility: "public",
    });
  });

  it("keeps public projects readable anonymously", async () => {
    const anonymous = loaded.createClient();
    expect((await anonymous.getProjectBySlug({ slug: "public-project" })).data.visibility).toBe(
      "public",
    );
  });
});
