export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

export const EMAIL_SEND_TIMEOUT_MS = 5_000;

export function createEmailSender(config: { apiKey: string; from: string; timeoutMs?: number }) {
  let missingKeyLogged = false;
  const timeoutMs = config.timeoutMs ?? EMAIL_SEND_TIMEOUT_MS;

  return async function sendEmail(input: SendEmailInput) {
    if (!config.apiKey) {
      if (!missingKeyLogged) {
        missingKeyLogged = true;
        console.error("[email] RESEND_API_KEY is not set; skipping email");
      }
      return false;
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.from,
          to: [input.to],
          subject: input.subject,
          text: input.text,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        const detail = await response.text();
        console.error("[email] send failed", response.status, detail);
        return false;
      }
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        console.error(`[email] send timed out after ${timeoutMs}ms`);
      } else {
        console.error("[email] send failed", error);
      }
      return false;
    }
  };
}
