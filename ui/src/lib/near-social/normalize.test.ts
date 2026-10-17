import { describe, expect, it } from "vitest";
import {
  emptyNearProfile,
  isNearAccountId,
  needsLegacySocialImport,
  normalizeLinktree,
  profileFromLegacyApi,
  profileFromNewApi,
} from "./normalize";

describe("normalizeLinktree", () => {
  it("maps x to twitter for existing UI fields", () => {
    expect(normalizeLinktree({ x: "ekuzyakov", github: "evgenykuzyakov" })).toEqual({
      twitter: "ekuzyakov",
      github: "evgenykuzyakov",
    });
  });

  it("drops empty values", () => {
    expect(normalizeLinktree({ github: " ", website: "near.social" })).toEqual({
      website: "near.social",
    });
  });
});

describe("profileFromNewApi", () => {
  it("maps api2 profile fields into the UI shape", () => {
    const profile = profileFromNewApi("mob.near", {
      account_id: "mob.near",
      has_profile: true,
      name: "Eugene",
      about: "Founder",
      avatar: "fastfs://mob.near/social/media/a.webp",
      avatar_url: "https://main.fastfs.io/mob.near/social/media/a.webp",
      banner: null,
      banner_url: null,
      location: "Remote",
      links: { x: "ekuzyakov", github: "evgenykuzyakov" },
    });

    expect(profile).toMatchObject({
      accountId: "mob.near",
      name: "Eugene",
      description: "Founder",
      image: { url: "https://main.fastfs.io/mob.near/social/media/a.webp" },
      linktree: { twitter: "ekuzyakov", github: "evgenykuzyakov" },
      location: "Remote",
      hasNewProfile: true,
      hasLegacyProfile: false,
      source: "new",
    });
  });
});

describe("profileFromLegacyApi", () => {
  it("maps legacy proxy images and profile fields", () => {
    const profile = profileFromLegacyApi("root.near", {
      account_id: "root.near",
      exists: true,
      profile: {
        name: "Illia",
        about: "Bringing 1B users to web3",
        location: null,
        links: { x: "ilblackdragon", website: "near.org" },
      },
      avatar: {
        kind: "url",
        proxy_url: "/v1/legacy/root.near/image/avatar",
        url: "https://example.com/avatar.png",
      },
      banner: {
        kind: "ipfs",
        proxy_url: "/v1/legacy/root.near/image/banner",
        cid: "bafybanner",
      },
    });

    expect(profile).toMatchObject({
      accountId: "root.near",
      name: "Illia",
      description: "Bringing 1B users to web3",
      image: { url: "https://example.com/avatar.png" },
      backgroundImage: { url: "https://ipfs.near.social/ipfs/bafybanner" },
      linktree: { twitter: "ilblackdragon", website: "near.org" },
      hasNewProfile: false,
      hasLegacyProfile: true,
      source: "legacy",
    });
  });
});

describe("needsLegacySocialImport", () => {
  it("is true only for legacy-only profiles", () => {
    expect(needsLegacySocialImport(emptyNearProfile("a.near"))).toBe(false);
    expect(
      needsLegacySocialImport({
        ...emptyNearProfile("a.near"),
        hasLegacyProfile: true,
        source: "legacy",
      }),
    ).toBe(true);
    expect(
      needsLegacySocialImport({
        ...emptyNearProfile("a.near"),
        hasNewProfile: true,
        hasLegacyProfile: true,
        source: "new",
      }),
    ).toBe(false);
  });
});

describe("isNearAccountId", () => {
  it("accepts named and implicit accounts", () => {
    expect(isNearAccountId("alice.near")).toBe(true);
    expect(isNearAccountId("a".repeat(64))).toBe(true);
    expect(isNearAccountId("user_abc")).toBe(false);
    expect(isNearAccountId(null)).toBe(false);
  });
});
