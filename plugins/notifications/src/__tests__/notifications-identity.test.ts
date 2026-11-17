import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getEventMeta } from "@orpc/server";
import { createPluginRuntime } from "every-plugin";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Plugin from "../index";

vi.mock("virtual:drizzle-migrations.sql", async () => {
  const file = "0000_cuddly_the_watchers.sql";
  const source = await readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8");
  return {
    default: [
      {
        idx: 0,
        when: 1782244582337,
        hash: "notifications-test-0",
        tag: file,
        sql: source.split("--> statement-breakpoint").map((statement) => statement.trim()),
      },
    ],
  };
});

/** The context the host API passes: `userId` rewritten to the primary account (#364). */
function caller(authUserId: string, accounts: string[]) {
  return {
    userId: accounts[0] ?? authUserId,
    user: {
      id: authUserId,
      name: authUserId,
      email: `${authUserId}@example.com`,
      emailVerified: true,
      image: null,
      role: "member",
      isAnonymous: false,
      locale: null,
    },
    near: {
      primaryAccountId: accounts[0] ?? null,
      linkedAccounts: accounts.map((accountId, index) => ({
        accountId,
        network: "mainnet",
        publicKey: "",
        isPrimary: index === 0,
      })),
      hasNearAccount: accounts.length > 0,
    },
  };
}

describe("notifications reach every linked account (#364)", () => {
  const runtime = createPluginRuntime({ registry: { notifications: { module: Plugin } } });
  let dataDir: string;
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"notifications">>>;
  const as = (authUserId: string, accounts: string[]) =>
    loaded.createClient(caller(authUserId, accounts) as never);
  const notify = (userId: string, subject: string) =>
    loaded
      .createClient({ ...caller("server", ["server.near"]), serverNotification: true } as never)
      .createNotification({ userId, type: "test", source: "test", subject, link: "/" });

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-notifications-plugin-"));
    loaded = await runtime.usePlugin("notifications", {
      variables: {},
      secrets: { NOTIFICATIONS_DATABASE_URL: `pglite:${dataDir}` },
    });
  });

  afterAll(async () => {
    await runtime.shutdown();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("lists, marks read and marks all read across primary and linked accounts", async () => {
    await notify("mo.near", "to the old primary");
    await notify("mo-alt.near", "to the linked account");
    await notify("someone-else.near", "not mine");

    const mo = as("mo-user", ["mo-alt.near", "mo.near"]);
    const unread = await mo.getMyNotifications({ read: false });
    expect(unread.data.map((n) => n.subject).sort()).toEqual([
      "to the linked account",
      "to the old primary",
    ]);

    const oldPrimary = unread.data.find((n) => n.userId === "mo.near")!;
    await expect(mo.markAsRead({ id: oldPrimary.id })).resolves.toMatchObject({
      data: { read: true },
    });
    await expect(mo.markAllAsRead()).resolves.toEqual({ updated: 1 });
    expect((await mo.getMyNotifications({ read: false })).data).toEqual([]);

    const stranger = as("stranger-user", ["stranger.near"]);
    await expect(stranger.markAsRead({ id: oldPrimary.id })).rejects.toThrow();
  });

  it("lets a caller notify any of their own accounts, but not someone else", async () => {
    const mo = as("mo-user", ["mo-alt.near", "mo.near"]);
    const create = (userId: string) =>
      mo.createNotification({ userId, type: "test", source: "test", subject: "self", link: "/" });
    await expect(create("mo.near")).resolves.toMatchObject({ data: { userId: "mo.near" } });
    await expect(create("mo-user")).resolves.toMatchObject({ data: { userId: "mo-user" } });
    await expect(create("someone-else.near")).rejects.toThrow();
  });

  it("still reaches callers without NEAR by their user id", async () => {
    await notify("plain-user", "user-id addressed");
    const plain = as("plain-user", []);
    expect((await plain.getMyNotifications({})).data.map((n) => n.subject)).toEqual([
      "user-id addressed",
    ]);
  });
});

describe("notification streams are bounded (#364)", () => {
  const runtime = createPluginRuntime({ registry: { notifications: { module: Plugin } } });
  let dataDir: string;
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"notifications">>>;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-notifications-stream-"));
    loaded = await runtime.usePlugin("notifications", {
      variables: { streamMaxAgeMs: 1_500 },
      secrets: { NOTIFICATIONS_DATABASE_URL: `pglite:${dataDir}` },
    });
  });

  afterAll(async () => {
    await runtime.shutdown();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("delivers the caller's notifications, then ends so the client reconnects with fresh ids", async () => {
    const mo = loaded.createClient(caller("mo-user", ["mo-alt.near", "mo.near"]) as never);
    const server = loaded.createClient({
      ...caller("server", ["server.near"]),
      serverNotification: true,
    } as never);
    const stream = await mo.subscribeNotifications();
    const received: string[] = [];
    let lastEventId: string | undefined;
    const done = (async () => {
      for await (const event of stream) {
        received.push(event.subject);
        lastEventId = getEventMeta(event)?.id;
      }
    })();
    await new Promise((resolve) => setTimeout(resolve, 50));
    for (const userId of ["someone-else.near", "mo-alt.near"]) {
      await server.createNotification({
        userId,
        type: "test",
        source: "test",
        subject: userId,
        link: "/",
      });
    }
    await expect(done).resolves.toBeUndefined();
    expect(received).toEqual(["mo-alt.near"]);

    // Sent while disconnected: the reconnect resumes after the last event and still gets it.
    await server.createNotification({
      userId: "mo.near",
      type: "test",
      source: "test",
      subject: "while away",
      link: "/",
    });
    expect(lastEventId).toBeDefined();
    const resumed = await mo.subscribeNotifications(undefined, { lastEventId });
    const next = await resumed.next();
    expect(next.value).toMatchObject({ subject: "while away" });
    await resumed.return?.();
  });
});
