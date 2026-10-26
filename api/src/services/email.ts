export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

export function createEmailSender(config: { apiKey: string; from: string }) {
  let missingKeyLogged = false;

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
      });
      if (!response.ok) {
        const detail = await response.text();
        console.error("[email] send failed", response.status, detail);
        return false;
      }
      return true;
    } catch (error) {
      console.error("[email] send failed", error);
      return false;
    }
  };
}
