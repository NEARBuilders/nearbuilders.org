import { ORPCError } from "every-plugin/orpc";
import { describe, expect, it } from "vitest";
import {
  assertProjectProposalOwner,
  createProjectProposalOwnerContext,
  resolveProjectProposalOwner,
} from "../../src/lib/project-proposal-owner";

function expectBadRequest(action: () => void) {
  try {
    action();
    throw new Error("Expected BAD_REQUEST");
  } catch (error) {
    expect(error).toBeInstanceOf(ORPCError);
    expect((error as ORPCError<string, unknown>).code).toBe("BAD_REQUEST");
  }
}

describe("project proposal owner hardening", () => {
  it("prefers an explicit payload owner", () => {
    expect(resolveProjectProposalOwner({ ownerId: " payload-owner.near " }, "creator.near")).toBe(
      "payload-owner.near",
    );
  });

  it("falls back to proposal createdBy", () => {
    expect(resolveProjectProposalOwner({}, " creator.near ")).toBe("creator.near");
  });

  it("rejects proposals without a valid owner", () => {
    expectBadRequest(() => resolveProjectProposalOwner({}, "unknown"));
    expectBadRequest(() => resolveProjectProposalOwner({ ownerId: " " }, " "));
  });

  it("rejects owners that are not NEAR account ids", () => {
    // opaque better-auth user id (mixed-case nanoid)
    expectBadRequest(() => resolveProjectProposalOwner({}, "Wl7nWqXk3eZ9pT1mC5sB2dF8gH4jK6rA"));
    // payload owner invalid and createdBy invalid
    expectBadRequest(() =>
      resolveProjectProposalOwner({ ownerId: "Not.A.Near.Account" }, "API_KEY_ID"),
    );
    expectBadRequest(() => resolveProjectProposalOwner({}, "a")); // too short
    expectBadRequest(() => resolveProjectProposalOwner({}, "double..dot.near"));
    expectBadRequest(() => resolveProjectProposalOwner({}, `${"a".repeat(65)}`)); // too long
  });

  it("falls back to createdBy when the payload owner is not a NEAR account id", () => {
    expect(resolveProjectProposalOwner({ ownerId: "Opaque123ID" }, "creator.near")).toBe(
      "creator.near",
    );
  });

  it("accepts named and implicit NEAR accounts", () => {
    expect(resolveProjectProposalOwner({ ownerId: "sub_acct-1.builder.near" }, "x")).toBe(
      "sub_acct-1.builder.near",
    );
    const implicit = "f".repeat(64);
    expect(resolveProjectProposalOwner({ ownerId: implicit }, "x")).toBe(implicit);
  });

  it("runs fallback creation as the proposal owner, not the approving admin", () => {
    const context = createProjectProposalOwnerContext(
      {
        userId: "admin.near",
        user: {
          id: "admin.near",
          role: "admin",
          email: "admin@example.com",
        },
        near: {
          primaryAccountId: "admin.near",
        },
        apiKey: {
          id: "key_1",
          name: "Admin",
          permissions: null,
        },
      },
      "builder.near",
    ) as {
      userId: string;
      near: { primaryAccountId: string };
      user: { id: string; role: string };
      apiKey: { id: string };
    };

    expect(context.userId).toBe("builder.near");
    expect(context.near?.primaryAccountId).toBe("builder.near");
    expect(context.user).toEqual({ id: "builder.near", role: "user" });
    expect(context.apiKey?.id).toBe("key_1");
  });

  it("rejects an existing project whose owner differs from the proposal owner", () => {
    assertProjectProposalOwner("builder.near", "builder.near");
    expectBadRequest(() => assertProjectProposalOwner("admin.near", "builder.near"));
  });
});
