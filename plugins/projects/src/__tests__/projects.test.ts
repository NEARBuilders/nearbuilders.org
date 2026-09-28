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
    "0007_project_collaborators.sql",
  ];
  const timestamps = [
    1778189697079, 1778192982329, 1778251917340, 1778260000000, 1778515758620, 1749700000000,
    1781818000000, 1782000000000,
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

describe("project collaborators", () => {
  const runtime = createPluginRuntime({ registry: { projects: { module: Plugin } } });
  let dataDir: string;
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"projects">>>;
  let projectId: string;

  const ownerCtx = () => ({
    userId: "owner-user",
    near: testNear("owner.near"),
    user: testUser("owner-user", "member"),
  });
  const collabCtx = () => ({
    userId: "collab-user",
    near: testNear("bob.near"),
    user: testUser("collab-user", "member"),
  });

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-projects-collab-"));
    loaded = await runtime.usePlugin("projects", {
      variables: {},
      secrets: { PROJECTS_DATABASE_URL: `pglite:${dataDir}` },
    });
    const owner = loaded.createClient(ownerCtx());
    const created = await owner.createProject({
      kind: "idea",
      title: "Team idea",
      slug: "team-idea",
      content: "Team content",
      visibility: "private",
      collaborators: ["bob.near"],
    });
    projectId = created.id;
  }, 30_000);

  afterAll(async () => {
    await runtime.shutdown();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("creates pending invites on create and hides private from others", async () => {
    const owner = loaded.createClient(ownerCtx());
    const collabs = await owner.listCollaborators({ projectId });
    expect(collabs.data).toHaveLength(1);
    expect(collabs.data[0]).toMatchObject({
      collaboratorOwnerId: "bob.near",
      status: "pending",
    });

    const stranger = loaded.createClient({
      userId: "stranger",
      near: testNear("stranger.near"),
      user: testUser("stranger", "member"),
    });
    await expect(stranger.getProject({ id: projectId })).rejects.toThrow("Project not found");
  });

  it("lets invitees accept and then view/edit, and appear via collaborator filter", async () => {
    const collab = loaded.createClient(collabCtx());
    const accepted = await collab.respondCollaborator({ projectId, action: "accept" });
    expect(accepted.status).toBe("accepted");

    expect((await collab.getProject({ id: projectId })).data.id).toBe(projectId);

    const updated = await collab.updateProject({ id: projectId, title: "Team idea v2" });
    expect(updated.title).toBe("Team idea v2");

    const listed = await collab.listProjects({ collaboratorId: "bob.near" });
    expect(listed.data.map((p) => p.id)).toContain(projectId);

    await expect(
      collab.inviteCollaborator({ projectId, collaboratorOwnerId: "carol.near" }),
    ).rejects.toThrow();
  });

  it("lets owner remove collaborators and blocks collaborator delete", async () => {
    const collab = loaded.createClient(collabCtx());
    await expect(collab.deleteProject({ id: projectId })).rejects.toThrow();

    const owner = loaded.createClient(ownerCtx());
    const removed = await owner.removeCollaborator({
      projectId,
      collaboratorOwnerId: "bob.near",
    });
    expect(removed.removed).toBe(true);
    expect((await owner.listCollaborators({ projectId })).data).toHaveLength(0);
  });

  it("lets pending invitees view but not edit private projects", async () => {
    const owner = loaded.createClient(ownerCtx());
    const created = await owner.createProject({
      kind: "idea",
      title: "Pending view idea",
      slug: "pending-view-idea",
      content: "Pending view content",
      visibility: "private",
      collaborators: ["carol.near"],
    });
    const carol = loaded.createClient({
      userId: "carol-user",
      near: testNear("carol.near"),
      user: testUser("carol-user", "member"),
    });

    expect((await carol.getProject({ id: created.id })).data.id).toBe(created.id);
    await expect(carol.updateProject({ id: created.id, title: "Nope" })).rejects.toThrow(
      "permission",
    );
  });

  it("validates and lowercases collaborator handles", async () => {
    const owner = loaded.createClient(ownerCtx());
    await expect(
      owner.inviteCollaborator({ projectId, collaboratorOwnerId: "not a handle!" }),
    ).rejects.toThrow("Invalid NEAR handle");
    await expect(
      owner.inviteCollaborator({ projectId, collaboratorOwnerId: "x" }),
    ).rejects.toThrow("Invalid NEAR handle");

    const created = await owner.createProject({
      kind: "idea",
      title: "Case idea",
      slug: "case-idea",
      content: "Case content",
      visibility: "private",
      collaborators: ["DAVE.NEAR"],
    });
    const collabs = await owner.listCollaborators({ projectId: created.id });
    expect(collabs.data.map((c) => c.collaboratorOwnerId)).toEqual(["dave.near"]);

    const removed = await owner.removeCollaborator({
      projectId: created.id,
      collaboratorOwnerId: "Dave.Near",
    });
    expect(removed.removed).toBe(true);
  });

  it("returns removed:false when nothing was deleted", async () => {
    const owner = loaded.createClient(ownerCtx());
    const removed = await owner.removeCollaborator({
      projectId,
      collaboratorOwnerId: "ghost.near",
    });
    expect(removed.removed).toBe(false);
  });

  it("handles duplicate concurrent invites without errors", async () => {
    const owner = loaded.createClient(ownerCtx());
    const created = await owner.createProject({
      kind: "idea",
      title: "Race idea",
      slug: "race-idea",
      content: "Race content",
      visibility: "private",
    });
    const [first, second] = await Promise.all([
      owner.inviteCollaborator({ projectId: created.id, collaboratorOwnerId: "erin.near" }),
      owner.inviteCollaborator({ projectId: created.id, collaboratorOwnerId: "erin.near" }),
    ]);
    expect(first.id).toBe(second.id);
    expect((await owner.listCollaborators({ projectId: created.id })).data).toHaveLength(1);
  });

  it("only shows public collaborator projects to other viewers", async () => {
    const owner = loaded.createClient(ownerCtx());
    const pub = await owner.createProject({
      kind: "idea",
      title: "Shared public idea",
      slug: "shared-public-idea",
      content: "Shared public content",
      visibility: "public",
      collaborators: ["frank.near"],
    });
    const priv = await owner.createProject({
      kind: "idea",
      title: "Shared private idea",
      slug: "shared-private-idea",
      content: "Shared private content",
      visibility: "private",
      collaborators: ["frank.near"],
    });
    const frank = loaded.createClient({
      userId: "frank-user",
      near: testNear("frank.near"),
      user: testUser("frank-user", "member"),
    });
    await frank.respondCollaborator({ projectId: pub.id, action: "accept" });
    await frank.respondCollaborator({ projectId: priv.id, action: "accept" });

    const anonymous = loaded.createClient();
    const seen = await anonymous.listProjects({ collaboratorId: "frank.near" });
    expect(seen.data.map((p) => p.id)).toContain(pub.id);
    expect(seen.data.map((p) => p.id)).not.toContain(priv.id);

    const own = await frank.listProjects({ collaboratorId: "frank.near" });
    expect(own.data.map((p) => p.id)).toEqual(
      expect.arrayContaining([pub.id, priv.id]),
    );
  });

  it("lets admins delete projects", async () => {
    const owner = loaded.createClient(ownerCtx());
    const created = await owner.createProject({
      kind: "idea",
      title: "Admin delete idea",
      slug: "admin-delete-idea",
      content: "Admin delete content",
      visibility: "private",
    });
    const admin = loaded.createClient({
      userId: "admin-user",
      near: testNear("admin.near"),
      user: testUser("admin-user", "admin"),
    });
    await expect(admin.deleteProject({ id: created.id })).resolves.toEqual({ deleted: true });
    await expect(owner.getProject({ id: created.id })).rejects.toThrow("Project not found");
  });
});
