import { describe, expect, it } from "vitest";
import { isProjectOwner } from "../services/projects";

describe("project ownership", () => {
  it("keeps a project accessible after switching the primary wallet", () => {
    expect(isProjectOwner("old.near", "new.near", ["user-1", "old.near"])).toBe(true);
  });

  it("rejects accounts outside the linked identity set", () => {
    expect(isProjectOwner("someone-else.near", "new.near", ["user-1", "old.near"])).toBe(false);
  });
});
