import { describe, expect, it } from "vitest";
import { getBuilderOnboardingProgress } from "./builder-onboarding";

describe("builder onboarding progress", () => {
  it("returns zero when no checklist items exist", () => {
    expect(getBuilderOnboardingProgress([])).toBe(0);
  });

  it("rounds the completed item percentage", () => {
    expect(getBuilderOnboardingProgress([true, true, true, false, false])).toBe(60);
  });

  it("returns full completion when every item is complete", () => {
    expect(getBuilderOnboardingProgress([true, true, true, true, true])).toBe(100);
  });
});
