import { describe, expect, it } from "vitest";
import {
  isRecentlyClosed,
  programState,
  RECENTLY_CLOSED_DAYS,
} from "../services/program-state";

const now = new Date("2026-11-07T12:00:00.000Z");
const day = 24 * 60 * 60 * 1000;
const at = (offsetDays: number) => new Date(now.getTime() + offsetDays * day);

describe("programState", () => {
  it("treats a program with no dates as open (rolling)", () => {
    expect(programState({ opensAt: null, closesAt: null }, now)).toBe("open");
  });

  it("is open between opensAt and closesAt", () => {
    expect(programState({ opensAt: at(-1), closesAt: at(1) }, now)).toBe("open");
  });

  it("is upcoming before opensAt", () => {
    expect(programState({ opensAt: at(1), closesAt: null }, now)).toBe("upcoming");
  });

  it("is closed at and after closesAt", () => {
    expect(programState({ opensAt: null, closesAt: now }, now)).toBe("closed");
    expect(programState({ opensAt: at(-10), closesAt: at(-1) }, now)).toBe("closed");
  });
});

describe("isRecentlyClosed", () => {
  it("keeps programs closed within the window", () => {
    expect(isRecentlyClosed({ opensAt: null, closesAt: at(-1) }, now)).toBe(true);
  });

  it("drops programs closed before the window", () => {
    expect(
      isRecentlyClosed({ opensAt: null, closesAt: at(-(RECENTLY_CLOSED_DAYS + 1)) }, now),
    ).toBe(false);
  });

  it("is false for open programs", () => {
    expect(isRecentlyClosed({ opensAt: null, closesAt: at(1) }, now)).toBe(false);
    expect(isRecentlyClosed({ opensAt: null, closesAt: null }, now)).toBe(false);
  });
});
