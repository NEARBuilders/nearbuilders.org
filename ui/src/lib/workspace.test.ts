import { describe, expect, it } from "vitest";
import {
  editableTeamAreas,
  findActiveOrganization,
  memberOrganizations,
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

  describe("memberOrganizations", () => {
    const organizations = [
      { id: "org_person", name: "Personal", slug: "user_1", metadata: { isPersonal: true } },
      { id: "org_team", name: "Builders Guild", slug: "builders-guild" },
      { id: "org_slugmatch", name: "Slug Match", slug: "user_1" },
    ];

    it("excludes personal organizations", () => {
      const orgs = memberOrganizations(organizations, "user_1");
      expect(orgs.map((org) => org.id)).toEqual(["org_team"]);
    });

    it("still excludes metadata-personal orgs without a user, but not slug matches", () => {
      expect(memberOrganizations(organizations).map((org) => org.id)).toEqual([
        "org_team",
        "org_slugmatch",
      ]);
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
