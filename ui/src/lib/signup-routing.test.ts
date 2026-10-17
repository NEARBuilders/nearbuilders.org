import { describe, expect, it } from "vitest";
import {
  isOwnNearAccount,
  isOwnProfileNominationError,
  isSelfJoinIntent,
  normalizeNearAccount,
  OWN_PROFILE_NOMINATION_ERROR,
} from "./signup-routing";

describe("Signup routing", () => {
  it("sends self intent to join", () => {
    expect(isSelfJoinIntent("self")).toBe(true);
  });

  it("ignores unknown intents", () => {
    expect(isSelfJoinIntent("nominate")).toBe(false);
    expect(isSelfJoinIntent(undefined)).toBe(false);
    expect(isSelfJoinIntent(null)).toBe(false);
  });

  it("sends your own account to join", () => {
    expect(isOwnNearAccount("me.near", ["me.near"])).toBe(true);
    expect(isOwnNearAccount("  Me.NEAR ", ["me.near"])).toBe(true);
  });

  it("sends a linked account that is not the wallet account to join", () => {
    expect(isOwnNearAccount("linked.near", ["me.near", "linked.near"])).toBe(true);
    expect(isOwnNearAccount(" LINKED.near", [null, "me.near", " Linked.Near "])).toBe(true);
  });

  it("keeps another account on the nominate form", () => {
    expect(isOwnNearAccount("other.near", ["me.near", "linked.near"])).toBe(false);
    expect(isOwnNearAccount("other.near", [])).toBe(false);
  });

  it("never treats an empty account as your own", () => {
    expect(isOwnNearAccount("", [""])).toBe(false);
    expect(isOwnNearAccount("   ", [undefined])).toBe(false);
    expect(isOwnNearAccount("me.near", [null])).toBe(false);
  });

  it("recognizes the own-profile nomination rejection", () => {
    expect(
      isOwnProfileNominationError({ code: "BAD_REQUEST", message: OWN_PROFILE_NOMINATION_ERROR }),
    ).toBe(true);
    expect(
      isOwnProfileNominationError({ code: "BAD_REQUEST", message: "Invalid NEAR account" }),
    ).toBe(false);
    expect(
      isOwnProfileNominationError({ code: "FORBIDDEN", message: OWN_PROFILE_NOMINATION_ERROR }),
    ).toBe(false);
    expect(isOwnProfileNominationError(new Error(OWN_PROFILE_NOMINATION_ERROR))).toBe(false);
    expect(isOwnProfileNominationError(null)).toBe(false);
  });

  it("normalizes NEAR accounts", () => {
    expect(normalizeNearAccount(" Alice.Near ")).toBe("alice.near");
    expect(normalizeNearAccount(undefined)).toBe("");
  });
});
