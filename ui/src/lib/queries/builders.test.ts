import { describe, expect, it } from "vitest";
import { getBuilderCategoryCounts } from "./builders";

describe("getBuilderCategoryCounts", () => {
  it("uses API totals for every category", () => {
    expect(getBuilderCategoryCounts(73, 5)).toEqual({
      all: 78,
      approved: 73,
      nominated: 5,
    });
  });
});
