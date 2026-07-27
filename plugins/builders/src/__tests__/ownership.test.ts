import { describe, expect, it } from "vitest";
import { isBuilderOwner } from "../services/builders";

describe("builder ownership", () => {
  const builder = { nearAccount: "old.near", userId: null };

  it("recognizes a builder profile owned by another linked wallet", () => {
    expect(isBuilderOwner(builder, "user-1", ["new.near", "old.near"])).toBe(true);
  });

  it("rejects wallets that are not linked to the user", () => {
    expect(isBuilderOwner(builder, "user-1", ["new.near"])).toBe(false);
  });
});
