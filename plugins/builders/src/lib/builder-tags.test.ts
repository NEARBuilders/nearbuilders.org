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

  it("accepts Remote aliases", () => {
    expect(normalizeLocation("remote")).toBe("Remote");
    expect(normalizeLocation("Worldwide")).toBe("Remote");
  });

  it("rejects non-geographic values", () => {
    expect(resolveLocation("asdf")).toEqual({ ok: false });
    expect(resolveLocation("bangalore")).toEqual({ ok: false });
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
