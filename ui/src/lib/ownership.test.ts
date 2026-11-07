import { describe, expect, it } from "vitest";
import {
  isViewerAcceptedCollaborator,
  isViewerCollaboratorId,
  isViewerOwner,
  viewerOwnerIds,
} from "./ownership";

describe("viewerOwnerIds", () => {
  it("includes the connected, linked, wallet and user ids once", () => {
    expect(
      viewerOwnerIds({ id: "user-1", walletAddress: "alice.near" }, "alice.near", [
        "alice.near",
        "alice-alt.near",
        null,
      ]),
    ).toEqual(["alice.near", "alice-alt.near", "user-1"]);
  });

  it("is empty with no user and no NEAR account", () => {
    expect(viewerOwnerIds(null, null)).toEqual([]);
  });
});

describe("isViewerOwner", () => {
  it("matches a project created under a linked account after a primary switch", () => {
    const ids = viewerOwnerIds({ id: "user-1" }, "alice-alt.near", [
      "alice-alt.near",
      "alice.near",
    ]);
    expect(isViewerOwner("alice.near", ids)).toBe(true);
    expect(isViewerOwner("user-1", ids)).toBe(true);
  });

  it("rejects other owners and missing owners", () => {
    const ids = viewerOwnerIds({ id: "user-1" }, "alice.near");
    expect(isViewerOwner("bob.near", ids)).toBe(false);
    expect(isViewerOwner(null, ids)).toBe(false);
    expect(isViewerOwner("", [""])).toBe(false);
  });
});

describe("collaborator checks", () => {
  const ids = viewerOwnerIds({ id: "user-1" }, "Alice.near", ["alice-alt.near"]);

  it("matches lowercased collaborator ids against any viewer id", () => {
    expect(isViewerCollaboratorId("alice.near", ids)).toBe(true);
    expect(isViewerCollaboratorId("alice-alt.near", ids)).toBe(true);
    expect(isViewerCollaboratorId("bob.near", ids)).toBe(false);
  });

  it("only counts accepted collaborations", () => {
    expect(
      isViewerAcceptedCollaborator(
        [{ collaboratorOwnerId: "alice-alt.near", status: "accepted" }],
        ids,
      ),
    ).toBe(true);
    expect(
      isViewerAcceptedCollaborator(
        [{ collaboratorOwnerId: "alice-alt.near", status: "pending" }],
        ids,
      ),
    ).toBe(false);
    expect(isViewerAcceptedCollaborator(undefined, ids)).toBe(false);
  });
});
