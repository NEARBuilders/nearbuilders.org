import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT_SORT, parseProjectListSearch } from "./project-search";

describe("parseProjectListSearch", () => {
  it("parses verified from boolean or string flags", () => {
    expect(parseProjectListSearch({ verified: true }).verified).toBe(true);
    expect(parseProjectListSearch({ verified: "true" }).verified).toBe(true);
    expect(parseProjectListSearch({}).verified).toBeUndefined();
  });

  it("defaults to newest and keeps other sorts in the URL", () => {
    expect(DEFAULT_PROJECT_SORT).toBe("newest");
    expect(parseProjectListSearch({}).sort).toBeUndefined();
    expect(parseProjectListSearch({ sort: "newest" }).sort).toBeUndefined();
    expect(parseProjectListSearch({ sort: "votes" }).sort).toBe("votes");
    expect(parseProjectListSearch({ sort: "oldest" }).sort).toBe("oldest");
    expect(parseProjectListSearch({ sort: "random" }).sort).toBeUndefined();
  });

  it("clears private when verified is on", () => {
    expect(parseProjectListSearch({ personal: true, private: true, verified: true })).toMatchObject(
      {
        personal: true,
        verified: true,
        private: undefined,
      },
    );
  });
});
