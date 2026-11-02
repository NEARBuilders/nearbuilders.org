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
  const files = ["0000_unknown_nighthawk.sql", "0001_jittery_terrax.sql", "0002_light_stryfe.sql"];
  const sources = await Promise.all(
    files.map((file) => readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8")),
  );
  return {
    default: sources.map((source, index) => ({
      idx: index,
      when: 1778000000000 + index,
      hash: `events-test-${index}`,
      tag: files[index],
      sql: source.split("--> statement-breakpoint").map((statement) => statement.trim()),
    })),
  };
});

describe("event moderation permissions", () => {
  const runtime = createPluginRuntime({ registry: { events: { module: Plugin } } });
  let dataDir: string;
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"events">>>;
  let eventId: string;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-events-plugin-"));
    loaded = await runtime.usePlugin("events", {
      variables: {},
      secrets: { EVENTS_DATABASE_URL: `pglite:${dataDir}`, LUMA_CALENDAR_API_KEYS: "" },
    });
    const owner = loaded.createClient({
      userId: "owner-user",
      near: testNear("owner.near"),
      user: testUser("owner-user", "member"),
    });
    const event = await owner.createEvent({
      title: "Private event",
      slug: "private-event",
      visibility: "private",
      startAt: "2026-08-01T12:00:00.000Z",
    });
    eventId = event.id;
  }, 30_000);

  afterAll(async () => {
    await runtime.shutdown();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("allows admin inspection but only reviewed lifecycle updates", async () => {
    const admin = loaded.createClient({
      userId: "admin-user",
      near: testNear("admin.near"),
      user: testUser("admin-user", "admin"),
    });

    expect((await admin.getEvent({ id: eventId })).data.visibility).toBe("private");
    await expect(admin.updateEvent({ id: eventId, title: "Admin edit" })).rejects.toThrow(
      "Event not found",
    );

    const applied = await admin.applyReviewedEvent({
      id: eventId,
      ownerId: "owner.near",
      title: "Approved event",
      content: "Approved content",
      visibility: "public",
    });

    expect(applied).toMatchObject({
      id: eventId,
      ownerId: "owner.near",
      title: "Approved event",
      content: "Approved content",
      visibility: "public",
    });
  });

  it("keeps member-created events private until reviewed", async () => {
    const member = loaded.createClient({
      userId: "member-user",
      near: testNear("member.near"),
      user: testUser("member-user", "member"),
    });
    const created = await member.createEvent({
      title: "Member event",
      slug: "member-event",
      visibility: "public",
      startAt: "2026-08-02T12:00:00.000Z",
    });
    expect(created.visibility).toBe("private");
    await expect(member.updateEvent({ id: created.id, visibility: "public" })).rejects.toThrow(
      "requires admin approval",
    );
    const renamed = await member.updateEvent({ id: created.id, title: "Renamed event" });
    expect(renamed.visibility).toBe("private");

    const withoutNear = loaded.createClient({
      userId: "plain-user",
      user: testUser("plain-user", "member"),
    });
    await expect(
      withoutNear.createEvent({
        title: "No account",
        slug: "no-account",
        startAt: "2026-08-03T12:00:00.000Z",
      }),
    ).rejects.toThrow("Link a NEAR account");

    await expect(
      member.createEvent({
        id: eventId,
        title: "Copy",
        slug: "copy-event",
        startAt: "2026-08-04T12:00:00.000Z",
      }),
    ).rejects.toThrow("already exists");
    const ownerRetry = await loaded
      .createClient({
        userId: "owner-user",
        near: testNear("owner.near"),
        user: testUser("owner-user", "member"),
      })
      .createEvent({
        id: eventId,
        title: "Retry",
        slug: "retry-event",
        startAt: "2026-08-04T12:00:00.000Z",
      });
    expect(ownerRetry.id).toBe(eventId);
  });
});

describe("re-keying user-id rows once NEAR is linked (#366)", () => {
  const runtime = createPluginRuntime({ registry: { events: { module: Plugin } } });
  let dataDir: string;
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"events">>>;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-events-rekey-"));
    loaded = await runtime.usePlugin("events", {
      variables: {},
      secrets: { EVENTS_DATABASE_URL: `pglite:${dataDir}`, LUMA_CALENDAR_API_KEYS: "" },
    });
  }, 30_000);

  afterAll(async () => {
    await runtime.shutdown();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("moves a participation joined without NEAR onto the account", async () => {
    const owner = loaded.createClient({
      userId: "rekey-owner",
      near: testNear("rekey-owner.near"),
      user: testUser("rekey-owner", "member"),
    });
    const event = await owner.createEvent({
      title: "Rekey event",
      slug: "rekey-event",
      visibility: "unlisted",
      startAt: "2026-08-04T12:00:00.000Z",
    });
    await loaded
      .createClient({ userId: "gil-user", user: testUser("gil-user", "member") })
      .joinEvent({ eventId: event.id });
    await loaded
      .createClient({
        userId: "gil-user",
        near: testNear("gil.near"),
        user: testUser("gil-user", "member"),
      })
      .joinEvent({ eventId: event.id });

    const participants = await owner.listEventParticipants({ eventId: event.id });
    // One participation, now keyed on the account rather than the user id.
    expect(participants.data.map((p) => p.userId)).toEqual(["gil.near"]);
  });
});
