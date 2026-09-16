import { describe, expect, it } from "vitest";
import { FIRST_DELAY_RANGE, getRandomDelay, REPEAT_DELAY_RANGE } from "./nearkat-peek-schedule";

describe("Nearkat peek scheduling", () => {
  it("keeps the first appearance between 10 and 15 seconds", () => {
    expect(getRandomDelay(FIRST_DELAY_RANGE, () => 0)).toBe(10_000);
    expect(getRandomDelay(FIRST_DELAY_RANGE, () => 0.5)).toBe(12_500);
    expect(getRandomDelay(FIRST_DELAY_RANGE, () => 1)).toBe(15_000);
  });

  it("keeps later appearances between 10 and 15 seconds", () => {
    expect(getRandomDelay(REPEAT_DELAY_RANGE, () => 0)).toBe(10_000);
    expect(getRandomDelay(REPEAT_DELAY_RANGE, () => 0.5)).toBe(12_500);
    expect(getRandomDelay(REPEAT_DELAY_RANGE, () => 1)).toBe(15_000);
  });
});
