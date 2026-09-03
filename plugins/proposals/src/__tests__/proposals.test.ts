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
        idx: 0,
        when: 1780344361156,
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
    const proposed = await aliceClient().propose(input);

    await expect(
      aliceClient().reject({
        pluginId: input.pluginId,
        entityId: input.entityId,
        expectedUpdatedAt: proposed.data.updatedAt,
      }),
    ).rejects.toThrow("Admin access required");

    const rejected = await adminClient().reject({
      pluginId: input.pluginId,
      entityId: input.entityId,
      expectedUpdatedAt: proposed.data.updatedAt,
      reason: "Add another role",
    });

    expect(rejected.data.reviewStatus).toBe("rejected");
    expect(rejected.data.rejectionReason).toBe("Add another role");
  });

  it("recognizes authenticated submission aliases without exposing submissions", async () => {
    await expect(
      loaded.createClient().getMySubmission({
        pluginId: "builders",
        entityId: "public-builder.near",
      }),
    ).rejects.toThrow("Authentication required");

    await expect(
      aliceClient().getMySubmission({
        pluginId: "builders",
        entityId: "public-builder.near",
      }),
    ).resolves.toEqual({ hasSubmitted: true });
    await expect(
      bobClient().getMySubmission({
        pluginId: "builders",
        entityId: "public-builder.near",
      }),
    ).resolves.toEqual({ hasSubmitted: false });

    const legacyUser = loaded.createClient({
      userId: "legacy-user-id",
      user: testUser("legacy-user-id", "member"),
    });
    await legacyUser.propose({
      pluginId: "builders",
      entityId: "legacy-user-submission.near",
      payload: { name: "Legacy User" },
    });

    const linkedLegacyUser = loaded.createClient({
      userId: "legacy-user-id",
      near: testNear("current-wallet.near"),
      user: testUser("legacy-user-id", "member"),
    });
    await expect(
      linkedLegacyUser.getMySubmission({
        pluginId: "builders",
        entityId: "legacy-user-submission.near",
      }),
    ).resolves.toEqual({ hasSubmitted: true });

    await loaded
      .createClient({
        userId: "historical-user-id",
        near: testNear("legacy-wallet.near"),
        user: testUser("historical-user-id", "member"),
      })
      .propose({
        pluginId: "builders",
        entityId: "legacy-near-submission.near",
        payload: { name: "Legacy NEAR" },
      });
    const linkedLegacyNear = loaded.createClient({
      userId: "current-user-id",
      near: {
        ...testNear("current-wallet.near"),
        linkedAccounts: [
          {
            accountId: "legacy-wallet.near",
            network: "mainnet",
            publicKey: "legacy-public-key",
            isPrimary: false,
          },
        ],
      },
      user: testUser("current-user-id", "member"),
    });
    await expect(
      linkedLegacyNear.getMySubmission({
        pluginId: "builders",
        entityId: "legacy-near-submission.near",
      }),
    ).resolves.toEqual({ hasSubmitted: true });
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
      expectedUpdatedAt: first.data.updatedAt,
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

    const approved = await adminClient().approve({
      pluginId: input.pluginId,
      entityId: input.entityId,
      expectedUpdatedAt: resubmitted.data.updatedAt,
    });
    const applied = await adminClient().markApplied({
      pluginId: input.pluginId,
      entityId: input.entityId,
      expectedUpdatedAt: approved.data.updatedAt,
      appliedResourceId: input.entityId,
    });
    await expect(
      aliceClient().propose({ ...input, idempotencyKey: "approved-revision" }),
    ).rejects.toThrow("This proposal is already approved");

    const removing = await adminClient().remove({
      pluginId: input.pluginId,
      entityId: input.entityId,
      expectedUpdatedAt: applied.data.updatedAt,
    });
    await adminClient().markRemoved({
      pluginId: input.pluginId,
      entityId: input.entityId,
      expectedUpdatedAt: removing.data.updatedAt,
    });
    const removalAudit = await adminClient().getAuditLog({
      pluginId: input.pluginId,
      entityId: input.entityId,
    });
    expect(removalAudit.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "approval_revocation_started",
          actor: "admin",
          actorLabel: "admin",
        }),
      ]),
    );
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

  it("lets admins reopen rejected proposals and records the action", async () => {
    const input = {
      pluginId: "events",
      entityId: "reopened-review",
      payload: { title: "Reopened Review" },
      idempotencyKey: "reopened-review",
    };

    const proposed = await aliceClient().propose(input);
    const rejected = await adminClient().reject({
      pluginId: input.pluginId,
      entityId: input.entityId,
      expectedUpdatedAt: proposed.data.updatedAt,
      reason: "Needs another review",
    });

    await expect(
      aliceClient().reopen({
        pluginId: input.pluginId,
        entityId: input.entityId,
        expectedUpdatedAt: rejected.data.updatedAt,
      }),
    ).rejects.toThrow("Admin access required");

    const reopened = await adminClient().reopen({
      pluginId: input.pluginId,
      entityId: input.entityId,
      expectedUpdatedAt: rejected.data.updatedAt,
    });

    expect(reopened.data.reviewStatus).toBe("pending");
    expect(reopened.data.rejectionReason).toBeNull();

    const audit = await adminClient().getAuditLog({
      pluginId: input.pluginId,
      entityId: input.entityId,
    });
    expect(audit.data[0]).toMatchObject({
      action: "reopened",
      actor: "admin",
      actorLabel: "admin",
    });

    await expect(
      adminClient().reopen({
        pluginId: input.pluginId,
        entityId: input.entityId,
        expectedUpdatedAt: reopened.data.updatedAt,
      }),
    ).rejects.toThrow("Only rejected proposals can be reopened");
  });

  it("rejects an admin decision made against a stale proposal version", async () => {
    const input = {
      pluginId: "events",
      entityId: "stale-admin-decision",
      payload: { title: "Stale decision" },
      idempotencyKey: "stale-admin-decision",
    };
    const proposed = await aliceClient().propose(input);

    await adminClient().approve({
      pluginId: input.pluginId,
      entityId: input.entityId,
      expectedUpdatedAt: proposed.data.updatedAt,
    });

    await expect(
      adminClient().reject({
        pluginId: input.pluginId,
        entityId: input.entityId,
        expectedUpdatedAt: proposed.data.updatedAt,
      }),
    ).rejects.toThrow("This proposal changed");
  });

  it("includes pending and failed lifecycle records in the actionable queue", async () => {
    const applyInput = {
      pluginId: "builders",
      entityId: "failed-application.near",
      payload: { name: "Failed Application" },
      idempotencyKey: "failed-application",
    };
    const proposedApply = await aliceClient().propose(applyInput);
    const approvedApply = await adminClient().approve({
      pluginId: applyInput.pluginId,
      entityId: applyInput.entityId,
      expectedUpdatedAt: proposedApply.data.updatedAt,
    });
    await adminClient().markApplyFailed({
      pluginId: applyInput.pluginId,
      entityId: applyInput.entityId,
      expectedUpdatedAt: approvedApply.data.updatedAt,
      error: "Publish failed",
    });

    const removeInput = {
      pluginId: "builders",
      entityId: "failed-removal.near",
      payload: { name: "Failed Removal" },
      idempotencyKey: "failed-removal",
    };
    const proposedRemove = await aliceClient().propose(removeInput);
    const approvedRemove = await adminClient().approve({
      pluginId: removeInput.pluginId,
      entityId: removeInput.entityId,
      expectedUpdatedAt: proposedRemove.data.updatedAt,
    });
    const appliedRemove = await adminClient().markApplied({
      pluginId: removeInput.pluginId,
      entityId: removeInput.entityId,
      expectedUpdatedAt: approvedRemove.data.updatedAt,
      appliedResourceId: removeInput.entityId,
    });
    const removing = await adminClient().remove({
      pluginId: removeInput.pluginId,
      entityId: removeInput.entityId,
      expectedUpdatedAt: appliedRemove.data.updatedAt,
    });
    await adminClient().markRemoveFailed({
      pluginId: removeInput.pluginId,
      entityId: removeInput.entityId,
      expectedUpdatedAt: removing.data.updatedAt,
      error: "Removal failed",
    });

    const actionable = await adminClient().getProposals({
      pluginId: "builders",
      lifecycleStatus: "actionable",
      limit: 100,
    });

    expect(actionable.data.map((proposal) => proposal.entityId)).toEqual(
      expect.arrayContaining(["public-builder.near", applyInput.entityId, removeInput.entityId]),
    );
    expect(
      actionable.data.every(
        (proposal) =>
          proposal.reviewStatus === "pending" ||
          proposal.applyStatus === "failed" ||
          proposal.removeStatus === "failed",
      ),
    ).toBe(true);
  });

  it("makes stalled lifecycle operations actionable and retryable", async () => {
    const startedAt = Date.now();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(startedAt);

    try {
      const applyInput = {
        pluginId: "builders",
        entityId: "stalled-application.near",
        payload: { name: "Stalled Application" },
        idempotencyKey: "stalled-application",
      };
      const proposedApply = await aliceClient().propose(applyInput);
      const applying = await adminClient().approve({
        pluginId: applyInput.pluginId,
        entityId: applyInput.entityId,
        expectedUpdatedAt: proposedApply.data.updatedAt,
      });

      const removeInput = {
        pluginId: "builders",
        entityId: "stalled-removal.near",
        payload: { name: "Stalled Removal" },
        idempotencyKey: "stalled-removal",
      };
      const proposedRemove = await aliceClient().propose(removeInput);
      const approvedRemove = await adminClient().approve({
        pluginId: removeInput.pluginId,
        entityId: removeInput.entityId,
        expectedUpdatedAt: proposedRemove.data.updatedAt,
      });
      const appliedRemove = await adminClient().markApplied({
        pluginId: removeInput.pluginId,
        entityId: removeInput.entityId,
        expectedUpdatedAt: approvedRemove.data.updatedAt,
        appliedResourceId: removeInput.entityId,
      });
      const removing = await adminClient().remove({
        pluginId: removeInput.pluginId,
        entityId: removeInput.entityId,
        expectedUpdatedAt: appliedRemove.data.updatedAt,
      });

      const active = await adminClient().getProposals({
        pluginId: "builders",
        lifecycleStatus: "actionable",
        limit: 100,
      });
      expect(active.data.map((proposal) => proposal.entityId)).not.toContain(applyInput.entityId);
      expect(active.data.map((proposal) => proposal.entityId)).not.toContain(removeInput.entityId);
      await expect(
        adminClient().approve({
          pluginId: applyInput.pluginId,
          entityId: applyInput.entityId,
          expectedUpdatedAt: applying.data.updatedAt,
        }),
      ).rejects.toThrow("Only pending proposals can be approved");
      await expect(
        adminClient().remove({
          pluginId: removeInput.pluginId,
          entityId: removeInput.entityId,
          expectedUpdatedAt: removing.data.updatedAt,
        }),
      ).rejects.toThrow("Only applied proposals can have approval revoked");

      vi.setSystemTime(startedAt + 5 * 60 * 1000 + 10);

      const stalled = await adminClient().getProposals({
        pluginId: "builders",
        lifecycleStatus: "actionable",
        limit: 100,
      });
      expect(stalled.data.map((proposal) => proposal.entityId)).toEqual(
        expect.arrayContaining([applyInput.entityId, removeInput.entityId]),
      );

      const retriedApply = await adminClient().approve({
        pluginId: applyInput.pluginId,
        entityId: applyInput.entityId,
        expectedUpdatedAt: applying.data.updatedAt,
      });
      const retriedRemoval = await adminClient().remove({
        pluginId: removeInput.pluginId,
        entityId: removeInput.entityId,
        expectedUpdatedAt: removing.data.updatedAt,
      });

      expect(retriedApply.data.applyStatus).toBe("applying");
      expect(retriedApply.data.updatedAt).not.toBe(applying.data.updatedAt);
      expect(retriedRemoval.data.removeStatus).toBe("removing");
      expect(retriedRemoval.data.updatedAt).not.toBe(removing.data.updatedAt);
    } finally {
      vi.useRealTimers();
    }
  });

  it("provides admins with reviewer history", async () => {
    const input = {
      pluginId: "builders",
      entityId: "review-history.near",
      payload: { name: "Review History" },
      idempotencyKey: "review-history",
    };

    const proposed = await aliceClient().propose(input);
    const approved = await adminClient().approve({
      pluginId: input.pluginId,
      entityId: input.entityId,
      expectedUpdatedAt: proposed.data.updatedAt,
    });
    await adminClient().markApplied({
      pluginId: input.pluginId,
      entityId: input.entityId,
      expectedUpdatedAt: approved.data.updatedAt,
      appliedResourceId: input.entityId,
    });

    const audit = await adminClient().getAuditLog({
      pluginId: input.pluginId,
      entityId: input.entityId,
    });
    expect(audit.data[0]).toMatchObject({
      action: "applied",
      actor: "system",
      actorLabel: "System",
    });

    await expect(aliceClient().getReviewHistory({ pluginId: "builders" })).rejects.toThrow(
      "Admin access required",
    );

    const history = await adminClient().getReviewHistory({ pluginId: "builders" });
    const review = history.data.find((entry) => entry.entityId === input.entityId);

    expect(review).toMatchObject({
      pluginId: "builders",
      entityId: input.entityId,
      action: "approved",
      actor: "admin",
      actorLabel: "admin",
      proposal: {
        createdBy: "alice.near",
        reviewStatus: "approved",
        payload: { name: "Review History" },
      },
    });
  });

  it("lets the creator withdraw a pending proposal, but not a stranger", async () => {
    const input = {
      pluginId: "builders",
      entityId: "withdraw-mine.near",
      payload: { name: "Withdraw Mine" },
      idempotencyKey: "withdraw-mine",
    };
    const proposed = await aliceClient().propose(input);

    await expect(
      bobClient().withdraw({
        pluginId: input.pluginId,
        entityId: input.entityId,
        expectedUpdatedAt: proposed.data.updatedAt,
      }),
    ).rejects.toThrow("withdraw a nomination you created");

    const withdrawn = await aliceClient().withdraw({
      pluginId: input.pluginId,
      entityId: input.entityId,
      expectedUpdatedAt: proposed.data.updatedAt,
    });
    expect(withdrawn.data.reviewStatus).toBe("removed");

    const audit = await adminClient().getAuditLog({
      pluginId: input.pluginId,
      entityId: input.entityId,
    });
    expect(audit.data.some((entry) => entry.action === "withdrawn")).toBe(true);
  });

  it("lets the nominee withdraw a proposal that is for their account", async () => {
    const input = {
      pluginId: "builders",
      entityId: "bob.near",
      payload: { name: "Bob" },
      idempotencyKey: "withdraw-for-subject",
    };
    const proposed = await aliceClient().propose(input);

    const withdrawn = await bobClient().withdraw({
      pluginId: input.pluginId,
      entityId: input.entityId,
      expectedUpdatedAt: proposed.data.updatedAt,
    });
    expect(withdrawn.data.reviewStatus).toBe("removed");
  });

  it("rejects withdrawing a proposal that is no longer pending", async () => {
    const input = {
      pluginId: "builders",
      entityId: "withdraw-too-late.near",
      payload: { name: "Too Late" },
      idempotencyKey: "withdraw-too-late",
    };
    const proposed = await aliceClient().propose(input);
    const approved = await adminClient().approve({
      pluginId: input.pluginId,
      entityId: input.entityId,
      expectedUpdatedAt: proposed.data.updatedAt,
    });

    await expect(
      aliceClient().withdraw({
        pluginId: input.pluginId,
        entityId: input.entityId,
        expectedUpdatedAt: approved.data.updatedAt,
      }),
    ).rejects.toThrow("Only a pending nomination can be withdrawn");
  });

  it("requires authentication to withdraw", async () => {
    await expect(
      loaded.createClient().withdraw({
        pluginId: "builders",
        entityId: "withdraw-anon.near",
        expectedUpdatedAt: new Date().toISOString(),
      }),
    ).rejects.toThrow("Authentication required");
  });
});
