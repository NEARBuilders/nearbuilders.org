---
"api": minor
"ui": minor
"@everything-dev/builders-plugin": minor
---

Builder profiles can carry the details NEAR Catalog's people directory asks for (#287).

- Builders get an optional `catalog` field: preferred contact (Email, Telegram, Discord, X or Website), organization, team, job title, a public email and an avatar URL.
- The preferred contact must be filled in: a Telegram, Discord, X or website link, or the public email. The sign-in email is never used.
- `/join` and the profile edit page have an optional "Also list me on NEAR Catalog" section. The details travel with the join proposal, so an approved profile keeps them.
- Builder profiles show the job title, organization and public email when set, and use the avatar URL before the NEAR Social image.
