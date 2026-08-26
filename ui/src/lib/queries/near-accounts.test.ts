import { describe, expect, it } from "vitest";
import { selectNearAccountId } from "./near-accounts";

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
