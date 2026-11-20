import { afterEach, describe, expect, it, vi } from "vitest";
import {
  basicEmailTemplate,
  createEmailSender,
  DEFAULT_EMAIL_FROM,
  emailConfigFromEnv,
  escapeHtml,
  organizationInviteEmailTemplate,
  RESEND_API_URL,
  sendEmail,
  testEmailTemplate,
} from "../../src/services/email";

function mockFetch(status: number, body: unknown) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("emailConfigFromEnv", () => {
  it("reads RESEND_API_KEY and EMAIL_FROM, treating blanks as unset", () => {
    expect(emailConfigFromEnv({ RESEND_API_KEY: " re_123 ", EMAIL_FROM: "A <a@b.co>" })).toEqual({
      apiKey: "re_123",
      from: "A <a@b.co>",
    });
    expect(emailConfigFromEnv({ RESEND_API_KEY: "", EMAIL_FROM: "  " })).toEqual({
      apiKey: undefined,
      from: undefined,
    });
  });
});

describe("createEmailSender", () => {
  it("defaults the from address", () => {
    expect(createEmailSender().from).toBe(DEFAULT_EMAIL_FROM);
    expect(createEmailSender({ from: "" }).from).toBe(DEFAULT_EMAIL_FROM);
  });

  it("is a logged no-op without an API key", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetch = mockFetch(200, { id: "x" });
    const sender = createEmailSender({ fetch });
    expect(sender.configured).toBe(false);
    await expect(sender.send({ to: "a@b.co", subject: "Hi", text: "Hello" })).resolves.toEqual({
      status: "skipped",
      reason: "not_configured",
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
  });

  it("posts to the Resend API with the key and payload", async () => {
    const fetch = mockFetch(200, { id: "email_1" });
    const sender = createEmailSender({ apiKey: "re_test", from: "NB <nb@example.com>", fetch });
    const result = await sender.send({
      to: "a@b.co",
      subject: "Hi",
      html: "<p>Hello</p>",
      text: "Hello",
      replyTo: "r@b.co",
    });
    expect(result).toEqual({ status: "sent", id: "email_1" });
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(RESEND_API_URL);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body as string)).toEqual({
      from: "NB <nb@example.com>",
      to: ["a@b.co"],
      subject: "Hi",
      html: "<p>Hello</p>",
      text: "Hello",
      reply_to: "r@b.co",
    });
  });

  it("returns a failure (without throwing) on API errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = mockFetch(403, { message: "domain not verified" });
    const result = await sendEmail(
      { to: "a@b.co", subject: "Hi", text: "x" },
      { apiKey: "re_test", fetch },
    );
    expect(result).toEqual({ status: "failed", error: "domain not verified", statusCode: 403 });
  });

  it("returns a failure when fetch rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = vi.fn(async () => {
      throw new Error("network down");
    });
    const result = await sendEmail(
      { to: "a@b.co", subject: "Hi", text: "x" },
      { apiKey: "re_test", fetch },
    );
    expect(result).toEqual({ status: "failed", error: "network down" });
  });

  it("validates input before calling the API", async () => {
    const fetch = mockFetch(200, { id: "x" });
    const sender = createEmailSender({ apiKey: "re_test", fetch });
    expect((await sender.send({ to: "not-an-email", subject: "Hi", text: "x" })).status).toBe(
      "failed",
    );
    expect((await sender.send({ to: [], subject: "Hi", text: "x" })).status).toBe("failed");
    expect((await sender.send({ to: "a@b.co", subject: " ", text: "x" })).status).toBe("failed");
    expect((await sender.send({ to: "a@b.co", subject: "Hi" })).status).toBe("failed");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("templates", () => {
  it("escapes HTML in content", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
    const email = basicEmailTemplate({
      subject: "S",
      heading: "<script>",
      paragraphs: ["a < b"],
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("a &lt; b");
    expect(email.text).toContain("a < b");
  });

  it("drops non-http action links", () => {
    const email = basicEmailTemplate({
      subject: "S",
      heading: "H",
      paragraphs: [],
      action: { label: "Go", url: "javascript:alert(1)" },
    });
    expect(email.html).not.toContain("javascript:");
    expect(email.text).not.toContain("javascript:");
  });

  it("builds an organization invite with an accept link", () => {
    const email = organizationInviteEmailTemplate({
      organizationName: "Acme",
      inviterName: "alice.near",
      role: "member",
      acceptUrl: "https://nearbuilders.org/invite/abc",
    });
    expect(email.subject).toContain("Acme");
    expect(email.html).toContain('href="https://nearbuilders.org/invite/abc"');
    expect(email.text).toContain("alice.near invited you to join Acme as member");
  });

  it("builds a test email", () => {
    const email = testEmailTemplate({ sentAt: new Date("2026-10-31T00:00:00.000Z") });
    expect(email.subject).toBe("NEAR Builders test email");
    expect(email.text).toContain("2026-10-31T00:00:00.000Z");
  });
});
