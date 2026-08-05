import { describe, expect, it } from "vitest";
import { getBuilderCardClassName } from "./-builder-card-styles";

function classSet(value: string): Set<string> {
  return new Set(value.split(/\s+/));
}

describe("getBuilderCardClassName", () => {
  it("uses the secondary theme surface instead of the page-matching card surface", () => {
    const classes = classSet(getBuilderCardClassName("grid", false));

    expect(classes.has("bg-secondary")).toBe(true);
    expect(classes.has("bg-card")).toBe(false);
  });

  it("preserves list and nomination variants", () => {
    const classes = classSet(getBuilderCardClassName("list", true));

    expect(classes.has("sm:flex-row")).toBe(true);
    expect(classes.has("border-dashed")).toBe(true);
  });
});
