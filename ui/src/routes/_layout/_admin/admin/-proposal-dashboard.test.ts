import { describe, expect, it } from "vitest";
import { createProposalCsvData, escapeCsvField, serializeCsv } from "../../../../lib/export-csv";
import {
  getProposalState,
  getProposalTitle,
  hasCanonicalPage,
  isLifecycleStalled,
  type ProposalRecord,
  parseDashboardSearch,
} from "./-proposal-dashboard";

function proposal(overrides: Partial<ProposalRecord> = {}): ProposalRecord {
  return {
    id: "proposal-1",
    pluginId: "projects",
    entityId: "project-1",
    operation: "create",
    payload: { title: "Example project", slug: "example-project", kind: "project" },
    schemaVersion: "1",
    createdBy: "builder.near",
    reviewStatus: "pending",
    applyStatus: "not_started",
    removeStatus: "not_started",
    rejectionReason: null,
    applyError: null,
    removeError: null,
    appliedResourceId: null,
    submissionCount: 1,
    appliedAt: null,
    removedAt: null,
    createdAt: "2026-07-27T10:00:00.000Z",
    updatedAt: "2026-07-27T10:00:00.000Z",
    ...overrides,
  };
}

describe("admin proposal dashboard", () => {
  it("keeps dashboard state canonical", () => {
    expect(parseDashboardSearch({ tab: "builders", status: "all", item: "" })).toEqual({
      tab: undefined,
      status: undefined,
      item: undefined,
    });
    expect(
      parseDashboardSearch({ tab: "activity", status: "rejected", item: "claim:alice:project" }),
    ).toEqual({
      tab: "activity",
      status: "rejected",
      item: "claim:alice:project",
    });
  });

  it("uses payload data for item titles", () => {
    expect(getProposalTitle(proposal())).toBe("Example project");
    expect(
      getProposalTitle(
        proposal({ pluginId: "nearcatalog", payload: { projectSlug: "catalog-project" } }),
      ),
    ).toBe("catalog-project");
  });

  it("surfaces lifecycle failures before review state", () => {
    expect(
      getProposalState(
        proposal({ reviewStatus: "approved", applyStatus: "failed", applyError: "failed" }),
      ),
    ).toEqual({ label: "Apply failed", tone: "failed" });
    expect(
      getProposalState(
        proposal({ reviewStatus: "approved", removeStatus: "failed", removeError: "failed" }),
      ),
    ).toEqual({ label: "Revocation failed", tone: "failed" });
    expect(
      getProposalState(
        proposal({ reviewStatus: "rejected", applyStatus: "failed", applyError: "failed" }),
      ),
    ).toEqual({ label: "Rejected", tone: "rejected" });
  });

  it("makes stalled lifecycle work retryable after five minutes", () => {
    const updatedAt = "2026-07-27T10:00:00.000Z";
    const timeout = Date.parse(updatedAt) + 5 * 60 * 1000;
    const applying = proposal({
      reviewStatus: "approved",
      applyStatus: "applying",
      updatedAt,
    });
    const removing = proposal({
      reviewStatus: "approved",
      applyStatus: "applied",
      removeStatus: "removing",
      updatedAt,
    });

    expect(isLifecycleStalled(applying, timeout - 1)).toBe(false);
    expect(isLifecycleStalled(applying, timeout)).toBe(true);
    expect(getProposalState(applying, timeout)).toEqual({
      label: "Application stalled",
      tone: "failed",
    });
    expect(getProposalState(removing, timeout)).toEqual({
      label: "Revocation stalled",
      tone: "failed",
    });
  });

  it("links admin project pages while guarding unavailable event pages", () => {
    expect(hasCanonicalPage(proposal())).toBe(true);
    expect(
      hasCanonicalPage(
        proposal({ pluginId: "events", reviewStatus: "approved", applyStatus: "failed" }),
      ),
    ).toBe(true);
    expect(hasCanonicalPage(proposal({ pluginId: "builders" }))).toBe(true);
    expect(hasCanonicalPage(proposal({ pluginId: "nearcatalog" }))).toBe(false);
  });
});

describe("proposal CSV export", () => {
  it("neutralizes spreadsheet formulas and quotes fields", () => {
    expect(escapeCsvField("=IMPORTXML(A1)")).toBe("'=IMPORTXML(A1)");
    expect(escapeCsvField("safe, value")).toBe('"safe, value"');
    expect(serializeCsv(["value"], [["+SUM(A1:A2)"]])).toBe("value\r\n'+SUM(A1:A2)");
  });

  it("includes lifecycle and type-specific columns", () => {
    const data = createProposalCsvData([proposal()], "projects");
    expect(data.headers).toContain("reviewStatus");
    expect(data.headers).toContain("applyError");
    expect(data.headers).toContain("repository");
    expect(data.headers).toContain("content");
    expect(data.rows).toHaveLength(1);

    const eventData = createProposalCsvData(
      [proposal({ pluginId: "events", payload: { title: "Demo", ownerId: "owner.near" } })],
      "events",
    );
    expect(eventData.headers).toContain("ownerId");
  });
});
