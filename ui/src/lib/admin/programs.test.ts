import { describe, expect, it } from "vitest";
import {
  type AdminProgram,
  draftToCreateInput,
  draftToUpdateInput,
  emptyProgramDraft,
  moveProgramId,
  nearAiCreditsDraft,
  PROGRAM_STATUS_ACTIONS,
  programToDraft,
} from "./programs";

function adminProgram(overrides: Partial<AdminProgram> = {}): AdminProgram {
  return {
    id: "prog_1",
    projectId: "proj_1",
    type: "grant",
    title: "Builder grant",
    summary: null,
    rewards: "Up to $5k",
    eligibility: null,
    ctaLabel: "Apply",
    ctaUrl: "https://example.com/apply",
    topicId: null,
    opensAt: null,
    closesAt: null,
    sortOrder: 0,
    state: "open",
    status: "listed",
    createdBy: "admin.near",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    project: {
      id: "proj_1",
      kind: "project",
      slug: "example",
      title: "Example",
      ownerId: "owner.near",
      logoUrl: null,
    },
    ...overrides,
  };
}

describe("program drafts", () => {
  it("round-trips a program through a draft into an update input", () => {
    const input = draftToUpdateInput("prog_1", programToDraft(adminProgram()));
    expect(input).toEqual({
      id: "prog_1",
      type: "grant",
      title: "Builder grant",
      summary: null,
      rewards: "Up to $5k",
      eligibility: null,
      ctaLabel: "Apply",
      ctaUrl: "https://example.com/apply",
      topicId: null,
      opensAt: null,
      closesAt: null,
      status: "listed",
    });
  });

  it("trims text and keeps the chosen project on create", () => {
    const input = draftToCreateInput({
      ...emptyProgramDraft(),
      projectId: "proj_2",
      title: "  Bounty ",
      ctaLabel: " Go ",
      ctaUrl: " https://example.com ",
      summary: "   ",
      topicId: "smart-contracts",
    });
    expect(input).toMatchObject({
      projectId: "proj_2",
      title: "Bounty",
      ctaLabel: "Go",
      ctaUrl: "https://example.com",
      summary: null,
      topicId: "smart-contracts",
      status: "draft",
    });
  });

  it("prefills the NEAR AI credits program from credit settings", () => {
    const draft = nearAiCreditsDraft({
      enabled: true,
      amountUsd: 5,
      claimsCloseAt: null,
      keyExpiresAt: null,
      nearAiWorkspaceId: "",
      nearAiLoginAccountId: "",
      nearAiOrgId: "",
      updatedBy: null,
      updatedAt: "2026-11-01T00:00:00.000Z",
    });
    expect(draft).toMatchObject({
      type: "credits",
      title: "NEAR AI Cloud credits",
      ctaLabel: "Claim credits",
      ctaUrl: "/dashboard",
      topicId: "private-cloud",
      closesAt: "",
    });
    expect(draft.rewards).toContain("NEAR AI Cloud credits");
  });
});

describe("program status actions", () => {
  it("lets admins move draft → listed → paused/archived and back", () => {
    expect(PROGRAM_STATUS_ACTIONS.draft.map((a) => a.status)).toContain("listed");
    expect(PROGRAM_STATUS_ACTIONS.listed.map((a) => a.status)).toEqual(["paused", "archived"]);
    expect(PROGRAM_STATUS_ACTIONS.paused.map((a) => a.status)).toContain("listed");
    expect(PROGRAM_STATUS_ACTIONS.archived.map((a) => a.status)).toEqual(["draft"]);
  });
});

describe("moveProgramId", () => {
  it("swaps a program with its neighbour", () => {
    expect(moveProgramId(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveProgramId(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
  });

  it("leaves the order alone at the edges or for unknown ids", () => {
    expect(moveProgramId(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moveProgramId(["a", "b"], "b", 1)).toEqual(["a", "b"]);
    expect(moveProgramId(["a", "b"], "z", 1)).toEqual(["a", "b"]);
  });
});
