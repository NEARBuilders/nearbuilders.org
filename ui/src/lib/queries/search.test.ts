import { describe, expect, it } from "vitest";
import {
  countResults,
  filterEvents,
  flattenResults,
  type GlobalSearchResults,
  toBuilderResult,
  toEventResult,
  toProjectResult,
} from "./search";

const event = (over: Partial<Parameters<typeof toEventResult>[0]> = {}) => ({
  id: "e1",
  slug: "near-day",
  title: "NEAR Day",
  description: "A day for NEAR builders",
  location: "Lisbon",
  startAt: "2026-09-01T10:00:00Z",
  visibility: "public",
  status: "active",
  ...over,
});

describe("toBuilderResult", () => {
  it("prefers name, falls back to bio then skills then account for the subtitle", () => {
    expect(
      toBuilderResult({
        id: "b1",
        nearAccount: "alice.near",
        name: "Alice",
        bio: "DeFi",
        skills: [],
      }),
    ).toEqual({
      id: "builder:b1",
      group: "builders",
      title: "Alice",
      subtitle: "DeFi",
      params: { account: "alice.near" },
    });

    expect(
      toBuilderResult({
        id: "b2",
        nearAccount: "bob.near",
        name: null,
        bio: null,
        skills: ["Rust", "Smart Contracts", "DeFi", "Extra"],
      }),
    ).toMatchObject({ title: "bob.near", subtitle: "Rust · Smart Contracts · DeFi" });
  });
});

describe("toProjectResult", () => {
  it("carries kind + slug as route params", () => {
    expect(
      toProjectResult({
        id: "p1",
        kind: "idea",
        slug: "pay-protocol",
        title: "Pay Protocol",
        description: null,
      }),
    ).toEqual({
      id: "project:p1",
      group: "projects",
      title: "Pay Protocol",
      subtitle: null,
      params: { kind: "idea", slug: "pay-protocol" },
    });
  });
});

describe("toEventResult", () => {
  it("joins a formatted date with the location (locale-independent)", () => {
    const subtitle = toEventResult(event()).subtitle ?? "";
    expect(subtitle).toContain("2026");
    expect(subtitle).toMatch(/ · Lisbon$/);
  });

  it("drops the separator when there is no location", () => {
    const subtitle = toEventResult(event({ location: null })).subtitle ?? "";
    expect(subtitle).toContain("2026");
    expect(subtitle).not.toContain("·");
  });

  it("returns null when the date is unparseable and there is no location", () => {
    expect(toEventResult(event({ location: null, startAt: "not-a-date" })).subtitle).toBeNull();
  });
});

describe("filterEvents", () => {
  it("matches title, description or location case-insensitively", () => {
    const events = [
      event({ id: "a", title: "NEAR Day", description: null, location: null }),
      event({ id: "b", title: "Other", description: "about near stuff", location: null }),
      event({ id: "c", title: "Other", description: null, location: "NEAR HQ" }),
      event({ id: "d", title: "Unrelated", description: "nothing", location: "elsewhere" }),
    ];
    expect(filterEvents(events, "near").map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("excludes non-public and cancelled events, and respects the limit", () => {
    const events = [
      event({ id: "a", visibility: "private" }),
      event({ id: "b", status: "cancelled" }),
      event({ id: "c" }),
      event({ id: "d" }),
    ];
    expect(filterEvents(events, "near", 1).map((e) => e.id)).toEqual(["c"]);
  });

  it("returns nothing for a blank term", () => {
    expect(filterEvents([event()], "   ")).toEqual([]);
  });
});

describe("flattenResults / countResults", () => {
  const results: GlobalSearchResults = {
    builders: [
      toBuilderResult({ id: "b1", nearAccount: "a.near", name: "A", bio: null, skills: [] }),
    ],
    projects: [
      toProjectResult({ id: "p1", kind: "project", slug: "s", title: "P", description: null }),
      toProjectResult({ id: "p2", kind: "project", slug: "s2", title: "P2", description: null }),
    ],
    events: [toEventResult(event())],
  };

  it("flattens in builders → projects → events order", () => {
    expect(flattenResults(results).map((r) => r.id)).toEqual([
      "builder:b1",
      "project:p1",
      "project:p2",
      "event:e1",
    ]);
  });

  it("counts every group", () => {
    expect(countResults(results)).toBe(4);
  });
});
