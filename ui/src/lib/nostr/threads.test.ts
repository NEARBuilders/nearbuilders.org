import { describe, expect, it } from "vitest";
import { buildThreads } from "./threads";
import type { NearNostrComment } from "./types";

function make(id: string, createdAt: number, parentId?: string): NearNostrComment {
  return {
    eventId: id,
    pubkey: "pub",
    content: `content ${id}`,
    createdAt,
    target: { type: "project", id: "x" },
    ...(parentId ? { parentId } : {}),
  };
}

describe("buildThreads", () => {
  it("separates top-level comments from replies", () => {
    const tree = buildThreads([make("t1", 100), make("r1", 200, "t1"), make("t2", 300)]);

    expect(tree.map((n) => n.eventId)).toEqual(["t2", "t1"]);
    expect(tree.find((n) => n.eventId === "t1")?.children.map((c) => c.eventId)).toEqual(["r1"]);
  });

  it("sorts top-level newest-first and replies oldest-first", () => {
    const tree = buildThreads([
      make("t1", 100),
      make("t2", 300),
      make("r2", 250, "t1"),
      make("r1", 200, "t1"),
    ]);

    expect(tree.map((n) => n.eventId)).toEqual(["t2", "t1"]);
    expect(tree.find((n) => n.eventId === "t1")?.children.map((c) => c.eventId)).toEqual([
      "r1",
      "r2",
    ]);
  });

  it("nests multi-level replies recursively", () => {
    const tree = buildThreads([make("t1", 100), make("r1", 200, "t1"), make("r1r1", 300, "r1")]);

    const t1 = tree.find((n) => n.eventId === "t1");
    expect(t1?.children.map((c) => c.eventId)).toEqual(["r1"]);
    expect(t1?.children[0]?.children.map((c) => c.eventId)).toEqual(["r1r1"]);
  });

  it("promotes orphaned replies to top level by default", () => {
    const tree = buildThreads([make("t1", 100), make("orphan", 200, "missing")]);

    expect(tree.map((n) => n.eventId)).toEqual(["orphan", "t1"]);
  });

  it("hides orphaned replies when orphans is hide", () => {
    const tree = buildThreads([make("t1", 100), make("orphan", 200, "missing")], {
      orphans: "hide",
    });

    expect(tree.map((n) => n.eventId)).toEqual(["t1"]);
  });
});
