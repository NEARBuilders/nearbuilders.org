import { describe, expect, it } from "vitest";
import { createXNominationCsvData } from "../../../../lib/export-csv";
import {
  filterXNominationGroups,
  groupXNominationRecords,
  X_QUEUE_STATUS_FILTERS,
  type XNominationRecord,
  xNominationContext,
} from "../../../../lib/x-nomination-queue";

function nomination(overrides: Partial<XNominationRecord> = {}): XNominationRecord {
  return {
    id: "canonical",
    canonicalNominationId: "canonical",
    isCanonical: true,
    sourcePostId: "post-1",
    sourcePostUrl: "https://x.com/nominator/status/post-1",
    sourcePostText: "@nearbuilders !onboard @alice",
    sourcePostCreatedAt: "2026-08-08T10:00:00.000Z",
    conversationId: null,
    replyToPostId: null,
    nominatorXId: "nominator-id",
    nominatorXUsername: "nominator",
    nomineeXId: "nominee-id",
    nomineeXUsername: "alice",
    linkedNomineeBuilderId: null,
    linkedNomineeNearAccount: null,
    linkedNominatorBuilderId: null,
    linkedNominatorNearAccount: null,
    canonicalSourcePostId: "post-1",
    sourceReferralCount: 1,
    joinUrl: "https://nearbuilders.org/join?token=token",
    engagementStatus: "pending_contact",
    replyUrl: null,
    contactedAt: null,
    rejectedAt: null,
    completedAt: null,
    engagementUpdatedAt: "2026-08-08T10:00:00.000Z",
    updatedBy: null,
    firstOpenedAt: null,
    lastOpenedAt: null,
    openCount: 0,
    proposalId: null,
    submittedNearAccount: null,
    submittedAt: null,
    profileStatus: "not_started",
    createdAt: "2026-08-08T10:00:00.000Z",
    ...overrides,
  };
}

describe("X nomination admin filters", () => {
  it("offers every engagement state", () => {
    expect(X_QUEUE_STATUS_FILTERS.map((filter) => filter.value)).toEqual([
      "all",
      "pending_contact",
      "contacted",
      "rejected",
      "completed",
    ]);
  });

  it("uses reviewer-friendly labels", () => {
    expect(X_QUEUE_STATUS_FILTERS.map((filter) => filter.label)).toEqual([
      "All",
      "Pending",
      "Contacted",
      "Rejected",
      "Completed",
    ]);
  });

  it("shows one canonical review row for duplicate referrals", () => {
    const additional = nomination({
      id: "referral",
      isCanonical: false,
      sourcePostId: "post-2",
      sourcePostText: "Second referral for @alice",
    });
    const canonical = nomination({ sourceReferralCount: 2 });

    const groups = groupXNominationRecords([additional, canonical]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.nomination.id).toBe("canonical");
    expect(groups[0]?.referrals).toHaveLength(2);
    expect(filterXNominationGroups(groups, "pending_contact", "Second referral")).toHaveLength(1);

    const csv = createXNominationCsvData(groups);
    expect(csv.rows).toHaveLength(1);
    expect(csv.rows[0]?.[7]).toEqual(["post-2", "post-1"]);
  });

  it("separates referral context from bot command syntax", () => {
    expect(xNominationContext(nomination())).toBeNull();
    expect(
      xNominationContext(
        nomination({
          sourcePostText: "Excellent Rust contributor — @nearbuilders !onboard @alice",
        }),
      ),
    ).toBe("Excellent Rust contributor");
  });
});
