---
"@everything-dev/builders-plugin": patch
---

Nomination bot routes (`createTelegramNomination`, `createXNomination`, `claimTelegramNomination`)
now accept an API key only when it belongs to an admin account or carries the admin-granted
`nominations:write` permission. Other keys get `FORBIDDEN`.
