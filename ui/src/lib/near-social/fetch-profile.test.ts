import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchResolvedNearProfile } from "./fetch-profile";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  };
}

describe("fetchResolvedNearProfile", () => {
  it("prefers the new api2 profile when has_profile is true", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/v1/accounts/mob.near")) {
        return jsonResponse({
          account_id: "mob.near",
          has_profile: true,
          name: "Eugene",
          about: "Founder",
          avatar: null,
          avatar_url: "https://main.fastfs.io/avatar.webp",
          banner: null,
          banner_url: null,
          location: null,
          links: { github: "evgenykuzyakov" },
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const profile = await fetchResolvedNearProfile("mob.near");
    expect(profile.source).toBe("new");
    expect(profile.hasNewProfile).toBe(true);
    expect(profile.name).toBe("Eugene");
    expect(profile.image?.url).toBe("https://main.fastfs.io/avatar.webp");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to api2 legacy when the new profile is empty", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/v1/accounts/root.near")) {
        return jsonResponse({
          account_id: "root.near",
          has_profile: false,
          name: null,
          about: null,
          avatar: null,
          avatar_url: null,
          banner: null,
          banner_url: null,
          location: null,
          links: {},
        });
      }
      if (url.includes("/v1/legacy/root.near")) {
        return jsonResponse({
          account_id: "root.near",
          exists: true,
          profile: {
            name: "Illia",
            about: "Bringing 1B users to web3",
            location: null,
            links: { x: "ilblackdragon" },
          },
          avatar: {
            kind: "url",
            proxy_url: "/v1/legacy/root.near/image/avatar",
            url: "https://example.com/a.png",
          },
          banner: null,
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const profile = await fetchResolvedNearProfile("root.near");
    expect(profile.source).toBe("legacy");
    expect(profile.hasLegacyProfile).toBe(true);
    expect(profile.hasNewProfile).toBe(false);
    expect(profile.name).toBe("Illia");
    expect(profile.linktree).toEqual({ twitter: "ilblackdragon" });
  });

  it("returns an empty profile when neither source has data", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/v1/accounts/nobody.near")) {
        return jsonResponse({
          account_id: "nobody.near",
          has_profile: false,
          name: null,
          about: null,
          avatar: null,
          avatar_url: null,
          banner: null,
          banner_url: null,
          location: null,
          links: {},
        });
      }
      if (url.includes("/v1/legacy/nobody.near")) {
        return jsonResponse({
          account_id: "nobody.near",
          exists: false,
          profile: { name: null, about: null, location: null, links: {} },
          avatar: null,
          banner: null,
        });
      }
      if (url.includes("api.near.social/get")) {
        return jsonResponse({});
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const profile = await fetchResolvedNearProfile("nobody.near");
    expect(profile.source).toBe("none");
    expect(profile.hasNewProfile).toBe(false);
    expect(profile.hasLegacyProfile).toBe(false);
  });
});
