import { mkdtemp, rm } from "node:fs/promises";
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
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../db/migrations/0000_concerned_blade.sql", import.meta.url),
    "utf8",
  );
  return {
    default: [
      {
        hash: "proposals-private-test",
        tag: "proposals-private-test",
        sql: source.split("--> statement-breakpoint").map((statement) => statement.trim()),
      },
    ],
  };
});

describe.sequential("Proposals plugin", () => {
  const runtime = createPluginRuntime({ registry: { proposals: { module: Plugin } } });
  let dataDir: string;
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"proposals">>>;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-proposals-plugin-"));
    loaded = await runtime.usePlugin("proposals", {
      variables: { privatePluginIds: ["nearcatalog"] },
      secrets: { PROPOSALS_DATABASE_URL: `pglite:${dataDir}` },
    });

    await loaded
      .createClient({
        userId: "user-alice",
        near: testNear("alice.near"),
        user: testUser("user-alice", "member"),
        allowPrivateSubmission: true,
        resubmissionPolicy: "rejected-only",
      })
      .propose({
        pluginId: "nearcatalog",
        entityId: "claim:alice.near:ref-finance",
        payload: { roles: ["Developer"] },
        idempotencyKey: "alice-private-base",
      });
    await loaded
      .createClient({
        userId: "user-bob",
        near: testNear("bob.near"),
        user: testUser("user-bob", "member"),
        allowPrivateSubmission: true,
        resubmissionPolicy: "rejected-only",
      })
      .propose({
        pluginId: "nearcatalog",
        entityId: "claim:bob.near:ref-finance",
        payload: { roles: ["Designer"] },
        idempotencyKey: "bob-private-base",
      });
    await loaded
      .createClient({
        userId: "user-alice",
        near: testNear("alice.near"),
        user: testUser("user-alice", "member"),
      })
      .propose({
        pluginId: "builders",
        entityId: "public-builder.near",
        payload: { name: "Public Builder" },
        idempotencyKey: "public-base",
      });
  });

  afterAll(async () => {
    await runtime.shutdown();
    await rm(dataDir, { recursive: true, force: true });
  });

  function aliceClient() {
    return loaded.createClient({
      userId: "user-alice",
      near: testNear("alice.near"),
      user: testUser("user-alice", "member"),
      allowPrivateSubmission: true,
      resubmissionPolicy: "rejected-only",
    });
  }

  function bobClient() {
    return loaded.createClient({
      userId: "user-bob",
      near: testNear("bob.near"),
      user: testUser("user-bob", "member"),
      allowPrivateSubmission: true,
      resubmissionPolicy: "rejected-only",
    });
  }

  function restorableAliceClient() {
    return loaded.createClient({
      userId: "user-alice",
      near: testNear("alice.near"),
      user: testUser("user-alice", "member"),
      allowPrivateSubmission: true,
      resubmissionPolicy: "rejected-or-removed",
    });
  }

  function adminClient() {
    return loaded.createClient({
      userId: "admin",
      near: testNear("admin.near"),
      user: testUser("admin", "admin"),
    });
  }

  it("scopes private data to owners while retaining public reads and admin moderation", async () => {
    const anonymous = loaded.createClient();
    const privateInput = { pluginId: "nearcatalog", limit: 100 };

    const anonymousPrivate = await anonymous.getProposals(privateInput);
    const alicePrivate = await aliceClient().getProposals(privateInput);
    const bobPrivate = await bobClient().getProposals(privateInput);
    const adminPrivate = await adminClient().getProposals(privateInput);
    const anonymousAll = await anonymous.getProposals({ limit: 100 });

    expect(anonymousPrivate.data).toEqual([]);
    expect(alicePrivate.data.map((proposal) => proposal.createdBy)).toEqual(["alice.near"]);
    expect(bobPrivate.data.map((proposal) => proposal.createdBy)).toEqual(["bob.near"]);
    expect(adminPrivate.data).toHaveLength(2);
    expect(anonymousAll.data.map((proposal) => proposal.pluginId)).toEqual(["builders"]);

    const entityId = "claim:alice.near:ref-finance";
    const anonymousAudit = await anonymous.getAuditLog({ pluginId: "nearcatalog", entityId });
    const bobAudit = await bobClient().getAuditLog({ pluginId: "nearcatalog", entityId });
    const aliceAudit = await aliceClient().getAuditLog({ pluginId: "nearcatalog", entityId });
    const adminAudit = await adminClient().getAuditLog({ pluginId: "nearcatalog", entityId });
    const bobCount = await bobClient().getProposalCount({ pluginId: "nearcatalog", entityId });
    const aliceCount = await aliceClient().getProposalCount({
      pluginId: "nearcatalog",
      entityId,
    });

    expect(anonymousAudit.data).toEqual([]);
    expect(bobAudit.data).toEqual([]);
    expect(aliceAudit.data).toHaveLength(1);
    expect(adminAudit.data).toHaveLength(1);
    expect(bobCount.totalCount).toBe(0);
    expect(aliceCount.totalCount).toBe(1);

    const input = {
      pluginId: "nearcatalog",
      entityId: "claim:alice.near:admin-review",
      payload: { roles: ["Product"] },
      idempotencyKey: "admin-review",
    };
    const directClient = loaded.createClient({
      userId: "user-alice",
      near: testNear("alice.near"),
      user: testUser("user-alice", "member"),
    });
    await expect(directClient.propose(input)).rejects.toThrow(
      "Use the plugin's dedicated proposal endpoint",
    );
    await aliceClient().propose(input);

    await expect(
      aliceClient().reject({ pluginId: input.pluginId, entityId: input.entityId }),
    ).rejects.toThrow("Admin access required");

    const rejected = await adminClient().reject({
      pluginId: input.pluginId,
      entityId: input.entityId,
      reason: "Add another role",
    });

    expect(rejected.data.reviewStatus).toBe("rejected");
    expect(rejected.data.rejectionReason).toBe("Add another role");
  });

  it("keeps retries idempotent and only permits rejected proposal revisions", async () => {
    const input = {
      pluginId: "nearcatalog",
      entityId: "claim:alice.near:idempotent-project",
      payload: { roles: ["Developer"] },
      idempotencyKey: "idempotent-submission",
    };

    const first = await aliceClient().propose(input);
    const retry = await aliceClient().propose(input);

    expect(retry.data.id).toBe(first.data.id);
    expect(retry.data.submissionCount).toBe(1);
    await expect(
      aliceClient().propose({ ...input, idempotencyKey: "pending-revision" }),
    ).rejects.toThrow("This proposal is already pending");
    await expect(
      bobClient().propose({ ...input, entityId: "claim:bob.near:idempotent-project" }),
    ).rejects.toThrow("Idempotency key was already used");

    await adminClient().reject({
      pluginId: "nearcatalog",
      entityId: input.entityId,
      reason: "Clarify the contribution",
    });

    const resubmitted = await aliceClient().propose({
      ...input,
      payload: { roles: ["Developer", "Community"] },
      idempotencyKey: "rejected-revision",
    });

    expect(resubmitted.data.id).toBe(first.data.id);
    expect(resubmitted.data.reviewStatus).toBe("pending");
    expect(resubmitted.data.rejectionReason).toBeNull();
    expect(resubmitted.data.submissionCount).toBe(2);
    expect(resubmitted.data.payload).toEqual({ roles: ["Developer", "Community"] });

    await adminClient().approve({ pluginId: input.pluginId, entityId: input.entityId });
    await expect(
      aliceClient().propose({ ...input, idempotencyKey: "approved-revision" }),
    ).rejects.toThrow("This proposal is already approved");

    await adminClient().remove({ pluginId: input.pluginId, entityId: input.entityId });
    await expect(
      aliceClient().propose({ ...input, idempotencyKey: "removed-revision" }),
    ).rejects.toThrow("Removed proposals cannot be resubmitted");

    const restored = await restorableAliceClient().propose({
      ...input,
      payload: { roles: ["Maintainer"] },
      idempotencyKey: "restored-revision",
    });
    expect(restored.data).toMatchObject({
      reviewStatus: "pending",
      applyStatus: "not_started",
      removeStatus: "not_started",
      appliedResourceId: null,
      removedAt: null,
      payload: { roles: ["Maintainer"] },
    });
  });
});
