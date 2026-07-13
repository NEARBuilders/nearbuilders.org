import { describe, expect, it } from "vitest";
import { canResubmitCatalogClaim } from "./catalog-claims";

describe("Catalog claim resubmission", () => {
  it("allows rejected and revoked proposals to be resubmitted", () => {
    expect(canResubmitCatalogClaim("rejected")).toBe(true);
    expect(canResubmitCatalogClaim("revoked")).toBe(true);
  });

  it("blocks pending and approved proposals from being resubmitted", () => {
    expect(canResubmitCatalogClaim("pending")).toBe(false);
    expect(canResubmitCatalogClaim("approved")).toBe(false);
  });
});
