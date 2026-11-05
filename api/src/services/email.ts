/**
 * Shared transactional email sender backed by Resend (https://resend.com).
 *
 * Feature work (org invites, notifications, ...) should build a message with one
 * of the templates below (or its own `{ subject, html, text }`) and pass it to
 * `sendEmail`. When `RESEND_API_KEY` is not configured, sending is a logged
 * no-op so local dev and tests never crash.
 */

export const RESEND_API_URL = "https://api.resend.com/emails";
export const DEFAULT_EMAIL_FROM = "NEAR Builders <no-reply@nearbuilders.org>";

export type EmailConfig = {
  apiKey?: string;
  from?: string;
  fetch?: typeof fetch;
};

export type EmailContent = {
  subject: string;
  html?: string;
  text?: string;
};

export type SendEmailInput = EmailContent & {
  to: string | string[];
  from?: string;
  replyTo?: string | string[];
  tags?: Array<{ name: string; value: string }>;
};

export type SendEmailResult =
  | { status: "sent"; id: string }
  | { status: "skipped"; reason: "not_configured" }
  | { status: "failed"; error: string; statusCode?: number };

export type EmailSender = {
  readonly configured: boolean;
  readonly from: string;
  send: (input: SendEmailInput) => Promise<SendEmailResult>;
};

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function emailConfigFromEnv(env: Record<string, string | undefined>): EmailConfig {
  return {
    apiKey: env.RESEND_API_KEY?.trim() || undefined,
    from: env.EMAIL_FROM?.trim() || undefined,
  };
}

export function createEmailSender(config: EmailConfig = {}): EmailSender {
  const apiKey = config.apiKey?.trim() ?? "";
  const from = config.from?.trim() || DEFAULT_EMAIL_FROM;
  const doFetch = config.fetch ?? globalThis.fetch;

  return {
    configured: apiKey.length > 0,
    from,
    async send(input) {
      const recipients = (Array.isArray(input.to) ? input.to : [input.to]).map((to) => to.trim());
      if (recipients.length === 0 || recipients.some((to) => !isValidEmail(to))) {
        return { status: "failed", error: "Invalid recipient email address" };
      }
      if (!input.subject.trim()) {
        return { status: "failed", error: "Email subject is required" };
      }
      if (!input.html && !input.text) {
        return { status: "failed", error: "Email needs html or text content" };
      }
      if (!apiKey) {
        console.warn(
          `[Email] RESEND_API_KEY not configured; skipped "${input.subject}" to ${recipients.length} recipient(s)`,
        );
        return { status: "skipped", reason: "not_configured" };
      }

      try {
        const response = await doFetch(RESEND_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: input.from?.trim() || from,
            to: recipients,
            subject: input.subject,
            ...(input.html ? { html: input.html } : {}),
            ...(input.text ? { text: input.text } : {}),
            ...(input.replyTo ? { reply_to: input.replyTo } : {}),
            ...(input.tags ? { tags: input.tags } : {}),
          }),
        });
        const body = (await response.json().catch(() => null)) as {
          id?: string;
          message?: string;
        } | null;
        if (!response.ok || !body?.id) {
          const error = body?.message ?? `Resend responded with HTTP ${response.status}`;
          console.error("[Email] Send failed:", error);
          return { status: "failed", error, statusCode: response.status };
        }
        return { status: "sent", id: body.id };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[Email] Send failed:", message);
        return { status: "failed", error: message };
      }
    },
  };
}

/** Convenience wrapper for one-off sends; reuse `createEmailSender` in services. */
export function sendEmail(input: SendEmailInput, config: EmailConfig = {}) {
  return createEmailSender(config).send(input);
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isSafeUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

export type BasicEmailTemplateInput = {
  subject: string;
  heading: string;
  /** Plain-text paragraphs; they are HTML-escaped. */
  paragraphs: string[];
  action?: { label: string; url: string };
  footer?: string;
};

const DEFAULT_FOOTER = "NEAR Builders · https://nearbuilders.org";

/** Simple branded layout producing matching html and text bodies. */
export function basicEmailTemplate(input: BasicEmailTemplateInput): Required<EmailContent> {
  const footer = input.footer ?? DEFAULT_FOOTER;
  const action = input.action && isSafeUrl(input.action.url) ? input.action : undefined;
  const paragraphsHtml = input.paragraphs
    .map((p) => `<p style="margin:0 0 16px;line-height:1.5">${escapeHtml(p)}</p>`)
    .join("");
  const actionHtml = action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="background:#000;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">${escapeHtml(action.label)}</a></p>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px"><h1 style="font-size:20px;margin:0 0 20px">${escapeHtml(input.heading)}</h1>${paragraphsHtml}${actionHtml}<hr style="border:none;border-top:1px solid #eee;margin:24px 0"/><p style="margin:0;font-size:12px;color:#777">${escapeHtml(footer)}</p></div></body></html>`;

  const text = [
    input.heading,
    "",
    ...input.paragraphs.flatMap((p) => [p, ""]),
    ...(action ? [`${action.label}: ${action.url}`, ""] : []),
    "--",
    footer,
  ].join("\n");

  return { subject: input.subject, html, text };
}

export function testEmailTemplate(
  options: { sentAt?: Date; from?: string } = {},
): Required<EmailContent> {
  const sentAt = (options.sentAt ?? new Date()).toISOString();
  return basicEmailTemplate({
    subject: "NEAR Builders test email",
    heading: "Email delivery works",
    paragraphs: [
      "This is a test email from nearbuilders.org, sent through Resend to verify transactional email delivery.",
      ...(options.from ? [`Sender: ${options.from}`] : []),
      `Sent at ${sentAt}.`,
    ],
  });
}

export function notificationEmailTemplate(input: {
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
}): Required<EmailContent> {
  return basicEmailTemplate({
    subject: input.title,
    heading: input.title,
    paragraphs: [input.message],
    action: input.actionUrl
      ? { label: input.actionLabel ?? "Open NEAR Builders", url: input.actionUrl }
      : undefined,
  });
}

export function organizationInviteEmailTemplate(input: {
  organizationName: string;
  inviterName: string;
  role?: string;
  acceptUrl: string;
}): Required<EmailContent> {
  const role = input.role ? ` as ${input.role}` : "";
  return basicEmailTemplate({
    subject: `You're invited to join ${input.organizationName} on NEAR Builders`,
    heading: `Join ${input.organizationName}`,
    paragraphs: [
      `${input.inviterName} invited you to join ${input.organizationName}${role} on NEAR Builders.`,
      "If you weren't expecting this invitation, you can ignore this email.",
    ],
    action: { label: "Accept invitation", url: input.acceptUrl },
  });
}
