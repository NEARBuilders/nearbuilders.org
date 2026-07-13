import { describe, expect, it } from "vitest";
import { normalizeCatalogDirectoryProject, shouldLoadCatalogProjects } from "./catalog-projects";

const claimedProject = {
  project: {
    slug: "ref-finance",
    projectRef: "nearcatalog:ref-finance",
    name: "Ref Finance",
    tagline: "DeFi on NEAR",
    description: "Exchange",
    imageUrl: "https://example.com/ref.png",
    repositoryUrl: "https://github.com/ref-finance/ref-ui",
    catalogUrl: "https://nearcatalog.xyz/project/ref-finance",
    tags: ["DeFi"],
    phase: "mainnet",
    status: "active",
  },
  contributors: [
    {
      id: "claim:alice.near:ref-finance",
      nearAccount: "alice.near",
      roles: ["Developer"],
      createdAt: "2026-07-12T00:00:00.000Z",
      updatedAt: "2026-07-13T00:00:00.000Z",
    },
    {
      id: "claim:bob.near:ref-finance",
      nearAccount: "bob.near",
      roles: ["Designer"],
      createdAt: "2026-07-11T00:00:00.000Z",
      updatedAt: "2026-07-14T00:00:00.000Z",
    },
  ],
};

describe("Catalog project projections", () => {
  it("uses stable vote IDs, current source links, and aggregated contributors", () => {
    const normalized = normalizeCatalogDirectoryProject(claimedProject);

    expect(normalized).toMatchObject({
      id: "nearcatalog:ref-finance",
      kind: "project",
      source: "nearcatalog",
      catalogUrl: "https://nearcatalog.xyz/project/ref-finance",
      repository: "https://github.com/ref-finance/ref-ui",
      createdAt: "2026-07-11T00:00:00.000Z",
      updatedAt: "2026-07-14T00:00:00.000Z",
      contributors: [
        { nearAccount: "alice.near", roles: ["Developer"] },
        { nearAccount: "bob.near", roles: ["Designer"] },
      ],
    });
  });

  it("participates only in public All and Projects filters with a resolved personal owner", () => {
    expect(shouldLoadCatalogProjects({ kind: "all", personal: false, privateOnly: false })).toBe(
      true,
    );
    expect(
      shouldLoadCatalogProjects({
        kind: "project",
        personal: true,
        privateOnly: false,
        ownerId: "alice.near",
      }),
    ).toBe(true);
    expect(shouldLoadCatalogProjects({ kind: "idea", personal: false, privateOnly: false })).toBe(
      false,
    );
    expect(
      shouldLoadCatalogProjects({
        kind: "project",
        personal: true,
        privateOnly: true,
        ownerId: "alice.near",
      }),
    ).toBe(false);
  });
});
