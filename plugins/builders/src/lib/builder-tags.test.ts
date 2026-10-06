import { describe, expect, it } from "vitest";
import {
  extractCountry,
  locationError,
  normalizeLocation,
  normalizeSkills,
  properCaseSkill,
  resolveLocation,
  sortFilterValues,
  valuesMatch,
} from "./builder-tags";

describe("normalizeLocation", () => {
  it("trims and canonicalizes countries", () => {
    expect(normalizeLocation("  india  ")).toBe("India");
    expect(normalizeLocation("INDIA")).toBe("India");
    expect(normalizeLocation("usa")).toBe("United States");
    expect(normalizeLocation("UK")).toBe("United Kingdom");
  });

  it("keeps city, country pairs when the country is known", () => {
    expect(normalizeLocation("bangalore, india")).toBe("Bangalore, India");
    expect(normalizeLocation("Lisbon, Portugal")).toBe("Lisbon, Portugal");
  });

  it("accepts every country, not only a shortlist", () => {
    expect(normalizeLocation("Iraq")).toBe("Iraq");
    expect(normalizeLocation("baghdad, iraq")).toBe("Baghdad, Iraq");
    expect(normalizeLocation("Kaduna, Nigeria")).toBe("Kaduna, Nigeria");
    expect(normalizeLocation("vietnam")).toBe("Vietnam");
    expect(normalizeLocation("Hanoi, Viet Nam")).toBe("Hanoi, Vietnam");
    expect(normalizeLocation("Guinea-Bissau")).toBe("Guinea-Bissau");
  });

  it("matches common alternate names and accented spellings", () => {
    expect(normalizeLocation("Türkiye")).toBe("Turkey");
    expect(normalizeLocation("Ivory Coast")).toBe("Côte d'Ivoire");
    expect(normalizeLocation("Abidjan, Cote d'Ivoire")).toBe("Abidjan, Côte d'Ivoire");
    expect(normalizeLocation("México")).toBe("Mexico");
    expect(normalizeLocation("Czech Republic")).toBe("Czechia");
    expect(normalizeLocation("Holland")).toBe("Netherlands");
  });

  it("accepts Remote aliases", () => {
    expect(normalizeLocation("remote")).toBe("Remote");
    expect(normalizeLocation("Worldwide")).toBe("Remote");
  });

  it("rejects non-geographic values", () => {
    expect(resolveLocation("asdf")).toEqual({ ok: false });
    expect(resolveLocation("bangalore")).toEqual({ ok: false });
    expect(resolveLocation("Kaduna, Nigerian")).toEqual({ ok: false });
    expect(resolveLocation("Egypt | Remote Web3 Builder")).toEqual({ ok: false });
    expect(locationError("asdf")).toBeTruthy();
    expect(normalizeLocation("")).toBeNull();
  });
});

describe("extractCountry", () => {
  it("returns only the country for filter options", () => {
    expect(extractCountry("bangalore, india")).toBe("India");
    expect(extractCountry("India")).toBe("India");
    expect(extractCountry("Remote")).toBe("Remote");
    expect(extractCountry("not a place")).toBeNull();
  });
});

describe("normalizeSkills", () => {
  it("proper-cases and dedupes against existing tags", () => {
    expect(properCaseSkill("typeScript")).toBe("TypeScript");
    expect(normalizeSkills(["rust", "TypeScript", "typescript", "smart contracts"])).toEqual([
      "Rust",
      "TypeScript",
      "Smart Contracts",
    ]);
    expect(normalizeSkills("react, REACT, near")).toEqual(["React", "NEAR"]);
  });
});

describe("sortFilterValues", () => {
  it("sorts case-insensitively and drops casing duplicates", () => {
    expect(sortFilterValues(["Rust", "smart contract", "TypeScript", "typescript"])).toEqual([
      "Rust",
      "smart contract",
      "TypeScript",
    ]);
    expect(valuesMatch("TypeScript", "typescript")).toBe(true);
  });
});
