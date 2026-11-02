import { describe, expect, it } from "vitest";
import { clientIp, creditEligibility } from "@/services/credits";

describe("creditEligibility", () => {
  it("requires a NEAR account", () => {
    expect(creditEligibility(null, null)).toBe("needs_near_account");
  });

  it("requires a builder profile", () => {
    expect(creditEligibility("alice.near", null)).toBe("needs_approved_profile");
  });

  it("asks withdrawn builders to restore their profile", () => {
    expect(creditEligibility("alice.near", { withdrawnAt: "2026-10-01T00:00:00.000Z" })).toBe(
      "needs_profile_restore",
    );
  });

  it("accepts an approved builder", () => {
    expect(creditEligibility("alice.near", { withdrawnAt: null })).toBe("eligible");
  });
});

describe("clientIp", () => {
  it("reads the Cloudflare client IP", () => {
    const headers = new Headers({
      "cf-connecting-ip": " 203.0.113.7 ",
      "x-real-ip": "198.51.100.1",
      "x-forwarded-for": "198.51.100.2, 10.0.0.1",
    });
    expect(clientIp(headers)).toBe("203.0.113.7");
  });

  it("ignores proxy headers that carry the edge IP or can be spoofed", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.1" }))).toBeNull();
    expect(clientIp(new Headers({ "x-forwarded-for": "198.51.100.2, 10.0.0.1" }))).toBeNull();
  });

  it("returns null without headers", () => {
    expect(clientIp(undefined)).toBeNull();
    expect(clientIp(new Headers())).toBeNull();
  });
});
