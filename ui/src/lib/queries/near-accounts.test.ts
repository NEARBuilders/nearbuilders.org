import { describe, expect, it } from "vitest";
import { selectNearAccountId, selectNearAccountIds } from "./near-accounts";

describe("selectNearAccountId", () => {
  it("prefers the active account", () => {
    expect(
      selectNearAccountId({
        activeAccount: { accountId: "active.near" },
        accounts: [{ accountId: "primary.near", isPrimary: true }],
      }),
    ).toBe("active.near");
  });

  it("falls back to the primary or first linked account", () => {
    expect(
      selectNearAccountId({
        accounts: [{ accountId: "first.near" }, { accountId: "primary.near", isPrimary: true }],
      }),
    ).toBe("primary.near");
    expect(selectNearAccountId({ accounts: [{ accountId: "first.near" }] })).toBe("first.near");
  });

  it("returns null when no NEAR account is linked", () => {
    expect(selectNearAccountId({ accounts: [] })).toBeNull();
  });
});

describe("selectNearAccountIds", () => {
  it("lists every linked account once", () => {
    expect(
      selectNearAccountIds({
        activeAccount: { accountId: "active.near" },
        accounts: [{ accountId: "active.near" }, { accountId: "linked.near" }],
      }),
    ).toEqual(["active.near", "linked.near"]);
  });

  it("returns an empty list when no NEAR account is linked", () => {
    expect(selectNearAccountIds({ accounts: [] })).toEqual([]);
    expect(selectNearAccountIds(null)).toEqual([]);
  });
});
