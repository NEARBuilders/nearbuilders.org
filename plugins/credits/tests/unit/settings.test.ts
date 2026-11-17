import { describe, expect, it } from "vitest";
import { validateAmountCents, validateSettings } from "@/services/settings";

const valid = {
  enabled: true,
  amountUsd: 5,
  claimsCloseAt: "2999-01-01T00:00:00Z",
  keyExpiresAt: "2999-02-01T00:00:00Z",
  nearAiWorkspaceId: " ws-hackathon ",
  nearAiLoginAccountId: " nearbuilding.near ",
  nearAiOrgId: " org-1234 ",
};

describe("validateAmountCents", () => {
  it.each([
    [5, 500],
    [2.5, 250],
    [1_000_000, 100_000_000],
  ])("converts %p to %p cents", (amountUsd, cents) => {
    expect(validateAmountCents(amountUsd)).toEqual({ ok: true, cents });
  });

  it.each([0, -1, -0.5, Number.NaN, 5.011, 1e10 + 0.01])("rejects %p", (amountUsd) => {
    expect(validateAmountCents(amountUsd)).toEqual({ ok: false });
  });
});

describe("validateSettings", () => {
  it("accepts a complete configuration and normalizes whitespace", () => {
    const result = validateSettings(valid);
    expect(result).toEqual({
      ok: true,
      values: {
        enabled: true,
        amountCents: 500,
        claimsCloseAt: new Date("2999-01-01T00:00:00Z"),
        keyExpiresAt: new Date("2999-02-01T00:00:00Z"),
        nearAiWorkspaceId: "ws-hackathon",
        nearAiLoginAccountId: "nearbuilding.near",
        nearAiOrgId: "org-1234",
      },
    });
  });

  it("accepts null dates and an empty configuration surface", () => {
    const result = validateSettings({
      enabled: false,
      amountUsd: 3,
      claimsCloseAt: null,
      keyExpiresAt: null,
      nearAiWorkspaceId: "",
      nearAiLoginAccountId: "",
    });
    expect(result).toEqual({
      ok: true,
      values: {
        enabled: false,
        amountCents: 300,
        claimsCloseAt: null,
        keyExpiresAt: null,
        nearAiWorkspaceId: "",
        nearAiLoginAccountId: "",
        nearAiOrgId: "",
      },
    });
  });

  it("rejects an invalid amount with its field name", () => {
    const result = validateSettings({ ...valid, amountUsd: 5.011 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.invalidFields).toEqual(["amountUsd"]);
      expect(result.problems).toEqual([
        "Amount must be a positive dollar amount with at most two decimals",
      ]);
    }
  });

  it("rejects malformed dates with their field names", () => {
    const result = validateSettings({ ...valid, claimsCloseAt: "soon", keyExpiresAt: "later" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.invalidFields).toEqual(["claimsCloseAt", "keyExpiresAt"]);
    }
  });

  it("rejects keys that expire before or at claims close", () => {
    const result = validateSettings({
      ...valid,
      keyExpiresAt: "2999-01-01T00:00:00Z",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.invalidFields).toEqual(["keyExpiresAt"]);
      expect(result.problems).toEqual(["Key expiry must be after claims close"]);
    }
  });

  it("allows keys to expire with no claims close date", () => {
    const result = validateSettings({ ...valid, claimsCloseAt: null });
    expect(result.ok).toBe(true);
  });
});
