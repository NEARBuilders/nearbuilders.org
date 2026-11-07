import { describe, expect, it } from "vitest";
import { type CityNode, cityNodePath, cityNodeUrl, suggestCityNode } from "./city-nodes";

const nodes: CityNode[] = [
  {
    key: "freedonia",
    slug: "freedonia",
    name: "Freedonia",
    kind: "country",
    parentKey: null,
    parentId: null,
    depth: 0,
  },
  {
    key: "freedonia/west-province",
    slug: "west-province",
    name: "West Province",
    kind: "state",
    parentKey: "freedonia",
    parentId: "k-1",
    depth: 1,
  },
  {
    key: "freedonia/west-province/hill-valley",
    slug: "hill-valley",
    name: "Hill Valley",
    kind: "city",
    parentKey: "freedonia/west-province",
    parentId: "s-1",
    depth: 2,
  },
  {
    key: "sao-lago",
    slug: "sao-lago",
    name: "São Lago",
    kind: "city",
    parentKey: null,
    parentId: null,
    depth: 0,
  },
];

describe("suggestCityNode", () => {
  it("prefers the city part of a builder location", () => {
    expect(suggestCityNode("Hill Valley, Freedonia", nodes)?.key).toBe(
      "freedonia/west-province/hill-valley",
    );
  });

  it("suggests nothing when only the country matches", () => {
    expect(suggestCityNode("Shelbyville, Freedonia", nodes)).toBeUndefined();
    expect(suggestCityNode("Freedonia", nodes)).toBeUndefined();
  });

  it("ignores case and accents", () => {
    expect(suggestCityNode("sao lago", nodes)?.key).toBe("sao-lago");
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
    expect(cityNodeUrl("sao-lago", nodes[3])).toBe("https://citynode.app/n/sao-lago");
    expect(cityNodeUrl(nodes[2].key, nodes[2], "https://citynode.test/")).toBe(
      "https://citynode.test/n/hill-valley?parentId=s-1",
    );
    expect(cityNodeUrl("north/springfield")).toBe("https://citynode.app/n/springfield");
  });
});
