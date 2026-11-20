import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginRuntime } from "every-plugin";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import Plugin from "../index";
import { assertHostIsPublic, probeStatusCheck } from "../services/status-probe";
import { evaluateFailure, evaluateResponse } from "../services/status-state";
import { StatusBlockedError } from "../services/status-url";

vi.mock("../services/status-probe", () => ({
  probeStatusCheck: vi.fn(),
  assertHostIsPublic: vi.fn(async () => undefined),
}));

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
    "0011_project_status_checks.sql",
  ];
  const timestamps = [
    1778189697079, 1778192982329, 1778251917340, 1778260000000, 1778515758620, 1749700000000,
    1781818000000, 1781900000000, 1782000000000, 1793000000000, 1794000000000, 1795000000000,
  ];
  const sources = await Promise.all(
    files.map((file) => readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8")),
  );
  return {
    default: sources.map((source, index) => ({
      idx: index,
      when: timestamps[index],
      hash: `status-test-${index}`,
      tag: files[index],
      sql: source.split("--> statement-breakpoint").map((statement) => statement.trim()),
    })),
  };
});

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

const healthy = evaluateResponse("everything-dev-health", {
  httpStatus: 200,
  body: JSON.stringify({ status: "ready", ssr: { status: "ready" }, failures: [] }),
  latencyMs: 400,
});

const day = 24 * 60 * 60 * 1000;

