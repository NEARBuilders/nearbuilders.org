import { describe, expect, it } from "vitest";
import { isEventOwner } from "../services/events";

describe("event ownership", () => {
  it("keeps an event accessible after switching the primary wallet", () => {
    expect(isEventOwner("old.near", "new.near", ["user-1", "old.near"])).toBe(true);
  });

  it("rejects accounts outside the linked identity set", () => {
    expect(isEventOwner("someone-else.near", "new.near", ["user-1", "old.near"])).toBe(false);
  });
});
