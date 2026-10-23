import { describe, expect, it } from "vitest";
import {
  AUTO_APPROVAL_ACTOR_ID,
  autoApprovalContext,
  parseRequireAdminApproval,
  resolveContentCreationVisibility,
  shouldAutoApproveBuilderProfile,
  wasModeratedByAdmin,
} from "../../src/services/approval-settings";

describe("approval settings", () => {
  it.each([
    "true",
    "TRUE",
    " 1 ",
    "yes",
    "on",
  ])("treats %j as requiring admin approval", (value) => {
    expect(parseRequireAdminApproval(value)).toBe(true);
  });

  it.each([
    undefined,
    null,
    "",
    "false",
    "0",
    "no",
    "off",
    "{{REQUIRE_ADMIN_APPROVAL}}",
  ])("treats %j as approval off", (value) => {
    expect(parseRequireAdminApproval(value)).toBe(false);
  });

  it("builds a system admin context without the submitter identity", () => {
    const context = autoApprovalContext({
      userId: "alice-user",
      user: { id: "alice-user", role: "member" },
      near: { primaryAccountId: "alice.near" },
      apiKey: { id: "key" },
      reqHeaders: new Headers(),
    } as never) as unknown as Record<string, unknown>;

    expect(context.userId).toBe(AUTO_APPROVAL_ACTOR_ID);
    expect(context.near).toBeUndefined();
    expect(context.apiKey).toBeUndefined();
    expect(context.user).toMatchObject({ id: AUTO_APPROVAL_ACTOR_ID, role: "admin" });
    expect(context.reqHeaders).toBeInstanceOf(Headers);
  });

  it("detects proposals an admin has rejected or removed", () => {
    expect(wasModeratedByAdmin(undefined)).toBe(false);
    expect(wasModeratedByAdmin({ reviewStatus: "pending", removeStatus: "not_started" })).toBe(
      false,
    );
    expect(wasModeratedByAdmin({ reviewStatus: "approved", removeStatus: "not_started" })).toBe(
      false,
    );
    expect(wasModeratedByAdmin({ reviewStatus: "rejected", removeStatus: "not_started" })).toBe(
      true,
    );
    expect(wasModeratedByAdmin({ reviewStatus: "removed", removeStatus: "removed" })).toBe(true);
    expect(wasModeratedByAdmin({ reviewStatus: "approved", removeStatus: "removed" })).toBe(true);
  });

  it("auto-approves only new pending submissions while approval is off", () => {
    const pending = { reviewStatus: "pending" as const };
    expect(
      shouldAutoApproveBuilderProfile({
        requireAdminApproval: false,
        previous: undefined,
        submitted: pending,
      }),
    ).toBe(true);
    expect(
      shouldAutoApproveBuilderProfile({
        requireAdminApproval: true,
        previous: undefined,
        submitted: pending,
      }),
    ).toBe(false);
    expect(
      shouldAutoApproveBuilderProfile({
        requireAdminApproval: false,
        previous: { reviewStatus: "rejected", removeStatus: "not_started" },
        submitted: pending,
      }),
    ).toBe(false);
    expect(
      shouldAutoApproveBuilderProfile({
        requireAdminApproval: false,
        previous: undefined,
        submitted: { reviewStatus: "approved" },
      }),
    ).toBe(false);
  });

  it("keeps public content private for members only while approval is required", () => {
    expect(
      resolveContentCreationVisibility({
        isAdmin: false,
        allowPublic: false,
        inputVisibility: "public",
      }),
    ).toBe("private");
    expect(
      resolveContentCreationVisibility({
        isAdmin: false,
        allowPublic: true,
        inputVisibility: "public",
      }),
    ).toBe("public");
    expect(
      resolveContentCreationVisibility({
        isAdmin: true,
        allowPublic: false,
        inputVisibility: "public",
      }),
    ).toBe("public");
    expect(
      resolveContentCreationVisibility({
        isAdmin: false,
        allowPublic: true,
        inputVisibility: undefined,
      }),
    ).toBe("private");
    expect(
      resolveContentCreationVisibility({
        isAdmin: false,
        allowPublic: false,
        inputVisibility: "unlisted",
      }),
    ).toBe("unlisted");
  });
});
