import { describe, expect, it } from "vitest";
import { parseProjectListSearch } from "./-search";

describe("parseProjectListSearch", () => {
  it("parses verified from boolean or string flags", () => {
    expect(parseProjectListSearch({ verified: true }).verified).toBe(true);
    expect(parseProjectListSearch({ verified: "true" }).verified).toBe(true);
    expect(parseProjectListSearch({}).verified).toBeUndefined();
  });

  it("clears private when verified is on", () => {
    expect(
      parseProjectListSearch({ personal: true, private: true, verified: true }),
    ).toMatchObject({
      personal: true,
      verified: true,
      private: undefined,
    });
  });
});
