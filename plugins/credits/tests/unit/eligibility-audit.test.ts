import { describe, expect, it } from "vitest";
import { buildAuditReport } from "@/services/eligibility-audit";

function link(userId: string, accountId: string, isPrimary = false) {
  return { userId, accountId, isPrimary };
}

function profile(
  nearAccount: string,
  overrides: { userId?: string | null; withdrawnAt?: Date | null } = {},
) {
  return {
    nearAccount,
    userId: overrides.userId ?? null,
    withdrawnAt: overrides.withdrawnAt ?? null,
  };
}

describe("buildAuditReport", () => {
  it("flags an approved profile under a linked account that is not primary", () => {
    const report = buildAuditReport({
      links: [link("user-1", "new.near", true), link("user-1", "old.near")],
      profiles: [profile("old.near")],
    });
    expect(report.users).toEqual([
      {
        userId: "user-1",
        primaryAccountId: "new.near",
        hasPrimaryMarker: true,
        linkedProfileAccounts: ["old.near"],
        runtimeEligible: false,
        fixable: true,
        verdict: "mismatch_fixable",
      },
    ]);
    expect(report.counts.fixable).toBe(1);
  });

  it("treats a userId-linked profile as eligible regardless of primary wallet", () => {
    const report = buildAuditReport({
      links: [link("user-1", "new.near", true), link("user-1", "old.near")],
      profiles: [profile("old.near", { userId: "user-1" })],
    });
    expect(report.users[0]).toMatchObject({ runtimeEligible: true, verdict: "eligible" });
  });

  it("is eligible when the primary account itself is an approved profile", () => {
    const report = buildAuditReport({
      links: [link("user-1", "nearbuilding.near", true)],
      profiles: [profile("nearbuilding.near", { userId: "user-1" })],
    });
    expect(report.users[0]).toMatchObject({ runtimeEligible: true, verdict: "eligible" });
  });

  it("reports withdrawn runtime candidates separately", () => {
    const now = new Date("2026-10-30T00:00:00Z");
    const report = buildAuditReport({
      links: [link("user-1", "old.near", true)],
      profiles: [profile("old.near", { withdrawnAt: now })],
    });
    expect(report.users[0]).toMatchObject({
      runtimeEligible: false,
      verdict: "needs_approved_profile_withdrawn",
      fixable: false,
    });
    expect(report.counts.withdrawn).toBe(1);
  });

  it("reports users without any profile", () => {
    const report = buildAuditReport({
      links: [link("user-1", "new.near", true)],
      profiles: [],
    });
    expect(report.users[0]).toMatchObject({ verdict: "needs_approved_profile", fixable: false });
    expect(report.counts.missingProfile).toBe(1);
  });

  it("flags users whose linked accounts never had a primary marker", () => {
    const report = buildAuditReport({
      links: [link("user-1", "old.near")],
      profiles: [profile("other.near")],
    });
    expect(report.users[0]).toMatchObject({
      primaryAccountId: null,
      hasPrimaryMarker: false,
      verdict: "needs_approved_profile",
    });
  });

  it("detects claim rows under accounts linked to nobody", () => {
    const report = buildAuditReport({
      links: [link("user-1", "new.near", true)],
      profiles: [],
      claims: [
        { nearAccountId: "old.near", status: "failed" },
        { nearAccountId: "new.near", status: "issued" },
      ],
    });
    expect(report.orphanedClaims).toEqual([{ nearAccountId: "old.near", statuses: ["failed"] }]);
    expect(report.counts.orphanedClaims).toBe(1);
  });

  it("normalizes casing when matching accounts", () => {
    const report = buildAuditReport({
      links: [link("User-1", "New.near", true)],
      profiles: [profile("old.near")],
      claims: [{ nearAccountId: "Old.near", status: "failed" }],
    });
    expect(report.users[0]).toMatchObject({
      userId: "user-1",
      primaryAccountId: "new.near",
      linkedProfileAccounts: [],
    });
    expect(report.orphanedClaims).toEqual([{ nearAccountId: "old.near", statuses: ["failed"] }]);
  });

  it("a withdrawn profile under another linked account does not count as fixable", () => {
    const report = buildAuditReport({
      links: [link("user-1", "new.near", true), link("user-1", "old.near")],
      profiles: [profile("old.near", { withdrawnAt: new Date("2026-10-01T00:00:00Z") })],
    });
    expect(report.users[0]).not.toMatchObject({ fixable: true });
    expect(report.counts.fixable).toBe(0);
  });
});
