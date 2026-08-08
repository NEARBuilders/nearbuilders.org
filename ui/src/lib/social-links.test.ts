import { describe, expect, it } from "vitest";
import { isSocialLinkClickable, mergeSocialLinks, socialLinkToUrl } from "./social-links";

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

describe("Discord handles", () => {
  it("keeps discord handles as plain text instead of a broken link", () => {
    expect(socialLinkToUrl("discord", "@nearbuilders")).toBe("nearbuilders");
    expect(socialLinkToUrl("discord", "nearbuilders#1234")).toBe("nearbuilders#1234");
  });
});

describe("isSocialLinkClickable", () => {
  it("treats absolute http(s) URLs as clickable", () => {
    expect(isSocialLinkClickable("https://github.com/nearbuilders")).toBe(true);
    expect(isSocialLinkClickable("http://nearbuilders.org")).toBe(true);
  });

  it("treats a bare discord handle as not clickable", () => {
    expect(isSocialLinkClickable("nearbuilders#1234")).toBe(false);
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
