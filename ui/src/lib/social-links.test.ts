import { describe, expect, it } from "vitest";
import { mergeSocialLinks, socialLinkToUrl, validateHandle } from "./social-links";

describe("socialLinkToUrl", () => {
  it("turns social handles into absolute external URLs", () => {
    expect(socialLinkToUrl("github", "saadiqbal-dev")).toBe("https://github.com/saadiqbal-dev");
    expect(socialLinkToUrl("telegram", "@nearbuilders")).toBe("https://t.me/nearbuilders");
  });

  it("normalizes complete and scheme-less social URLs", () => {
    expect(socialLinkToUrl("github", "https://github.com/nearbuilders")).toBe(
      "https://github.com/nearbuilders",
    );
    expect(socialLinkToUrl("website", "http://nearbuilders.org")).toBe("http://nearbuilders.org");
    expect(socialLinkToUrl("github", "github.com/nearbuilders")).toBe(
      "https://github.com/nearbuilders",
    );
  });
});

describe("Discord user IDs", () => {
  it("turns a numeric discord user id into a profile link", () => {
    expect(socialLinkToUrl("discord", "123456789012345678")).toBe(
      "https://discord.com/users/123456789012345678",
    );
  });

  it("round-trips an already-complete discord URL", () => {
    expect(socialLinkToUrl("discord", "https://discord.com/users/123456789012345678")).toBe(
      "https://discord.com/users/123456789012345678",
    );
  });
});

describe("validateHandle", () => {
  it("accepts a numeric discord user id", () => {
    expect(validateHandle("discord", "123456789012345678")).toBeUndefined();
  });

  it("rejects a non-numeric discord handle", () => {
    expect(validateHandle("discord", "nearbuilders#1234")).toBe(
      "Must be a numeric Discord user ID",
    );
  });

  it("has no numeric constraint for other platforms", () => {
    expect(validateHandle("github", "nearbuilders")).toBeUndefined();
  });
});

describe("mergeSocialLinks", () => {
  it("normalizes links and lets later builder data override social profile data", () => {
    expect(
      mergeSocialLinks(
        {
          github: "near-social",
          telegram: "@near_social",
          ignored: null,
        },
        {
          github: "nearbuilders",
          website: "nearbuilders.org",
        },
      ),
    ).toEqual({
      github: "https://github.com/nearbuilders",
      telegram: "https://t.me/near_social",
      website: "https://nearbuilders.org",
    });
  });

  it("omits empty and non-string values", () => {
    expect(
      mergeSocialLinks({
        github: " ",
        telegram: false,
        website: undefined,
      }),
    ).toEqual({});
  });
});
