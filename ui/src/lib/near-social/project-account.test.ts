import { describe, expect, it } from "vitest";
import { resolveProjectNearAccount } from "./project-account";

describe("resolveProjectNearAccount", () => {
  it("prefers a linked app near account over the owner id", () => {
    expect(
      resolveProjectNearAccount({
        ownerId: "owner.near",
        apps: [{ accountId: "app.near" }, { accountId: "second.near" }],
      }),
    ).toBe("app.near");
  });

  it("falls back to ownerId when it is a near account", () => {
    expect(
      resolveProjectNearAccount({
        ownerId: "owner.near",
        apps: [{ accountId: "not-a-near-id" }],
      }),
    ).toBe("owner.near");
  });

  it("returns null when neither source is a near account", () => {
    expect(
      resolveProjectNearAccount({
        ownerId: "user_abc",
        apps: [{ accountId: "also_not" }],
      }),
    ).toBeNull();
  });
});
