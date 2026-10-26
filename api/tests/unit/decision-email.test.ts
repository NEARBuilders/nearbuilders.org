import { describe, expect, it, vi } from "vitest";
import {
  createProposalNotifications,
  type EmailRecipient,
} from "../../src/services/proposal-notifications";

const proposal = {
  pluginId: "projects",
  entityId: "project-1",
  appliedResourceId: "project-1",
  createdBy: "user-1",
  payload: { title: "Example", slug: "example" },
  rejectionReason: "Needs a clearer scope",
};

function harness(recipient: EmailRecipient | null) {
  const sendEmail = vi.fn(
    async (_input: { to: string; subject: string; text: string }) => undefined,
  );
  const createNotification = vi.fn(async (input: { type: string }) => input);
  const notifications = createProposalNotifications(
    {
      notifications: () => ({ createNotification }),
    } as never,
    {
      loadRecipient: async () => recipient,
      sendEmail,
      siteOrigin: "https://nearbuilders.org",
    },
  );
  return { notifications, sendEmail, createNotification };
}

const context = { userId: "reviewer" } as never;

describe("decision email trigger", () => {
  it("emails a verified recipient and still creates the in-app notification", async () => {
    const { notifications, sendEmail, createNotification } = harness({
      email: "builder@example.com",
      verified: true,
      enabled: true,
    });

    await notifications.notifyApproval(proposal, context);

    expect(createNotification).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith({
      to: "builder@example.com",
      subject: "Example approved",
      text: expect.stringContaining("https://nearbuilders.org/projects/project/example"),
    });
  });

  it("includes the rejection reason in the email", async () => {
    const { notifications, sendEmail } = harness({
      email: "builder@example.com",
      verified: true,
      enabled: true,
    });

    await notifications.notifyRejection(proposal, context);

    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0]?.[0].text).toContain("Needs a clearer scope");
  });

  it("does not email when there is no verified address", async () => {
    const { notifications, sendEmail, createNotification } = harness({
      email: "builder@example.com",
      verified: false,
      enabled: true,
    });

    await notifications.notifyApproval(proposal, context);

    expect(createNotification).toHaveBeenCalledOnce();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does not email when the address is missing", async () => {
    const { notifications, sendEmail } = harness({
      email: null,
      verified: false,
      enabled: true,
    });

    await notifications.notifyRejection(proposal, context);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does not email when notifications are turned off", async () => {
    const { notifications, sendEmail } = harness({
      email: "builder@example.com",
      verified: true,
      enabled: false,
    });

    await notifications.notifyApproval(proposal, context);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does not email notification types outside the allowlist", async () => {
    const sendEmail = vi.fn(async () => undefined);
    const createNotification = vi.fn(async () => undefined);
    const notifications = createProposalNotifications(
      { notifications: () => ({ createNotification }) } as never,
      {
        loadRecipient: async () => ({
          email: "builder@example.com",
          verified: true,
          enabled: true,
        }),
        sendEmail,
        siteOrigin: "https://nearbuilders.org",
      },
    );

    await notifications.notifyRevocation(proposal, context);

    expect(createNotification).toHaveBeenCalledOnce();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("still resolves when the email sender throws", async () => {
    const notifications = createProposalNotifications(
      { notifications: () => ({ createNotification: vi.fn(async () => undefined) }) } as never,
      {
        loadRecipient: async () => ({
          email: "builder@example.com",
          verified: true,
          enabled: true,
        }),
        sendEmail: async () => {
          throw new Error("provider down");
        },
        siteOrigin: "https://nearbuilders.org",
      },
    );

    await expect(notifications.notifyApproval(proposal, context)).resolves.toBeUndefined();
    await expect(notifications.notifyRejection(proposal, context)).resolves.toBeUndefined();
  });
});
