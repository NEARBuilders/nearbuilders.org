---
"monorepo": patch
---

Fix CI typecheck failure caused by `.bos/generated/auth/auth-export.d.ts` not being committed. The file is fetched from the remote auth plugin manifest by `bos types gen`, but the manifest doesn't advertise `additionalExports`, so the file is never created in CI. Committing it ensures the import in `auth-types.gen.ts` resolves. Also fixed `.gitignore` to use `.bos/*` instead of `.bos` so the existing exceptions for `sync-snapshot.json` and `infra-state.json` actually work.
