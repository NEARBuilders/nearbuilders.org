import { describe, expect, it } from "vitest";
import { buildCommentTags } from "./relay";

const base = {
  target: { type: "project" as const, id: "x" },
  nearAccountId: "buidlguidl.near",
  pubkey: "self-pubkey",
  clientName: "nostr.nearbuilders.org",
};

describe("buildCommentTags", () => {
  it("top-level has no e tags", () => {
    const tags = buildCommentTags(base);

    expect(tags.filter((t) => t[0] === "e")).toEqual([]);
    expect(tags).toContainEqual(["p", "self-pubkey"]);
    expect(tags).toContainEqual(["near_target", "project:x"]);
  });

  it("reply-to-top-level emits root + reply both at parent", () => {
    const tags = buildCommentTags({
      ...base,
      parentEventId: "A",
      rootEventId: "A",
      parentPubkey: "A-pub",
    });

    const e = tags.filter((t) => t[0] === "e");
    expect(e).toContainEqual(["e", "A", "", "root"]);
    expect(e).toContainEqual(["e", "A", "", "reply"]);
    expect(tags).toContainEqual(["p", "A-pub"]);
  });

  it("reply-to-reply emits root + reply to immediate parent", () => {
    const tags = buildCommentTags({
      ...base,
      parentEventId: "B",
      rootEventId: "A",
      parentPubkey: "B-pub",
    });

    const e = tags.filter((t) => t[0] === "e");
    expect(e).toContainEqual(["e", "A", "", "root"]);
    expect(e).toContainEqual(["e", "B", "", "reply"]);
    expect(tags).toContainEqual(["p", "B-pub"]);
  });

  it("never emits a _near: prefixed p tag", () => {
    const tags = buildCommentTags({
      ...base,
      parentEventId: "B",
      rootEventId: "A",
      parentPubkey: "B-pub",
    });

    expect(tags.some((t) => t[0] === "p" && t[1].startsWith("_near:"))).toBe(false);
  });
});