describe("project status checks", () => {
  const runtime = createPluginRuntime({ registry: { projects: { module: Plugin } } });
  let dataDir: string;
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"projects">>>;
  let admin: ReturnType<typeof loaded.createClient>;
  let member: ReturnType<typeof loaded.createClient>;
  let anonymous: ReturnType<typeof loaded.createClient>;
  let owner: ReturnType<typeof loaded.createClient>;
  let publicProjectId: string;
  let privateProjectId: string;

  const check = (url: string, projectId = publicProjectId) => ({
    projectId,
    label: "Web",
    url,
    kind: "everything-dev-health" as const,
  });

  async function createProject(slug: string, visibility: "public" | "private") {
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
    dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-status-plugin-"));
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
    owner = loaded.createClient({
      userId: "owner-user",
      near: testNear("owner.near"),
      user: testUser("owner-user", "member"),
      allowPublicVisibility: true,
    });
    anonymous = loaded.createClient();
    publicProjectId = await createProject("status-project", "public");
    privateProjectId = await createProject("status-private", "private");
  }, 30_000);

  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(probeStatusCheck).mockReset();
    vi.mocked(assertHostIsPublic).mockReset();
    vi.mocked(assertHostIsPublic).mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await runtime.shutdown();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("is admin-only", async () => {
    const created = await admin.createStatusCheck(check("https://admin-only.example.com/health"));

    for (const client of [member, anonymous]) {
      const message = client === member ? "Admin access required" : "Authentication required";
      await expect(client.adminListStatusChecks({})).rejects.toThrow(message);
      await expect(
        client.createStatusCheck(check("https://other.example.com/health")),
      ).rejects.toThrow(message);
      await expect(client.updateStatusCheck({ id: created.id, status: "listed" })).rejects.toThrow(
        message,
      );
      await expect(client.deleteStatusCheck({ id: created.id })).rejects.toThrow(message);
      await expect(client.runStatusCheck({ id: created.id })).rejects.toThrow(message);
      await expect(client.seedStatusChecks({})).rejects.toThrow(message);
    }

    await admin.deleteStatusCheck({ id: created.id });
  });

  it("creates checks as drafts and lets admins list, edit and remove them", async () => {
    const created = await admin.createStatusCheck(check("https://draft.example.com/health"));
    expect(created).toMatchObject({
      status: "draft",
      currentState: "unknown",
      latest: null,
      createdBy: "admin.near",
      project: { id: publicProjectId, slug: "status-project" },
    });

    const listed = await admin.updateStatusCheck({
      id: created.id,
      status: "listed",
      label: "API",
      kind: "ping",
    });
    expect(listed).toMatchObject({ status: "listed", label: "API", kind: "ping" });

    const forProject = await admin.adminListStatusChecks({ projectId: publicProjectId });
    expect(forProject.data.map((row) => row.id)).toContain(created.id);

    await expect(admin.deleteStatusCheck({ id: created.id })).resolves.toEqual({ id: created.id });
    await expect(admin.deleteStatusCheck({ id: created.id })).rejects.toThrow(
      "Status check not found",
    );
  });

  it("rejects URLs that aren't public https, on save", async () => {
    for (const url of [
      "http://plain.example.com/health",
      "https://user:pw@creds.example.com/health",
      "https://query.example.com/health?key=1",
      "https://port.example.com:8080/health",
    ]) {
      await expect(admin.createStatusCheck(check(url))).rejects.toThrow();
    }
    await expect(admin.createStatusCheck(check("https://127.0.0.1/health"))).rejects.toThrow(
      "public host",
    );

    vi.mocked(assertHostIsPublic).mockRejectedValueOnce(new StatusBlockedError("blocked"));
    await expect(
      admin.createStatusCheck(check("https://rebind.example.com/health")),
    ).rejects.toThrow("public host");
    expect(assertHostIsPublic).toHaveBeenCalledWith("rebind.example.com");

    const created = await admin.createStatusCheck(check("https://edit.example.com/health"));
    vi.mocked(assertHostIsPublic).mockRejectedValueOnce(new StatusBlockedError("blocked"));
    await expect(
      admin.updateStatusCheck({ id: created.id, url: "https://internal.example.com/health" }),
    ).rejects.toThrow("public host");
    await admin.deleteStatusCheck({ id: created.id });
  });

  it("only lists checks on listable projects, once per URL, five per project", async () => {
    await expect(
      admin.createStatusCheck({
        ...check("https://private.example.com/health", privateProjectId),
        status: "listed",
      }),
    ).rejects.toThrow("non-private projects");

    const first = await admin.createStatusCheck({
      ...check("https://dupe.example.com/health"),
      status: "listed",
    });
    await expect(
      admin.createStatusCheck({ ...check("https://dupe.example.com/health"), status: "listed" }),
    ).rejects.toThrow("Another listed status check");

    const extra = [];
    for (let index = 0; index < 4; index += 1) {
      extra.push(await admin.createStatusCheck(check(`https://cap-${index}.example.com/health`)));
    }
    await expect(
      admin.createStatusCheck(check("https://cap-over.example.com/health")),
    ).rejects.toThrow("at most 5");

    for (const row of [first, ...extra]) await admin.deleteStatusCheck({ id: row.id });
  });

  it("records results, shows one failure as degraded and two as down, and rate limits runs", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = new Date("2026-11-12T10:00:00Z");
    vi.setSystemTime(start);
    const created = await admin.createStatusCheck({
      ...check("https://flaky.example.com/health"),
      status: "listed",
    });

    vi.mocked(probeStatusCheck).mockResolvedValue(evaluateFailure("timeout", 10_000));
    const first = await admin.runStatusCheck({ id: created.id });
    expect(first.latest).toMatchObject({ state: "degraded", reason: "timeout" });
    expect(first.currentState).toBe("degraded");
    expect(probeStatusCheck).toHaveBeenCalledWith(
      "everything-dev-health",
      "https://flaky.example.com/health",
    );

    await expect(admin.runStatusCheck({ id: created.id })).rejects.toThrow(
      "less than a minute ago",
    );

    vi.setSystemTime(new Date(start.getTime() + 61_000));
    const second = await admin.runStatusCheck({ id: created.id });
    expect(second.latest).toMatchObject({ state: "down", reason: "timeout" });

    vi.mocked(probeStatusCheck).mockResolvedValue(healthy);
    vi.setSystemTime(new Date(start.getTime() + 122_000));
    const third = await admin.runStatusCheck({ id: created.id });
    expect(third.latest).toMatchObject({ state: "up", reason: null, latencyMs: 400 });
    expect(Object.keys(third.latest ?? {}).sort()).toEqual([
      "checkedAt",
      "httpStatus",
      "latencyMs",
      "pluginKeys",
      "reason",
      "state",
    ]);

    await admin.deleteStatusCheck({ id: created.id });
  });

  it("prunes results older than seven days before each run", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = new Date("2026-11-01T10:00:00Z");
    vi.setSystemTime(start);
    vi.mocked(probeStatusCheck).mockResolvedValue(evaluateFailure("http_5xx", 30));
    const created = await admin.createStatusCheck({
      ...check("https://history.example.com/health"),
      status: "listed",
    });
    expect((await admin.runStatusCheck({ id: created.id })).latest?.state).toBe("degraded");

    vi.setSystemTime(new Date(start.getTime() + 61_000));
    expect((await admin.runStatusCheck({ id: created.id })).latest?.state).toBe("down");

    vi.setSystemTime(new Date(start.getTime() + 8 * day));
    const afterPrune = await admin.runStatusCheck({ id: created.id });
    expect(afterPrune.latest).toMatchObject({
      state: "degraded",
      checkedAt: new Date(start.getTime() + 8 * day).toISOString(),
    });

    vi.setSystemTime(new Date(start.getTime() + 14 * day));
    expect((await admin.runStatusCheck({ id: created.id })).latest?.state).toBe("down");

    await admin.deleteStatusCheck({ id: created.id });
  });

  it("removes checks when their project is deleted", async () => {
    const doomedId = await createProject("status-doomed", "public");
    const created = await admin.createStatusCheck(
      check("https://doomed.example.com/health", doomedId),
    );
    await owner.deleteProject({ id: doomedId });
    const all = await admin.adminListStatusChecks({});
    expect(all.data.map((row) => row.id)).not.toContain(created.id);
  });

  it("seeds checks for the NB projects that exist and reports the rest", async () => {
    await owner.createProject({
      kind: "project",
      title: "nearbuilders.org",
      slug: "nearbuilders-org-6qx6jv",
      repository: "https://github.com/example/nearbuilders",
      domain: "nearbuilders.example.com",
      visibility: "public",
    });
    const first = await admin.seedStatusChecks({});
    expect(first.created).toBe(1);
    expect(first.existing).toBe(0);
    expect(first.missing).toContain("citynode-app");
    expect(first.missing).not.toContain("nearbuilders-org-6qx6jv");

    const seeded = (await admin.adminListStatusChecks({})).data.find(
      (row) => row.url === "https://nearbuilders.org/health",
    );
    expect(seeded).toMatchObject({
      status: "listed",
      kind: "everything-dev-health",
      label: "nearbuilders.org",
    });

    const again = await admin.seedStatusChecks({});
    expect(again).toMatchObject({ created: 0, existing: 1 });
  });
});
