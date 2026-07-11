import { describe, expect, it } from "vitest";
import {
  buildApprovalNotification,
  buildRejectionNotification,
} from "../../src/services/proposal-notifications";

describe("approval notification mapping", () => {
  it("maps approved projects to the mission project link", () => {
    expect(
      buildApprovalNotification({
        pluginId: "projects",
        entityId: "project-1",
        appliedResourceId: "project-1",
        createdBy: "user-1",
        payload: { title: "Example Project", slug: "example-project" },
      }),
    ).toMatchObject({
      userId: "user-1",
      type: "project_approved",
      source: "projects",
      subject: "Example Project approved",
      link: "/projects/project/example-project",
    });
  });

  it("maps approved events to event links", () => {
    expect(
      buildApprovalNotification({
        pluginId: "events",
        entityId: "event-1",
        appliedResourceId: "event-1",
        createdBy: "user-2",
        payload: { title: "Demo Day", slug: "demo-day" },
      }),
    ).toMatchObject({
      userId: "user-2",
      type: "event_approved",
      source: "events",
      subject: "Demo Day approved",
      link: "/events/demo-day",
    });
  });

  it("maps approved builders to builder links", () => {
    expect(
      buildApprovalNotification({
        pluginId: "builders",
        entityId: "alice.near",
        appliedResourceId: "alice.near",
        createdBy: "user-3",
        payload: { name: "Alice" },
      }),
    ).toMatchObject({
      userId: "user-3",
      type: "builder_approved",
      source: "builders",
      subject: "Alice approved",
      link: "/builders/alice.near",
    });
  });

  it("ignores unsupported proposal plugins", () => {
    expect(
      buildApprovalNotification({
        pluginId: "votes",
        entityId: "vote-1",
        appliedResourceId: null,
        createdBy: "user-4",
        payload: {},
      }),
    ).toBeNull();
  });
});

describe("rejection notification mapping", () => {
  it("maps rejected projects with the rejection reason", () => {
    expect(
      buildRejectionNotification({
        pluginId: "projects",
        entityId: "project-1",
        appliedResourceId: null,
        createdBy: "user-1",
        payload: { title: "Example Project", slug: "example-project" },
        rejectionReason: "Missing project details.",
      }),
    ).toMatchObject({
      userId: "user-1",
      type: "project_rejected",
      source: "projects",
      subject: "Example Project rejected",
      body: "Your project was not approved by NEAR Builders. Reason: Missing project details.",
      link: "/dashboard",
    });
  });

  it("maps rejected events without a reason", () => {
    expect(
      buildRejectionNotification({
        pluginId: "events",
        entityId: "event-1",
        appliedResourceId: null,
        createdBy: "user-2",
        payload: { title: "Demo Day", slug: "demo-day" },
        rejectionReason: null,
      }),
    ).toMatchObject({
      userId: "user-2",
      type: "event_rejected",
      source: "events",
      subject: "Demo Day rejected",
      body: "Your event was not approved by NEAR Builders.",
      link: "/dashboard",
    });
  });

  it("maps rejected builders to the dashboard", () => {
    expect(
      buildRejectionNotification({
        pluginId: "builders",
        entityId: "alice.near",
        appliedResourceId: null,
        createdBy: "user-3",
        payload: { name: "Alice" },
        rejectionReason: "Use your own account.",
      }),
    ).toMatchObject({
      userId: "user-3",
      type: "builder_rejected",
      source: "builders",
      subject: "Alice rejected",
      body: "Your builder profile was not approved by NEAR Builders. Reason: Use your own account.",
      link: "/dashboard",
    });
  });

  it("ignores unsupported rejected proposal plugins", () => {
    expect(
      buildRejectionNotification({
        pluginId: "votes",
        entityId: "vote-1",
        appliedResourceId: null,
        createdBy: "user-4",
        payload: {},
        rejectionReason: "Nope.",
      }),
    ).toBeNull();
  });
});
