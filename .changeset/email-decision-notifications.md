---
"api": minor
"ui": minor
"@everything-dev/notifications-plugin": minor
---

Email approval and rejection decisions for builder profiles, projects, events and NEAR Catalog claims to a verified address, in addition to the in-app notification.

- Signed-in users can add and verify an email in Settings, turn email notifications on or off, and see a dismissible prompt after sign-in and after submitting a proposal or nomination. Mail goes only to a verified address with the toggle on; the in-app notification is unchanged.
- Decision emails are sent in the background, so a slow or failing mail provider never delays or blocks an approval or rejection. Every Resend request times out after 5 seconds.
- Verification codes are rate limited: one request per minute and five per hour for each user, and three per hour for each address across all users. A code locks after five wrong guesses and needs a fresh code. Limited requests return `RATE_LIMITED` with `retryAfter` and send no email.
- Address verification (`setEmailChallenge`, `confirmEmailCode`, `syncVerifiedEmail`) is reachable only through the API. Calling those notifications plugin procedures directly returns `FORBIDDEN`, so a member can't verify an address by choosing their own code or skipping the code.
- Adds the `email_preferences` table (`0001_email_preferences`) and the `email_code_requests` table with the `email_preferences.code_attempts` column (`0002_email_code_limits`) to the notifications plugin database. Both apply automatically on deploy.
- Set `RESEND_API_KEY`, `EMAIL_FROM` and `APP_PUBLIC_URL` on the API. An empty API key skips mail and does not block reviews.
