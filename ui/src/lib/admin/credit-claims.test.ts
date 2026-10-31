import { describe, expect, it } from "vitest";
import { canRetry, claimCardCopy, creditStatusQueryKey } from "./credit-claims";

function claimPick(
  overrides: Partial<{
    status: "pending" | "issued" | "failed" | "revoked" | "expired";
    keyPrefix: string | null;
    createdAt: string;
    keyExpiresAt: string | null;
    spendLimitUsd: number;
  }> = {},
) {
  return {
    status: "issued" as const,
    keyPrefix: "sk-abc",
    createdAt: "2026-10-30T00:00:00.000Z",
    keyExpiresAt: "2999-11-25T23:59:00.000Z",
    spendLimitUsd: 5,
    ...overrides,
  };
}

const OPEN_OFFER = {
  amountUsd: 5,
  available: true,
  statusReason: null,
  eligibility: "eligible" as const,
  claimsCloseAt: "2999-11-14T23:59:00.000Z",
  existing: null,
};

describe("claimCardCopy", () => {
  it("describes the claimable offer with its close date from settings", () => {
    const copy = claimCardCopy(OPEN_OFFER);
    expect(copy.title).toBe("Claim $5.00 in NEAR AI Cloud credits");
    expect(copy.description).toContain("Offering closes");
  });

  it("leaves the close date out when none is configured", () => {
    const copy = claimCardCopy({ ...OPEN_OFFER, claimsCloseAt: null });
    expect(copy.description).not.toContain("closes");
  });

  it("explains approved-profile eligibility", () => {
    const copy = claimCardCopy({ ...OPEN_OFFER, eligibility: "needs_approved_profile" as const });
    expect(copy.description).toContain("builder profile is approved");
  });

  it.each([
    { statusReason: "not_enabled" as const, fragment: "not open yet" },
    { statusReason: "not_configured" as const, fragment: "not configured yet" },
    { statusReason: "closed" as const, fragment: "window closed" },
  ])("names why the window is closed ($statusReason)", ({ statusReason, fragment }) => {
    const copy = claimCardCopy({ ...OPEN_OFFER, available: false, statusReason });
    expect(copy.description).toContain(fragment);
  });

  it("uses the close date in the closed-window copy", () => {
    const copy = claimCardCopy({
      ...OPEN_OFFER,
      available: false,
      statusReason: "closed",
    });
    expect(copy.description).toContain("The claim window closed");
  });

  it("a failed claim keeps truthful copy: retry speaks only when retry is possible", () => {
    const retryable = claimCardCopy({ ...OPEN_OFFER, existing: claimPick({ status: "failed" }) });
    expect(retryable.title).toBe("You can try claiming again");

    const closedWhileFailed = claimCardCopy({
      ...OPEN_OFFER,
      available: false,
      statusReason: "closed",
      existing: claimPick({ status: "failed" }),
    });
    expect(closedWhileFailed.title).toContain("$5.00");
    expect(closedWhileFailed.description).toContain("The claim window closed");
  });

  it("a failed claim never masks the eligibility copy", () => {
    const copy = claimCardCopy({
      ...OPEN_OFFER,
      eligibility: "needs_approved_profile" as const,
      existing: claimPick({ status: "failed" }),
    });
    expect(copy.description).toContain("builder profile is approved");
  });

  it.each([
    { status: "issued" as const, fragment: "$5.00" },
    { status: "expired" as const, fragment: "expired" },
    { status: "revoked" as const, fragment: "was revoked" },
  ])("describes an existing $status claim", ({ status, fragment }) => {
    const copy = claimCardCopy({
      ...OPEN_OFFER,
      available: false,
      existing: claimPick({ status, spendLimitUsd: 5 }),
    });
    expect(`${copy.title} ${copy.description}`).toContain(fragment);
  });

  it("says when a claimed key has no expiry", () => {
    const copy = claimCardCopy({
      ...OPEN_OFFER,
      existing: claimPick({ status: "issued", keyExpiresAt: null }),
    });
    expect(copy.description).toContain("no expiry");
  });

  it("a pending claim tells the truth while it cannot be retried", () => {
    const processing = claimCardCopy({
      ...OPEN_OFFER,
      existing: claimPick({ status: "pending" }),
    });
    expect(processing.title).toBe("Your claim is being processed");
    expect(processing.description).toContain("still being created");

    const closedWhilePending = claimCardCopy({
      ...OPEN_OFFER,
      available: false,
      statusReason: "not_enabled",
      existing: claimPick({ status: "pending" }),
    });
    expect(closedWhilePending.title).toBe("Your claim is being processed");
    expect(closedWhilePending.description).toContain("not open yet");
  });
});

describe("canRetry", () => {
  it("requires both an open window and eligible status", () => {
    expect(canRetry(true, "eligible")).toBe(true);
    expect(canRetry(false, "eligible")).toBe(false);
    expect(canRetry(true, "needs_approved_profile")).toBe(false);
  });
});

describe("creditStatusQueryKey", () => {
  it("scopes the cache by signed-in user and NEAR account", () => {
    const base = creditStatusQueryKey("user-1", "efiz.near");
    expect(creditStatusQueryKey("user-1", "efiz.near")).toEqual(base);
    expect(creditStatusQueryKey("user-2", "efiz.near")).not.toEqual(base);
    expect(creditStatusQueryKey("user-1", "work.efiz.near")).not.toEqual(base);
  });
});
