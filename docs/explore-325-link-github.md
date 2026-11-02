# Explore: link a GitHub account to a builder profile, not as sign-in (#325)

### Context
Builders can type a GitHub URL into their profile links today: `links.github`, which completes the "Link GitHub" step in [`builder-onboarding-checklist.tsx#L65-L68`](../ui/src/components/builder-onboarding-checklist.tsx#L65-L68). Nothing proves the account is theirs. This exploration covers attaching a real GitHub account through Better Auth OAuth account linking while sign-in stays NEAR wallet (SIWN) and the other existing methods. GitHub is an attached credential only.

Auth is not code in this repo. It lives upstream in [`NEARBuilders/everything-dev`](https://github.com/NEARBuilders/everything-dev) `plugins/auth` and arrives here as a remote pinned by `platform: "2.0.0-rc.27"` in [`bos.app.ts`](../bos.app.ts). Every upstream path below is quoted at tag `v2.0.0-rc.27`. The files cited are byte-identical on everything-dev `main` today. Better Auth is `1.7.7`.

### What already exists
- **The GitHub provider is wired but off.** [`auth-instance.ts#L225-L233`](https://github.com/NEARBuilders/everything-dev/blob/v2.0.0-rc.27/plugins/auth/src/auth-instance.ts#L225-L233) registers `socialProviders.github` when both a client id and a secret exist. The id comes from the auth variable `socialProviders.github.clientId` and the secret from the auth secret `GITHUB_CLIENT_SECRET` ([`config-schemas.ts#L96-L109`](https://github.com/NEARBuilders/everything-dev/blob/v2.0.0-rc.27/plugins/auth/src/config-schemas.ts#L96-L109), [`config.ts#L203`](https://github.com/NEARBuilders/everything-dev/blob/v2.0.0-rc.27/plugins/auth/src/config.ts#L203)). The parent runtime declares `socialProviders: { github: {}, google: {} }` with no id, so it's off everywhere. [`warnings.ts`](https://github.com/NEARBuilders/everything-dev/blob/v2.0.0-rc.27/plugins/auth/src/warnings.ts) logs "GitHub social sign-in is disabled".
- **Account linking is on** ([`auth-instance.ts#L525-L532`](https://github.com/NEARBuilders/everything-dev/blob/v2.0.0-rc.27/plugins/auth/src/auth-instance.ts#L525-L532)): `enabled: true`, `trustedProviders: ["siwn", "email-password"]`, `allowDifferentEmails: true`, `updateUserInfoOnLink: true`.
- **Better Auth core already ships the link endpoints** (no plugin needed, client methods on the existing auth client):
  - `POST /api/auth/link-social` (`authClient.linkSocial`) needs a session, puts `link: { userId, email }` in the OAuth state, and redirects to GitHub.
  - `GET /api/auth/callback/github` sees `state.link` and calls `linkOAuthAccount` (`better-auth/dist/oauth2/link-account.mjs`) instead of signing in.
  - `GET /api/auth/list-accounts` and `POST /api/auth/unlink-account` cover listing and removal. Unlinking needs a fresh session and refuses to remove the user's last `account` row.
  - `GET /api/auth/account-info` returns the provider profile using the stored token.
- **Default GitHub scopes are `read:user` and `user:email`** (`@better-auth/core/dist/social-providers/github.mjs#L15`). `emailVerified` is true only when GitHub's primary email is verified (L76).
- **This app owns its settings page.** [`ui/src/routes/_authenticated/_dashboard/settings/auth-methods.tsx`](../ui/src/routes/_authenticated/_dashboard/settings/auth-methods.tsx) is a local route that wins over the auth-ui one. It renders `MethodCard`s for Email, NEAR Wallet (link via `auth.signIn.near()`), Phone and Passkeys (add/remove with a `ConfirmDialog`). It sums them into `linkedMethodCount` (L34).
- **We already call GitHub server-side.** The review checks fetch `api.github.com/repos/{owner}/{repo}` with the app's `GITHUB_TOKEN` ([`api/src/services/review-checks.ts#L125`](../api/src/services/review-checks.ts#L125)).

### What goes wrong if we just set the client id
Setting `socialProviders.github.clientId` plus `GITHUB_CLIENT_SECRET` alone makes GitHub a full sign-in method, with three side effects:
1. **Anyone can sign up with GitHub.** `POST /sign-in/social { provider: "github" }` works for anyone, and the callback creates a new user, because `disableSignUp` isn't set.
2. **Linking overwrites the builder's name and avatar.** With `updateUserInfoOnLink: true`, Better Auth's `applyUpdateUserInfoOnLink` copies the GitHub `name` and `image` onto the user (`link-account.mjs#L373-L382`). Email is never touched.
3. **A builder can lock themselves out.** better-near-auth's `/near/unlink-account` refuses only when the user has one `account` row or fewer ([`packages/better-near-auth/src/index.ts#L1154-L1164`](https://github.com/NEARBuilders/everything-dev/blob/v2.0.0-rc.27/packages/better-near-auth/src/index.ts#L1154-L1164)). A builder with only NEAR + GitHub could unlink NEAR and keep just a GitHub row. If GitHub can't sign in, that account is unreachable.

### Questions answered

**Better Auth provider config: link-only, with NEAR as the sole sign-in method. What does the runtime's auth config need?**
Two layers:
- **Runtime config, here in `bos.app.ts`.** A child runtime can override auth variables: citynode.app already sets `auth.variables.deviceLink` and `passkey`.
  - Set `auth: { variables: { socialProviders: { github: { clientId: "<nearbuilders OAuth app id>", linkOnly: true } } } }`.
  - Provide `GITHUB_CLIENT_SECRET` as an auth secret in the deploy environment.
  - Register one GitHub OAuth app per environment, with callback `https://<domain>/api/auth/callback/github` (Better Auth's `/callback/{providerId}` under the auth base path). Production and preview each need their own app.
- **Code, upstream in `plugins/auth`.** `linkOnly` doesn't exist yet. When it's set, the plugin should:
  - pass `disableSignUp: true` to the GitHub provider (no account creation from the callback);
  - add a `hooks.before` matcher on `/sign-in/social` that rejects `provider: "github"` with `FORBIDDEN` ("GitHub can be connected from settings, not used to sign in"). Sign-in state can only be minted by `/sign-in/social`, so blocking it also closes the callback's sign-in branch, while `/link-social` keeps working.
  - skip `updateUserInfoOnLink` for link-only providers. The simplest version is a GitHub `mapProfileToUser` that returns `name: undefined, image: undefined`, since `updateUser` drops `undefined`. Needs a test to prove it.
  - leave GitHub out of `trustedProviders`. Linking then needs a verified primary GitHub email, which is the safer default and almost always true.
  - make better-near-auth's last-method guard count only sign-in-capable providers, which closes side effect 3.
  - turn on Better Auth's `account.encryptOAuthTokens` (`oauth2/utils.mjs#L12`) so stored GitHub tokens are encrypted at rest.
  - reword the `warnings.ts` message to "GitHub linking is disabled" when `linkOnly` is set.

**UI: GitHub connect/disconnect on the auth-methods settings page, matching the existing link/unlink patterns**
This is local, in this app's settings route. It uses Better Auth core client methods, so the auth-ui remote doesn't change.
- **A separate "Connected accounts" section** sits below the sign-in methods. GitHub must not count toward `linkedMethodCount` or the "Add at least one recoverable method" copy, because it can't get the user back in. It has its own `GitHubMethod` card with the same `MethodCard` shell, badge, and `ConfirmDialog` for disconnect.
- **Connect** calls `auth.linkSocial({ provider: "github", callbackURL: "/settings/auth-methods?github=linked", errorCallbackURL: "/settings/auth-methods?github=error" })`. On return, a toast reads the query and invalidates `["accounts"]`.
- **State** comes from `auth.listAccounts()`, using the row with `providerId === "github"`. That row's `accountId` is GitHub's stable numeric id. The `@login` comes from `GET /account-info?accountId=…`, or from the stored mirror described under privacy below.
- **Disconnect** opens a `ConfirmDialog` and then calls `auth.unlinkAccount({ accountId: <Better Auth account row id> })`. In 1.7.7 the body is the Better Auth account id, not GitHub's id. A stale session gets Better Auth's fresh-session error, so prompt a re-sign-in.
- **The upstream auth-ui settings page** ([`plugins/auth/ui/src/routes/_authenticated/settings/auth-methods.tsx`](https://github.com/NEARBuilders/everything-dev/blob/v2.0.0-rc.27/plugins/auth/ui/src/routes/_authenticated/settings/auth-methods.tsx), "Ways you can get back into this account") doesn't need GitHub, for the same reason.

**Reputation layer: what does a linked GitHub unlock, and how is it shown on builder profiles?**
A linked account gives a verified GitHub numeric id and login. Everything below uses that login plus the app's existing `GITHUB_TOKEN` on public endpoints, so we don't need to keep using the user's token or request more scopes.
- **Verified identity:** a "GitHub verified" badge with `@login` on `/builders/$account`. The onboarding checklist's "Link GitHub" step completes on the verified link instead of the typed URL.
- **Verified repo ownership:** when a project's `repository` (already parsed by `parseGithubRepository`) is owned by the linked login, or the login is a public member of the owning org (`GET /orgs/{org}/public_members/{login}`), the project shows "Maintainer verified". This plugs into the existing review checks as one more `EvaluationCheck`.
- **Org membership:** public memberships only (`GET /users/{login}/orgs`). Private orgs would need `read:org`, which we don't request.
- **Contribution signals:** contributor status and commit count on catalog and project repos (`GET /repos/{o}/{r}/contributors`), shown on the profile as "Contributor to …". Over time these become activity events through a GitHub poller, the pattern [`ACTIVITY.md`](../ACTIVITY.md) already describes.

This is a separate slice after the link flow, as the issue asks.

**Privacy: what GitHub data is stored and shown, and can users choose visibility?**
- **Stored by Better Auth, in the auth DB:**
  - the `account` row (`providerId`, `accountId` = GitHub id, `scope`, `accessToken`);
  - the access token, encrypted once `encryptOAuthTokens` is on. It isn't needed after linking, and reputation checks use the app token.
- **Stored by this app (builders plugin):**
  - `githubLogin`, refreshed on link and when the profile is viewed by its owner;
  - `githubVisible` (default on, since linking is an explicit act);
  - computed reputation results, with a timestamp.

  No email, name or avatar from GitHub is copied anywhere (see the `updateUserInfoOnLink` fix).
- **Shown:** only `@login`, the verified badge, and public-derived signals, and only when `githubVisible` is on. With visibility off, the link still exists for the owner, and public pages show nothing about GitHub.

**Edge cases: a GitHub account already linked to another builder, and unlinking behavior**
- **Already linked elsewhere.** Better Auth's callback returns `ACCOUNT_ALREADY_LINKED_TO_DIFFERENT_USER` (`link-account.mjs#L48-L50`) and redirects to `errorCallbackURL`. The card shows "This GitHub account is connected to another builder account. Disconnect it there first." There's no transfer or takeover path. One GitHub id maps to at most one builder.
- **Re-linking the same account** just refreshes the token and scope (`link-account.mjs#L49-L61`).
- **Unlinking** removes the `account` row. This app then clears the stored login and reputation and drops the verified badges. The typed `links.github` URL stays, because it's the builder's own self-declared data.
- **Lock-out:** unlinking NEAR must never leave GitHub as the only row. That's the better-near-auth guard fix above.
- **Login renames** are harmless because identity is keyed on GitHub's numeric id. Refresh the login on the next owner view.
- **Unverified primary email on GitHub:** linking fails with `UNABLE_TO_LINK_ACCOUNT`. The card says to verify the email on GitHub and retry.

### Recommendation
**Add a `linkOnly` mode for GitHub in the upstream auth plugin, enable it for nearbuilders.org through runtime config, and build the connect/disconnect UI locally as a "Connected accounts" card that doesn't count as a sign-in method.** Ship the link flow first, and reputation signals as a separate slice.

#### Where each part lands
**Upstream in everything-dev (`plugins/auth`, `packages/better-near-auth`):**
- `socialProviders.github.linkOnly`:
  - `disableSignUp`;
  - a `before` hook that blocks `/sign-in/social` for GitHub;
  - no name/avatar overwrite on link;
  - the reworded warning.
- `account.encryptOAuthTokens: true`.
- The last-method guard in `/near/unlink-account` counts only sign-in-capable providers.

**Runtime config (`bos.app.ts` here, after the platform pin that ships the above):**
- `auth.variables.socialProviders.github: { clientId, linkOnly: true }`, with `GITHUB_CLIENT_SECRET` as an auth secret.
- One GitHub OAuth app per environment.

**Local in nearbuilders.org:**
- The "Connected accounts" `GitHubMethod` card on `/settings/auth-methods`.
- The `githubLogin`/`githubVisible` fields and a route to sync them (builders plugin + `api/src/contract.ts`).
- Profile badges and the onboarding-checklist change.
- Reputation checks (`api/src/services/review-checks.ts`).

### Proposed follow-up tickets (not filed)
1. **everything-dev: link-only social providers.** Add `socialProviders.<id>.linkOnly`, which sets `disableSignUp`, blocks `/sign-in/social` for that provider with `FORBIDDEN`, skips the `updateUserInfoOnLink` name/avatar copy, and rewords the startup warning. Turn on `account.encryptOAuthTokens`. Tests: social sign-in is refused, link-social works with a session, linking keeps the user's name and image, and the stored token is encrypted.
2. **everything-dev: last-method guards ignore link-only accounts.** better-near-auth `/near/unlink-account` (and any other "last method" check) counts only sign-in-capable `account` rows. Test: a user with NEAR + linked GitHub can't unlink NEAR.
3. **nearbuilders.org: enable GitHub linking in runtime config.** After the platform pin bump that ships (1) and (2), set `auth.variables.socialProviders.github` (`clientId`, `linkOnly: true`) in `bos.app.ts` and add `GITHUB_CLIENT_SECRET` to the deploy secrets. Register production and preview GitHub OAuth apps with callback `/api/auth/callback/github`.
4. **nearbuilders.org: GitHub connect/disconnect in settings.** Add a "Connected accounts" section on `/settings/auth-methods` with a `GitHubMethod` card: `linkSocial` with callback and error URLs, a `listAccounts` state that shows `@login`, and `unlinkAccount` behind a `ConfirmDialog`. Map the error codes to copy (already linked to another builder, unverified GitHub email, stale session). It's excluded from the sign-in method count.
5. **nearbuilders.org: verified GitHub on builder profiles.** Add `githubLogin`/`githubVisible` to the builder profile with an owner-only sync route, a visibility toggle in profile settings, and a "GitHub verified @login" badge on `/builders/$account`. The onboarding "Link GitHub" step completes on the verified link. Unlinking clears the stored login and reputation.
6. **nearbuilders.org: GitHub reputation signals (separate slice).** Add a repo-ownership check (owner login or public org member) as a review check and project badge, public org memberships, and contributor status on project and catalog repos, all through the app `GITHUB_TOKEN` on public endpoints, cached with timestamps and shown only when `githubVisible` is on. Later these feed the activity layer through a GitHub poller.
