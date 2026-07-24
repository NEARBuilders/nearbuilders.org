import { describe, expect, it, vi } from "vitest";
import { createProposalActivity } from "../../src/services/proposal-activity";
import { buildProposalApproval } from "../../src/services/proposal-approval";

const proposals = [
  {
    pluginId: "projects",
    entityId: "project-1",
    createdBy: "alice.near",
    payload: {
      kind: "project",
      title: "Example Project",
      slug: "example-project",
      description: "A project description",
      repository: "https://github.com/example/project",
    },
    expected: {
      actor: "alice.near",
      source: "projects",
      notificationType: "project_approved",
      title: "Example Project approved",
      link: "/projects/project/example-project",
      activityPayload: {
        projectId: "project-1",
        projectKind: "project",
        projectSlug: "example-project",
        projectTitle: "Example Project",
        projectDescription: "A project description",
        repositoryUrl: "https://github.com/example/project",
      },
    },
  },
  {
    pluginId: "events",
    entityId: "event-1",
    createdBy: "bob.near",
    payload: { title: "Demo Day", slug: "demo-day" },
    expected: {
      actor: "bob.near",
      source: "events",
      notificationType: "event_approved",
      title: "Demo Day approved",
      link: "/events/demo-day",
      activityPayload: {
        title: "Demo Day approved",
        description: "Demo Day is now public on NEAR Builders.",
      },
    },
  },
  {
    pluginId: "builders",
    entityId: "carol.near",
    createdBy: "nominator.near",
    payload: { name: "Carol" },
    expected: {
      actor: "carol.near",
      source: "builders",
      notificationType: "builder_approved",
      title: "Carol approved",
      link: "/builders/carol.near",
      activityPayload: {
        title: "Carol approved",
        description: "Carol is now listed in the NEAR Builders directory.",
      },
    },
  },
];

describe("proposal approval activity", () => {
  it.each(proposals)("maps $pluginId approvals", ({ expected, ...proposal }) => {
    expect(buildProposalApproval(proposal)).toMatchObject(expected);
  });

  it("normalizes missing optional project metadata", () => {
    expect(
      buildProposalApproval({
        pluginId: "projects",
        entityId: "idea-1",
        createdBy: "alice.near",
        payload: {
          kind: "idea",
          title: "Example Idea",
          slug: "example-idea",
        },
      }),
    ).toMatchObject({
      activityPayload: {
        projectId: "idea-1",
        projectKind: "idea",
        projectSlug: "example-idea",
        projectTitle: "Example Idea",
        projectDescription: null,
        repositoryUrl: null,
      },
    });
  });

  it.each(proposals)("emits verified $pluginId activity", async ({ expected, ...proposal }) => {
    const emitTrustedActivity = vi.fn(async () => ({}));
    const activity = createProposalActivity({
      activity: () => ({ emitTrustedActivity }),
    } as never);

    await activity.emitApproval({ ...proposal, id: "proposal-1", submissionCount: 2 }, {} as never);

    expect(emitTrustedActivity).toHaveBeenCalledWith({
      source: expected.source,
      type: "approved",
      actor: expected.actor,
      idempotencyKey: "proposal-approved:proposal-1:2",
      payload: expected.activityPayload,
    });
  });

  it("ignores unsupported proposal types", async () => {
    const emitTrustedActivity = vi.fn(async () => ({}));
    const activity = createProposalActivity({
      activity: () => ({ emitTrustedActivity }),
    } as never);

    await activity.emitApproval(
      {
        id: "proposal-1",
        pluginId: "nearcatalog",
        entityId: "claim-1",
        createdBy: "alice.near",
        payload: {},
        submissionCount: 1,
      },
      {} as never,
    );

    expect(emitTrustedActivity).not.toHaveBeenCalled();
  });
});
