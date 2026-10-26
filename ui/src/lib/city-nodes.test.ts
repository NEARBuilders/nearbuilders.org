import { describe, expect, it } from "vitest";
import { type CityNode, cityNodePath, cityNodeUrl, suggestCityNode } from "./city-nodes";

const nodes: CityNode[] = [
  { slug: "freedonia", name: "Freedonia", kind: "country", parentSlug: null, depth: 0 },
  {
    slug: "west-province",
    name: "West Province",
    kind: "state",
    parentSlug: "freedonia",
    depth: 1,
  },
  { slug: "hill-valley", name: "Hill Valley", kind: "city", parentSlug: "west-province", depth: 2 },
  { slug: "sao-lago", name: "São Lago", kind: "city", parentSlug: null, depth: 0 },
];

describe("suggestCityNode", () => {
  it("prefers the city part of a builder location", () => {
    expect(suggestCityNode("Hill Valley, Freedonia", nodes)?.slug).toBe("hill-valley");
  });

  it("falls back to the country when no city matches", () => {
    expect(suggestCityNode("Shelbyville, Freedonia", nodes)?.slug).toBe("freedonia");
  });

  it("ignores case and accents", () => {
    expect(suggestCityNode("sao lago", nodes)?.slug).toBe("sao-lago");
  });

  it("suggests nothing for an unknown or empty location", () => {
    expect(suggestCityNode("Atlantis", nodes)).toBeUndefined();
    expect(suggestCityNode("", nodes)).toBeUndefined();
    expect(suggestCityNode("Hill Valley", undefined)).toBeUndefined();
  });
});

describe("cityNodePath", () => {
  it("shows the full country / state / city path", () => {
    expect(cityNodePath(nodes[2], nodes)).toBe("Freedonia / West Province / Hill Valley");
  });
});

describe("cityNodeUrl", () => {
  it("links to the community page on citynode.app", () => {
    expect(cityNodeUrl("hill-valley")).toBe("https://citynode.app/n/hill-valley");
    expect(cityNodeUrl("hill-valley", "https://citynode.test/")).toBe(
      "https://citynode.test/n/hill-valley",
    );
  });
});
