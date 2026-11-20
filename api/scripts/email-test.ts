/**
 * Send a verification email through Resend using the local .env.
 *
 *   pnpm email:test you@example.com
 *
 * Without a verified domain, set EMAIL_FROM="NEAR Builders <onboarding@resend.dev>"
 * and send to the address your Resend account was created with.
 */
import { resolve } from "node:path";
import { config } from "dotenv";
import {
  createEmailSender,
  emailConfigFromEnv,
  isValidEmail,
  testEmailTemplate,
} from "../src/services/email";

config({ path: resolve(import.meta.dirname, "../../.env"), quiet: true });

const to = process.argv[2]?.trim();
if (!to || !isValidEmail(to)) {
  console.error("Usage: pnpm email:test <recipient@example.com>");
  process.exit(1);
}

const sender = createEmailSender(emailConfigFromEnv(process.env));
if (!sender.configured) {
  console.error("RESEND_API_KEY is not set in .env; nothing was sent.");
  process.exit(1);
}

const result = await sender.send({ to, ...testEmailTemplate({ from: sender.from }) });
if (result.status === "sent") {
  console.log(`Sent test email to ${to} from ${sender.from} (Resend id: ${result.id})`);
} else {
  console.error("Test email was not sent:", result);
  process.exit(1);
}
