---
"api": minor
---

Add a shared transactional email sender backed by Resend (#328): `api/src/services/email.ts` exposes `createEmailSender`/`sendEmail` plus simple branded templates (basic, notification, organization invite, test). It reads `RESEND_API_KEY` and `EMAIL_FROM` (default `NEAR Builders <no-reply@nearbuilders.org>`), is a logged no-op when no key is configured, and is available to API handlers as `email` on the API services. `pnpm email:test <to>` sends a verification email using the local `.env`.
