import { describe, expect, it } from "vitest";
import { findCatalogListing } from "./catalog-listing";

const listings = [
  {
    kind: "person" as const,
    entityId: "maker.testnet",
    slug: "maker.testnet",
    status: "approved" as const,
    catalogUrl: null,
  },
];

describe("findCatalogListing", () => {
  it("matches NEAR accounts without caring about case", () => {
    expect(findCatalogListing(listings, "Maker.Testnet")).toEqual(listings[0]);
  });

  it("returns nothing for records that are not listed", () => {
    expect(findCatalogListing(listings, "other.testnet")).toBeNull();
    expect(findCatalogListing(undefined, "maker.testnet")).toBeNull();
    expect(findCatalogListing(listings, null)).toBeNull();
  });
});
