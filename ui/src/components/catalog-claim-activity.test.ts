import { describe, expect, it } from "vitest";
import { readCatalogClaimActivityPayload } from "../lib/catalog-activity";

describe("Catalog claim activity payload", () => {
  it("reads the verified project snapshot used by historical feeds", () => {
    expect(
      readCatalogClaimActivityPayload({
        claimId: "claim:alice.near:ref-finance",
        projectSlug: "ref-finance",
        catalogUrl: "https://nearcatalog.xyz/project/ref-finance",
        projectName: "Ref Finance",
        projectTagline: "DeFi on NEAR",
        projectImageUrl: "https://example.com/ref.png",
        repositoryUrl: "https://github.com/ref-finance/ref-ui",
        roles: ["Developer", "Reviewer", 42],
      }),
    ).toMatchObject({
      projectSlug: "ref-finance",
      projectName: "Ref Finance",
      roles: ["Developer", "Reviewer"],
    });
  });

  it("rejects incomplete snapshots", () => {
    expect(readCatalogClaimActivityPayload({ projectSlug: "ref-finance" })).toBeNull();
  });
});
