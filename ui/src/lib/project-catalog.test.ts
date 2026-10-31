import { describe, expect, it } from "vitest";
import {
  emptyProjectCatalog,
  getCatalogReadiness,
  getProjectCatalogErrors,
  projectCatalogFromFormValues,
  projectCatalogToFormValues,
} from "./project-catalog";

describe("project catalog form values", () => {
  it("drops empty values and returns null when nothing is set", () => {
    expect(projectCatalogFromFormValues(emptyProjectCatalog())).toBeNull();
    expect(
      projectCatalogFromFormValues({
        ...emptyProjectCatalog(),
        tagline: "  ",
        links: { twitter: " " },
      }),
    ).toBeNull();
  });

  it("round-trips stored metadata", () => {
    const catalog = {
      tagline: "One line",
      categories: ["defi", "dex"],
      phase: "testnet" as const,
      links: { twitter: "https://x.com/example" },
      tokenContract: "token.example.near",
      coingeckoId: "example",
    };
    const values = projectCatalogToFormValues(catalog);
    expect(values.links.telegram).toBe("");
    expect(projectCatalogFromFormValues(values)).toEqual(catalog);
  });

  it("keeps links the form does not render, like a github link set over MCP", () => {
    const catalog = {
      tagline: "One line",
      categories: ["defi"],
      phase: "testnet" as const,
      links: { github: "https://github.com/example" },
    };
    const values = projectCatalogToFormValues(catalog);
    expect(values.links.github).toBe("https://github.com/example");
    expect(projectCatalogFromFormValues(values)).toEqual(catalog);
  });

  it("lowercases the token contract and CoinGecko id", () => {
    expect(
      projectCatalogFromFormValues({
        ...emptyProjectCatalog(),
        tokenContract: " Token.Example.NEAR ",
        coingeckoId: "Example",
      }),
    ).toEqual({ tokenContract: "token.example.near", coingeckoId: "example" });
  });

  it("reports invalid fields", () => {
    expect(
      getProjectCatalogErrors({
        ...emptyProjectCatalog(),
        tagline: "a".repeat(141),
        categories: ["a", "b", "c", "d", "e", "f", "g"],
        links: { twitter: "x.com/example" },
        tokenContract: "not a contract",
        coingeckoId: "bad id",
      }),
    ).toEqual({
      tagline: "Max 140 characters",
      categories: "Pick up to 6 categories",
      twitter: "Must be an absolute http(s) URL",
      tokenContract: "Enter a NEAR account id like token.example.near",
      coingeckoId: "Use the CoinGecko API id, like near or ref-finance",
    });
  });
});

describe("catalog readiness", () => {
  it("lists what NEAR Catalog still needs", () => {
    const readiness = getCatalogReadiness({
      description: "Short description",
      logoUrl: null,
      catalog: { categories: ["defi"] },
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.missing.map((item) => item.key)).toEqual(["tagline", "logo"]);
  });

  it("is ready with tagline, description, logo and a category", () => {
    expect(
      getCatalogReadiness({
        description: "Short description",
        logoUrl: "https://cdn.example.com/logo.png",
        catalog: { tagline: "One line", categories: ["defi"] },
      }).ready,
    ).toBe(true);
  });

  it("counts an uploaded logo as complete", () => {
    const readiness = getCatalogReadiness({
      description: "Short description",
      logoUrl: "https://cdn.everything.dev/storage/feedback/builder.near/2b7c-logo.png",
      catalog: { tagline: "One line", categories: ["defi"] },
    });
    expect(readiness.missing.map((item) => item.key)).toEqual([]);
    expect(readiness.ready).toBe(true);
  });

  it("does not count an unsafe logo value as complete", () => {
    const readiness = getCatalogReadiness({
      description: "Short description",
      logoUrl: "javascript:alert(1)",
      catalog: { tagline: "One line", categories: ["defi"] },
    });
    expect(readiness.missing.map((item) => item.key)).toEqual(["logo"]);
  });
});
