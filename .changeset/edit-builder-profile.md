---
"api": minor
"ui": minor
---

Add edit builder profile (#11).

- **api**: Expose an `updateBuilderProfile` route on the API shell that proxies to the builders plugin, which enforces owner-or-admin permissions. Builds on the existing plugin contract and service.
- **ui**: Add a `/builders/{account}/edit` route where the profile owner (or an admin) can update their display name, bio, skills, and location with TanStack Form validation and error handling. An "Edit profile" entry point now appears on the builder profile for the owner/admin. Profile and background images continue to come from NEAR Social and are out of scope.
