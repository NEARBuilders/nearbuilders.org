---
"api": minor
"ui": minor
"@everything-dev/nearcatalog-plugin": minor
---

Owners can submit a project or their builder profile to NEAR Catalog, and a NEAR Builders admin approves it (#288).

- A submission creates a `nearcatalog-listing` proposal. It is never auto-approved, whether `REQUIRE_ADMIN_APPROVAL` is on or off, and the auto-approval actor is refused.
- Only public projects of kind `project` and listed builder profiles can be submitted, and only once the required NEAR Catalog fields are filled in.
- The new NEAR Catalog tab in the admin dashboard shows the exact record that would be exported, in NEAR Catalog's field names. The Telegram review digest lists these proposals too.
- Each record stores `catalogStatus` (`none`, `pending`, `approved`, `rejected`, `published`) and `catalogSlug` in the nearcatalog plugin.
- Changing the title, tagline, logo, categories, links or token after approval sends the listing back to review, and the last approved version stays listed meanwhile. Other edits update the listing directly.
- Making a project private, deleting it, or withdrawing a builder profile takes it out of the catalog flow. Owners get a notification with the reason when a listing is rejected.
