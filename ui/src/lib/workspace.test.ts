import { describe, expect, it } from "vitest";
import {
  editableTeamAreas,
  findActiveOrganization,
  pendingUserInvitations,
  teamAreaLabels,
} from "./workspace";

describe("workspace", () => {
  describe("pendingUserInvitations", () => {
    it("keeps only pending invitations", () => {
      const invitations = [
        { id: "1", status: "pending" },
        { id: "2", status: "accepted" },
        { id: "3", status: "rejected" },
        { id: "4", status: "pending" },
      ];

      const pending = pendingUserInvitations(invitations);

      expect(pending.map((invitation) => invitation.id)).toEqual(["1", "4"]);
    });

    it("returns nothing when given nothing", () => {
      expect(pendingUserInvitations(null)).toEqual([]);
      expect(pendingUserInvitations(undefined)).toEqual([]);
    });
  });

  describe("findActiveOrganization", () => {
    const organizations = [
      { id: "org_1", name: "First", slug: "first" },
      { id: "org_2", name: "Second", slug: "second" },
    ];

    it("finds the organization matching the active id", () => {
      expect(findActiveOrganization(organizations, "org_2")).toEqual({
        id: "org_2",
        name: "Second",
        slug: "second",
      });
    });

    it("finds nothing without an active id or a matching org", () => {
      expect(findActiveOrganization(organizations, null)).toBeNull();
      expect(findActiveOrganization(organizations, "org_missing")).toBeNull();
      expect(findActiveOrganization(null, "org_1")).toBeNull();
    });
  });

  describe("teamAreaLabels", () => {
    it("labels known feature areas and keeps unknown ones", () => {
      expect(teamAreaLabels(["organizations", "crypto"])).toEqual(["Organizations", "crypto"]);
    });

    it("handles nothing gracefully", () => {
      expect(teamAreaLabels(null)).toEqual([]);
      expect(teamAreaLabels(undefined)).toEqual([]);
    });
  });

  describe("editableTeamAreas", () => {
    it("unions the team's areas with the registered feature areas", () => {
      expect(editableTeamAreas(["organizations"])).toEqual(["organizations"]);
      expect(editableTeamAreas(["legacy"])).toEqual(["legacy", "organizations"]);
    });

    it("deduplicates and preserves team order first", () => {
      expect(editableTeamAreas(["organizations", "legacy"])).toEqual(["organizations", "legacy"]);
    });
  });
});
