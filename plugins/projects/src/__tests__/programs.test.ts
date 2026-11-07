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
    "0009_project_catalog_metadata.sql",
    "0010_project_programs.sql",
  ];
  const timestamps = [
    1778189697079, 1778192982329, 1778251917340, 1778260000000, 1778515758620, 1749700000000,
    1781818000000, 1781900000000, 1782000000000, 1793000000000, 1794000000000,
  ];
  const sources = await Promise.all(
    files.map((file) => readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8")),
  );
  return {
    default: sources.map((source, index) => ({
      idx: index,
      when: timestamps[index],
      hash: `programs-test-${index}`,
      tag: files[index],
      sql: source.split("--> statement-breakpoint").map((statement) => statement.trim()),
    })),
  };
});

const day = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * day).toISOString();

describe("project programs", () => {
  const runtime = createPluginRuntime({ registry: { projects: { module: Plugin } } });
  let dataDir: string;
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"projects">>>;
  let admin: ReturnType<typeof loaded.createClient>;
  let member: ReturnType<typeof loaded.createClient>;
  let anonymous: ReturnType<typeof loaded.createClient>;
  let publicProjectId: string;
  let privateProjectId: string;
  let archivedProjectId: string;
  let emptyProjectId: string;
  let ideaId: string;

  const baseProgram = {
    type: "credits" as const,
    title: "Cloud credits",
    rewards: "$500 in cloud credits",
    eligibility: "Approved builders",
    ctaLabel: "Claim credits",
    ctaUrl: "/dashboard",
  };

  async function createProject(slug: string, visibility: "public" | "private") {
    const owner = loaded.createClient({
      userId: "owner-user",
      near: testNear("owner.near"),
      user: testUser("owner-user", "member"),
      allowPublicVisibility: true,
    });
    const project = await owner.createProject({
      kind: "project",
      title: slug,
      slug,
      repository: `https://github.com/example/${slug}`,
      domain: `${slug}.example.com`,
      visibility,
    });
    return project.id;
  }

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-programs-plugin-"));
    loaded = await runtime.usePlugin("projects", {
      variables: {},
      secrets: { PROJECTS_DATABASE_URL: `pglite:${dataDir}` },
    });
    admin = loaded.createClient({
      userId: "admin-user",
      near: testNear("admin.near"),
      user: testUser("admin-user", "admin"),
    });
    member = loaded.createClient({
      userId: "member-user",
      near: testNear("member.near"),
      user: testUser("member-user", "member"),
    });
    anonymous = loaded.createClient();

    publicProjectId = await createProject("cloud-project", "public");
    privateProjectId = await createProject("private-project", "private");
    archivedProjectId = await createProject("archived-project", "public");
    emptyProjectId = await createProject("empty-project", "public");

    const owner = loaded.createClient({
      userId: "owner-user",
      near: testNear("owner.near"),
      user: testUser("owner-user", "member"),
      allowPublicVisibility: true,
    });
    await owner.updateProject({ id: archivedProjectId, status: "archived" });
    const idea = await owner.createProject({
      kind: "idea",
      title: "An idea",
      slug: "program-idea",
      content: "Idea content",
      visibility: "public",
    });
    ideaId = idea.id;
  }, 30_000);

  afterAll(async () => {
    await runtime.shutdown();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("returns FORBIDDEN to members and UNAUTHORIZED to anonymous callers on every admin procedure", async () => {
    const created = await admin.createProgram({ ...baseProgram, projectId: publicProjectId });

    await expect(member.adminListPrograms({})).rejects.toThrow("Admin access required");
    await expect(
      member.createProgram({ ...baseProgram, projectId: publicProjectId }),
    ).rejects.toThrow("Admin access required");
    await expect(member.updateProgram({ id: created.id, status: "listed" })).rejects.toThrow(
      "Admin access required",
    );
    await expect(member.reorderPrograms({ ids: [created.id] })).rejects.toThrow(
      "Admin access required",
    );

    await expect(anonymous.adminListPrograms({})).rejects.toThrow("Authentication required");
    await expect(
      anonymous.createProgram({ ...baseProgram, projectId: publicProjectId }),
    ).rejects.toThrow("Authentication required");
    await expect(anonymous.updateProgram({ id: created.id, status: "listed" })).rejects.toThrow(
      "Authentication required",
    );
    await expect(anonymous.reorderPrograms({ ids: [created.id] })).rejects.toThrow(
      "Authentication required",
    );

    await admin.updateProgram({ id: created.id, status: "archived" });
  });

  it("moves a program through draft, listed, paused and archived", async () => {
    const created = await admin.createProgram({
      ...baseProgram,
      title: "Lifecycle program",
      projectId: publicProjectId,
    });
    expect(created).toMatchObject({ status: "draft", state: "open", createdBy: "admin.near" });
    const listedIds = async () => (await anonymous.listPrograms({})).data.map((p) => p.id);

    expect(await listedIds()).not.toContain(created.id);

    await admin.updateProgram({ id: created.id, status: "listed" });
    expect(await listedIds()).toContain(created.id);

    await admin.updateProgram({ id: created.id, status: "paused" });
    expect(await listedIds()).not.toContain(created.id);

    await admin.updateProgram({ id: created.id, status: "listed" });
    expect(await listedIds()).toContain(created.id);

    const archived = await admin.updateProgram({ id: created.id, status: "archived" });
    expect(archived.status).toBe("archived");
    expect(await listedIds()).not.toContain(created.id);
    expect((await admin.adminListPrograms({})).data.map((p) => p.id)).toContain(created.id);
  });

  it("lists only open programs of active, non-private projects", async () => {
    const make = async (
      title: string,
      extra: Record<string, unknown>,
      projectId = publicProjectId,
    ) =>
      (await admin.createProgram({ ...baseProgram, title, projectId, status: "listed", ...extra }))
        .id;

    const open = await make("Open rolling", {});
    const openDated = await make("Open dated", {
      opensAt: daysFromNow(-1),
      closesAt: daysFromNow(5),
      topicId: "private-cloud",
    });
    const closed = await make("Closed", { closesAt: daysFromNow(-1) });
    const upcoming = await make("Upcoming", { opensAt: daysFromNow(3) });
    const draft = await make("Draft", { status: "draft" });
    const onPrivate = await make("On private project", {}, privateProjectId);
    const onArchived = await make("On archived project", {}, archivedProjectId);

    const ids = (await anonymous.listPrograms({})).data.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining([open, openDated]));
    for (const hidden of [closed, upcoming, draft, onPrivate, onArchived]) {
      expect(ids).not.toContain(hidden);
    }

    const listed = (await anonymous.listPrograms({})).data.find((p) => p.id === openDated);
    expect(listed).toMatchObject({
      state: "open",
      topicId: "private-cloud",
      project: { id: publicProjectId, slug: "cloud-project", kind: "project" },
    });
    expect(listed).not.toHaveProperty("createdBy");
    expect(listed).not.toHaveProperty("status");

    const topicIds = (await anonymous.listPrograms({ topicId: "private-cloud" })).data.map(
      (p) => p.id,
    );
    expect(topicIds).toEqual([openDated]);
  });

  it("reflects sortOrder changes in listPrograms", async () => {
    const first = await admin.createProgram({
      ...baseProgram,
      title: "Sort A",
      projectId: emptyProjectId,
      status: "listed",
      topicId: "agentic-commerce",
    });
    const second = await admin.createProgram({
      ...baseProgram,
      title: "Sort B",
      projectId: emptyProjectId,
      status: "listed",
      topicId: "agentic-commerce",
    });
    const order = async () =>
      (await anonymous.listPrograms({ topicId: "agentic-commerce" })).data.map((p) => p.id);

    await admin.reorderPrograms({ ids: [first.id, second.id] });
    expect(await order()).toEqual([first.id, second.id]);

    expect(await admin.reorderPrograms({ ids: [second.id, first.id] })).toEqual({ updated: 2 });
    expect(await order()).toEqual([second.id, first.id]);

    await admin.updateProgram({ id: first.id, sortOrder: -1 });
    expect(await order()).toEqual([first.id, second.id]);

    await admin.updateProgram({ id: first.id, status: "archived" });
    await admin.updateProgram({ id: second.id, status: "archived" });
  });

  it("shows a project's open and recently closed programs, open first", async () => {
    const projectId = await createProject("programs-page-project", "public");
    const closed = await admin.createProgram({
      ...baseProgram,
      title: "Closed last week",
      projectId,
      status: "listed",
      closesAt: daysFromNow(-7),
    });
    const open = await admin.createProgram({
      ...baseProgram,
      title: "Open now",
      projectId,
      status: "listed",
    });
    await admin.createProgram({
      ...baseProgram,
      title: "Closed long ago",
      projectId,
      status: "listed",
      opensAt: daysFromNow(-90),
      closesAt: daysFromNow(-60),
    });
    await admin.createProgram({ ...baseProgram, title: "Paused", projectId, status: "paused" });
    await admin.createProgram({
      ...baseProgram,
      title: "Not yet open",
      projectId,
      status: "listed",
      opensAt: daysFromNow(2),
    });

    const data = (await anonymous.getProjectPrograms({ projectId })).data;
    expect(data.map((p) => [p.id, p.state])).toEqual([
      [open.id, "open"],
      [closed.id, "closed"],
    ]);
  });

  it("returns no programs for a project without any, or a private one", async () => {
    expect((await anonymous.getProjectPrograms({ projectId: ideaId })).data).toEqual([]);
    expect((await anonymous.getProjectPrograms({ projectId: privateProjectId })).data).toEqual([]);
    expect((await anonymous.getProjectPrograms({ projectId: "missing" })).data).toEqual([]);
  });

  it("validates program input", async () => {
    await expect(admin.createProgram({ ...baseProgram, projectId: ideaId })).rejects.toThrow(
      "Programs can only belong to projects",
    );
    await expect(admin.createProgram({ ...baseProgram, projectId: "missing" })).rejects.toThrow(
      "Project not found",
    );
    await expect(
      admin.createProgram({
        ...baseProgram,
        projectId: publicProjectId,
        opensAt: daysFromNow(2),
        closesAt: daysFromNow(1),
      }),
    ).rejects.toThrow("closesAt must be after opensAt");
    for (const ctaUrl of [
      "javascript:alert(1)",
      "http://example.com",
      "//evil.example",
      "dashboard",
    ]) {
      await expect(
        admin.createProgram({ ...baseProgram, projectId: publicProjectId, ctaUrl }),
      ).rejects.toThrow();
    }
    await expect(admin.updateProgram({ id: "missing", status: "listed" })).rejects.toThrow(
      "Program not found",
    );
    await expect(admin.reorderPrograms({ ids: ["missing"] })).rejects.toThrow("Program not found");
  });
});
