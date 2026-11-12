import { describe, expect, it, vi } from "vitest";
import {
  isInternalProgramUrl,
  isProgramOpen,
  openPrograms,
  type Program,
  programDateLabel,
  programsForTopic,
  programsQueryOptions,
} from "./programs";

const now = new Date("2026-11-07T12:00:00.000Z");

function program(overrides: Partial<Program> = {}): Program {
  return {
    id: "prog_1",
    projectId: "proj_1",
    type: "credits",
    title: "NEAR AI Cloud credits",
    summary: null,
    rewards: "$500 in NEAR AI Cloud credits",
    eligibility: "Approved NEAR Builders",
    ctaLabel: "Claim credits",
    ctaUrl: "/dashboard",
    topicId: "private-cloud",
    opensAt: null,
    closesAt: null,
    sortOrder: 0,
    state: "open",
    project: {
      id: "proj_1",
      kind: "project",
      slug: "near-ai",
      title: "NEAR AI",
      ownerId: "nearbuilding.near",
      logoUrl: null,
    },
    ...overrides,
  };
}

describe("open/closed filter", () => {
  it("keeps rolling and in-window programs", () => {
    expect(isProgramOpen(program(), now)).toBe(true);
    expect(
      isProgramOpen(
        program({ opensAt: "2026-11-01T00:00:00.000Z", closesAt: "2026-11-30T00:00:00.000Z" }),
        now,
      ),
    ).toBe(true);
  });

  it("drops programs past closesAt", () => {
    expect(isProgramOpen(program({ closesAt: "2026-11-07T11:59:59.000Z" }), now)).toBe(false);
    expect(isProgramOpen(program({ closesAt: now.toISOString() }), now)).toBe(false);
  });

  it("drops programs that have not opened yet", () => {
    expect(isProgramOpen(program({ opensAt: "2026-11-08T00:00:00.000Z" }), now)).toBe(false);
  });

  it("filters a list down to open programs, keeping order", () => {
    const list = [
      program({ id: "a" }),
      program({ id: "b", closesAt: "2026-11-01T00:00:00.000Z" }),
      program({ id: "c", closesAt: "2026-12-01T00:00:00.000Z" }),
    ];
    expect(openPrograms(list, now).map((p) => p.id)).toEqual(["a", "c"]);
    expect(openPrograms([program({ closesAt: "2026-11-01T00:00:00.000Z" })], now)).toEqual([]);
  });
});

describe("program helpers", () => {
  it("labels dates as rolling, closing or closed", () => {
    expect(programDateLabel(program(), now)).toBe("Rolling");
    expect(programDateLabel(program({ closesAt: "2026-11-30T12:00:00.000Z" }), now)).toBe(
      "Closes 30 Nov",
    );
    expect(programDateLabel(program({ closesAt: "2026-11-01T00:00:00.000Z" }), now)).toBe("Closed");
  });

  it("picks programs for a topic", () => {
    const list = [program({ id: "a" }), program({ id: "b", topicId: null })];
    expect(programsForTopic(list, "private-cloud").map((p) => p.id)).toEqual(["a"]);
    expect(programsForTopic(list, "smart-contracts")).toEqual([]);
  });

  it("tells internal paths from external URLs", () => {
    expect(isInternalProgramUrl("/dashboard")).toBe(true);
    expect(isInternalProgramUrl("//evil.example")).toBe(false);
    expect(isInternalProgramUrl("https://cloud.near.ai")).toBe(false);
  });

  it("loads programs from listPrograms", async () => {
    const listPrograms = vi.fn().mockResolvedValue({ data: [program()] });
    const options = programsQueryOptions({
      projects: { listPrograms, getProjectPrograms: vi.fn() },
    });
    expect(await options.queryFn()).toEqual([program()]);
    expect(listPrograms).toHaveBeenCalledWith({});
  });
});
