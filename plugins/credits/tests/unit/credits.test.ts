import { describe, expect, it } from "vitest";
import { clientIp, creditEligibility, parseCreditsConfig } from "@/services/credits";

const complete = {
  CREDITS_ENABLED: "true",
  CREDITS_AMOUNT_USD: "5",
  CREDITS_CLAIMS_CLOSE_AT: "2026-11-14T23:59:00Z",
  CREDITS_KEY_EXPIRES_AT: "2026-11-25T23:59:00Z",
  NEARAI_CREDITS_REFRESH_TOKEN: "rt_test",
  NEARAI_CREDITS_USER_AGENT: "Mozilla/5.0 Test",
  NEARAI_CREDITS_WORKSPACE_ID: "ws-1",
};

describe("parseCreditsConfig", () => {
  it("parses a complete configuration", () => {
    expect(parseCreditsConfig(complete)).toEqual({
      enabled: true,
      amountCents: 500,
      claimsCloseAt: new Date("2026-11-14T23:59:00Z"),
      keyExpiresAt: new Date("2026-11-25T23:59:00Z"),
      refreshToken: "rt_test",
      userAgent: "Mozilla/5.0 Test",
      workspaceId: "ws-1",
      problems: [],
    });
  });

  it("is disabled unless the flag is a truthy value", () => {
    expect(parseCreditsConfig({ ...complete, CREDITS_ENABLED: "" }).enabled).toBe(false);
    expect(parseCreditsConfig({ ...complete, CREDITS_ENABLED: "false" }).enabled).toBe(false);
    expect(parseCreditsConfig({ ...complete, CREDITS_ENABLED: " YES " }).enabled).toBe(true);
  });

  it("defaults the amount to $5 and accepts cents", () => {
    expect(parseCreditsConfig({ ...complete, CREDITS_AMOUNT_USD: "" }).amountCents).toBe(500);
    expect(parseCreditsConfig({ ...complete, CREDITS_AMOUNT_USD: "2.5" }).amountCents).toBe(250);
  });

  it.each(["0", "-1", "abc", "1.234"])("reports an invalid amount %s", (amount) => {
    expect(parseCreditsConfig({ ...complete, CREDITS_AMOUNT_USD: amount }).problems).toEqual([
      "CREDITS_AMOUNT_USD must be a positive dollar amount with at most two decimals",
    ]);
  });

  it("reports every missing or invalid required setting", () => {
    expect(
      parseCreditsConfig({
        CREDITS_ENABLED: "true",
        CREDITS_AMOUNT_USD: "",
        CREDITS_CLAIMS_CLOSE_AT: "",
        CREDITS_KEY_EXPIRES_AT: "soon",
        NEARAI_CREDITS_REFRESH_TOKEN: " ",
        NEARAI_CREDITS_USER_AGENT: "",
        NEARAI_CREDITS_WORKSPACE_ID: "",
      }).problems,
    ).toEqual([
      "CREDITS_CLAIMS_CLOSE_AT is not set",
      "CREDITS_KEY_EXPIRES_AT is not a valid date",
      "NEARAI_CREDITS_REFRESH_TOKEN is not set",
      "NEARAI_CREDITS_USER_AGENT is not set",
      "NEARAI_CREDITS_WORKSPACE_ID is not set",
    ]);
  });
});

describe("creditEligibility", () => {
  it("requires a NEAR account", () => {
    expect(creditEligibility(null, null)).toBe("needs_near_account");
  });

  it("requires a builder profile that is not withdrawn", () => {
    expect(creditEligibility("alice.near", null)).toBe("needs_approved_profile");
    expect(creditEligibility("alice.near", { withdrawnAt: "2026-10-01T00:00:00.000Z" })).toBe(
      "needs_approved_profile",
    );
  });

  it("accepts an approved builder", () => {
    expect(creditEligibility("alice.near", { withdrawnAt: null })).toBe("eligible");
  });
});

describe("clientIp", () => {
  it("prefers the Cloudflare client IP", () => {
    const headers = new Headers({
      "cf-connecting-ip": "203.0.113.7",
      "x-real-ip": "198.51.100.1",
      "x-forwarded-for": "198.51.100.2, 10.0.0.1",
    });
    expect(clientIp(headers)).toBe("203.0.113.7");
  });

  it("falls back to the proxy headers", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.1" }))).toBe("198.51.100.1");
    expect(clientIp(new Headers({ "x-forwarded-for": " 198.51.100.2 , 10.0.0.1" }))).toBe(
      "198.51.100.2",
    );
  });

  it("returns null without headers", () => {
    expect(clientIp(undefined)).toBeNull();
    expect(clientIp(new Headers())).toBeNull();
  });
});
