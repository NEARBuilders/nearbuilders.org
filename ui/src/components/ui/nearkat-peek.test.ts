import { describe, expect, it } from "vitest";
import { FIRST_DELAY_RANGE, getRandomDelay, REPEAT_DELAY_RANGE } from "./nearkat-peek-schedule";

describe("Nearkat peek scheduling", () => {
  it("keeps the first appearance between 30 and 75 seconds", () => {
    expect(getRandomDelay(FIRST_DELAY_RANGE, () => 0)).toBe(30_000);
    expect(getRandomDelay(FIRST_DELAY_RANGE, () => 0.5)).toBe(52_500);
    expect(getRandomDelay(FIRST_DELAY_RANGE, () => 1)).toBe(75_000);
  });

  it("keeps later appearances between two and four minutes", () => {
    expect(getRandomDelay(REPEAT_DELAY_RANGE, () => 0)).toBe(120_000);
    expect(getRandomDelay(REPEAT_DELAY_RANGE, () => 0.5)).toBe(180_000);
    expect(getRandomDelay(REPEAT_DELAY_RANGE, () => 1)).toBe(240_000);
  });
});
