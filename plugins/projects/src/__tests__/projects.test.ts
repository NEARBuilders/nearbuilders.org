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
    "0007_project_logo_url.sql",
  ];
  const timestamps = [
    1778189697079, 1778192982329, 1778251917340, 1778260000000, 1778515758620, 1749700000000,
    1781818000000, 1781900000000,
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

  it("keeps unlisted projects off the directory but readable by link", async () => {
    const owner = loaded.createClient({
      userId: "owner-user",
      near: testNear("owner.near"),
      user: testUser("owner-user", "member"),
    });
    const member = loaded.createClient({
      userId: "member-user",
      near: testNear("member.near"),
      user: testUser("member-user", "member"),
    });
    const anonymous = loaded.createClient();
    const unlisted = await owner.createProject({
      kind: "project",
      title: "Unlisted project",
      slug: "unlisted-project",
      content: "Direct link only",
      repository: "https://github.com/example/unlisted",
      visibility: "unlisted",
    });

    expect((await anonymous.getProjectBySlug({ slug: "unlisted-project" })).data.id).toBe(
      unlisted.id,
    );
    expect((await anonymous.listProjects({})).data.map((project) => project.id)).not.toContain(
      unlisted.id,
    );
    expect((await member.listProjects({})).data.map((project) => project.id)).not.toContain(
      unlisted.id,
    );
    expect((await owner.listProjects({})).data.map((project) => project.id)).not.toContain(
      unlisted.id,
    );
    expect(
      (await owner.listProjects({ ownerId: "owner.near" })).data.map((project) => project.id),
    ).toContain(unlisted.id);
  });
});

