import { describe, expect, it } from "vitest";
import { claimCardCopy } from "./credit-claims";

function claimPick(
  overrides: Partial<{
    status: "pending" | "issued" | "failed" | "revoked" | "expired";
    keyPrefix: string | null;
    createdAt: string;
    keyExpiresAt: string;
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

  it("explains a closed window", () => {
    const copy = claimCardCopy({ ...OPEN_OFFER, available: false });
    expect(copy.description).toContain("closed");
  });

  it.each([
    { status: "issued" as const, fragment: "$5.00" },
    { status: "expired" as const, fragment: "expired" },
    { status: "revoked" as const, fragment: "was revoked" },
    { status: "failed" as const, fragment: "try claiming again" },
    { status: "pending" as const, fragment: "still being created" },
  ])("describes an existing $status claim", ({ status, fragment }) => {
    const copy = claimCardCopy({
      ...OPEN_OFFER,
      available: false,
      existing: claimPick({ status, spendLimitUsd: 5 }),
    });
    expect(`${copy.title} ${copy.description}`).toContain(fragment);
  });

  it("describes a claimed key with its prefix", () => {
    const copy = claimCardCopy({ ...OPEN_OFFER, existing: claimPick({ status: "issued" }) });
    expect(copy.description).toContain("sk-abc");
  });
});
