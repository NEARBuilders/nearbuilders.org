# Org attribution over org ownership

Projects keep a personal owner plus an optional organization attribution; organization members gain edit access to attributed projects, but the organization never becomes the project's owner. We decided this because attribution is what the projects plugin already models, it keeps ownership/transfer/deletion simple, and co-editing delivers the actual collaboration need. Making organizations first-class project owners would be a framework-level schema and identity change (projects plugin + auth plugin) and is deliberately not pursued now.

## Considered Options

- **Org attribution (chosen)**: personal owner stays; org membership unlocks editing; deleting an org clears attribution and projects survive.
- **Org as first-class owner**: project owned by the org with no individual owner — more "correct" for org-owned products long-term, but a much larger, harder-to-reverse change touching the shared framework and every consuming app.

## Consequences

- Ownership transfer, invitations, and deletion flows stay personal-account semantics.
- If org-ownership is ever wanted, it is a new framework ADR and migration, not a local change.