describe("project identity fields", () => {
  const runtime = createPluginRuntime({ registry: { projects: { module: Plugin } } });
  let dataDir: string;
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"projects">>>;

  const ownerClient = () =>
    loaded.createClient({
      userId: "owner-user",
      near: testNear("owner.near"),
      user: testUser("owner-user", "member"),
    });

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-projects-identity-"));
    loaded = await runtime.usePlugin("projects", {
      variables: {},
      secrets: { PROJECTS_DATABASE_URL: `pglite:${dataDir}` },
    });
    const owner = ownerClient();
    await owner.createProject({
      kind: "idea",
      title: "Plain idea",
      slug: "plain-idea",
      content: "Idea content",
      visibility: "public",
    });
    await owner.createProject({
      kind: "project",
      title: "Hidden product",
      slug: "hidden-product",
      repository: "https://github.com/example/hidden",
      domain: "hidden.example.com",
      content: "Hidden",
      visibility: "private",
    });
    await owner.createProject({
      kind: "project",
      title: "Listed product",
      slug: "listed-product",
      repository: "https://github.com/example/listed",
      domain: "listed.example.com",
      visibility: "public",
    });
    for (let index = 0; index < 30; index += 1) {
      await owner.createProject({
        kind: "idea",
        title: `Batch ${index}`,
        slug: `batch-${String(index).padStart(2, "0")}`,
        content: "Batch content",
        visibility: "public",
      });
    }
  }, 120_000);

  afterAll(async () => {
    await runtime.shutdown();
    await rm(dataDir, { recursive: true, force: true });
  }, 30_000);

  it("requires a hostname when creating a project and stores it", async () => {
    const owner = ownerClient();
    await expect(
      owner.createProject({
        kind: "project",
        title: "Missing domain",
        slug: "missing-domain",
        repository: "https://github.com/example/missing",
      }),
    ).rejects.toThrow(/domain/i);

    await expect(
      owner.createProject({
        kind: "project",
        title: "Schemed domain",
        slug: "schemed-domain",
        repository: "https://github.com/example/schemed",
        domain: "https://app.example.com/start",
      }),
    ).rejects.toThrow(/hostname/i);

    const created = await owner.createProject({
      kind: "project",
      title: "Live product",
      slug: "live-product",
      repository: "https://github.com/example/live",
      domain: "app.example.com",
      logoUrl: "https://cdn.example.com/logo.png",
    });
    expect(created).toMatchObject({
      domain: "app.example.com",
      logoUrl: "https://cdn.example.com/logo.png",
    });

    const read = await loaded.createClient().getProject({ id: created.id });
    expect(read.data).toMatchObject({
      domain: "app.example.com",
      logoUrl: "https://cdn.example.com/logo.png",
    });
  });

  it("lets ideas omit a domain and keeps a null domain readable", async () => {
    const idea = await loaded.createClient().getProjectBySlug({ slug: "plain-idea" });
    expect(idea.data).toMatchObject({ kind: "idea", domain: null, logoUrl: null });
  });

  it("rejects project updates that would leave the product domain empty", async () => {
    const owner = ownerClient();
    const created = await owner.createProject({
      kind: "project",
      title: "Editable product",
      slug: "editable-product",
      repository: "https://github.com/example/editable",
      domain: "edit.example.com",
    });

    await expect(owner.updateProject({ id: created.id, domain: "" })).rejects.toThrow(/domain/i);
    await expect(
      owner.updateProject({ id: created.id, domain: "edit.example.com/docs" }),
    ).rejects.toThrow(/hostname/i);

    const renamed = await owner.updateProject({ id: created.id, title: "Renamed product" });
    expect(renamed.domain).toBe("edit.example.com");
  });

  it("round-trips, updates, and clears logo URLs", async () => {
    const owner = ownerClient();
    const created = await owner.createProject({
      kind: "idea",
      title: "Logo idea",
      slug: "logo-idea",
      content: "Logo content",
      logoUrl: "https://cdn.example.com/first.png",
    });
    expect(created.logoUrl).toBe("https://cdn.example.com/first.png");

    const updated = await owner.updateProject({
      id: created.id,
      logoUrl: "http://cdn.example.com/second.png",
    });
    expect(updated.logoUrl).toBe("http://cdn.example.com/second.png");

    const cleared = await owner.updateProject({ id: created.id, logoUrl: "" });
    expect(cleared.logoUrl).toBeNull();
    expect((await loaded.createClient().getProject({ id: created.id })).data.logoUrl).toBeNull();

    await expect(
      owner.updateProject({ id: created.id, logoUrl: "ftp://cdn.example.com/logo.png" }),
    ).rejects.toThrow(/validation failed/i);
    await expect(
      owner.updateProject({
        id: created.id,
        logoUrl: `https://cdn.example.com/${"a".repeat(2000)}`,
      }),
    ).rejects.toThrow();
  });

  it("returns slug batches in request order and omits unknown or private rows", async () => {
    const anonymous = loaded.createClient();
    const owner = ownerClient();
    const requested = ["batch-02", "missing-slug", "batch-00", "batch-02", "hidden-product"];

    const listed = await anonymous.listProjects({ slugs: ` ${requested.join(", ")} ` });
    expect(listed.data.map((project) => project.slug)).toEqual(["batch-02", "batch-00"]);
    expect(listed.meta).toMatchObject({ total: 2, hasMore: false, nextCursor: null });

    const visibleToOwner = await owner.listProjects({
      slugs: "hidden-product,batch-00",
    });
    expect(visibleToOwner.data.map((project) => project.slug)).toEqual([
      "hidden-product",
      "batch-00",
    ]);

    const projectsOnly = await anonymous.listProjects({
      slugs: "hidden-product,listed-product,batch-00",
      kind: "project",
    });
    expect(projectsOnly.data.map((project) => project.slug)).toEqual(["listed-product"]);

    const ignoredCursor = await anonymous.listProjects({
      slugs: "batch-01,batch-00",
      cursor: "100",
    });
    expect(ignoredCursor.data.map((project) => project.slug)).toEqual(["batch-01", "batch-00"]);
  });

  it("rejects invalid slug batches", async () => {
    const anonymous = loaded.createClient();
    await expect(anonymous.listProjects({ slugs: "Bad_Slug" })).rejects.toThrow(/slug/i);
    await expect(
      anonymous.listProjects({
        slugs: Array.from({ length: 101 }, (_, index) => `batch-${index}`).join(","),
      }),
    ).rejects.toThrow(/100/);
  });

  it("coerces limit and does not page a slug batch down to 24", async () => {
    const anonymous = loaded.createClient();
    const slugs = Array.from(
      { length: 30 },
      (_, index) => `batch-${String(index).padStart(2, "0")}`,
    );

    const all = await anonymous.listProjects({ slugs: slugs.join(",") });
    expect(all.data).toHaveLength(30);
    expect(all.meta).toMatchObject({ total: 30, hasMore: false, nextCursor: null });
    expect(all.data.map((project) => project.slug)).toEqual(slugs);

    const limited = await anonymous.listProjects({ slugs: slugs.join(","), limit: 5 });
    expect(limited.data).toHaveLength(5);
    expect(limited.data.map((project) => project.slug)).toEqual(slugs.slice(0, 5));
    expect(limited.meta).toMatchObject({ total: 30, hasMore: false, nextCursor: null });

    const page = await anonymous.listProjects({ limit: 5 });
    expect(page.data).toHaveLength(5);
    expect(page.meta.total).toBeGreaterThan(5);

    const one = await anonymous.listProjects({ limit: 1 });
    expect(one.data).toHaveLength(1);

    const hundred = await anonymous.listProjects({ limit: 100 });
    expect(hundred.data.length).toBe(hundred.meta.total);
    expect(hundred.data.length).toBeLessThanOrEqual(100);

    const coerced = await anonymous.listProjects({ limit: "5" as unknown as number });
    expect(coerced.data).toHaveLength(5);

    await expect(anonymous.listProjects({ limit: 0 })).rejects.toThrow();
    await expect(anonymous.listProjects({ limit: -1 })).rejects.toThrow();
    await expect(anonymous.listProjects({ limit: 101 })).rejects.toThrow();
    await expect(anonymous.listProjects({ limit: "nope" as unknown as number })).rejects.toThrow();
  });
});
