import { describe, expect, it } from "vitest";
import { FIRST_DELAY_RANGE, getRandomDelay, REPEAT_DELAY_RANGE } from "./nearkat-peek-schedule";

describe("Nearkat peek scheduling", () => {
  it("keeps the first appearance between 3 and 7 seconds", () => {
    expect(getRandomDelay(FIRST_DELAY_RANGE, () => 0)).toBe(3_000);
    expect(getRandomDelay(FIRST_DELAY_RANGE, () => 0.5)).toBe(5_000);
    expect(getRandomDelay(FIRST_DELAY_RANGE, () => 1)).toBe(7_000);
  });

  it("keeps later appearances between 3 and 5 seconds", () => {
    expect(getRandomDelay(REPEAT_DELAY_RANGE, () => 0)).toBe(3_000);
    expect(getRandomDelay(REPEAT_DELAY_RANGE, () => 0.5)).toBe(4_000);
    expect(getRandomDelay(REPEAT_DELAY_RANGE, () => 1)).toBe(5_000);
  });
});
