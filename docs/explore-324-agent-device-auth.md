# Explore: device/approval flow for agent auth (#324)

### Context
Today an agent reaches nearbuilders.org (MCP at `POST /api/mcp`, REST, oRPC) with an API key the user creates by hand at `/settings/api-keys` and pastes into the agent. #318 and #320 shorten that by minting the key inside the page, but the user still copies a secret. This exploration asks whether the agent can request access, the user approve it in the browser, and the agent receive scoped access with no secret copied at all.

Auth is not code in this repo. It lives upstream in [`NEARBuilders/everything-dev`](https://github.com/NEARBuilders/everything-dev) (`plugins/auth`, plus the `better-near-auth` and `everything-dev` packages) and arrives here as a remote pinned by `platform: "2.0.0-rc.27"` in [`bos.app.ts`](../bos.app.ts). Every upstream path below is quoted at tag `v2.0.0-rc.27`. The files cited are byte-identical on everything-dev `main` today, so the line numbers hold for both. Better Auth is `1.7.7` (everything-dev `pnpm-workspace.yaml` catalog).

### What already exists (the short answer)
Most of the flow is already built and live. The `bos login` CLI uses it today.

- **Better Auth's device-authorization plugin (RFC 8628) is enabled.** [`plugins/auth/src/auth-instance.ts#L428-L431`](https://github.com/NEARBuilders/everything-dev/blob/v2.0.0-rc.27/plugins/auth/src/auth-instance.ts#L428-L431) registers `deviceAuthorization({ verificationUri: "/login/device", validateClient })`, which serves `POST /api/auth/device/code`, `POST /api/auth/device/token`, `GET /api/auth/device`, `POST /api/auth/device/approve` and `POST /api/auth/device/deny`. Plugin defaults: the code expires after 30 minutes and the poll interval is 5 seconds (`better-auth/dist/plugins/device-authorization/index.mjs`).
- **Client ids are allow-listed.** `validateClient` accepts only `deviceLink.clientId` (an auth-plugin variable) and the CLI's `BOS_CLI_CLIENT_ID` ([`auth-instance.ts#L243-L246`](https://github.com/NEARBuilders/everything-dev/blob/v2.0.0-rc.27/plugins/auth/src/auth-instance.ts#L243-L246)). `deviceLink.clientId` is a single string ([`config-schemas.ts#L135-L139`](https://github.com/NEARBuilders/everything-dev/blob/v2.0.0-rc.27/plugins/auth/src/config-schemas.ts#L135-L139)). nearbuilders.org doesn't set it, so it inherits `everything-dev-web` from the parent runtime. citynode.app sets its own (`citynode-web`).
- **A device-link claim turns the approved token into a usable credential.** The device token endpoint returns a raw Better Auth session token as `access_token`, and that token is not usable as a bearer on its own: no `bearer()` plugin is installed, and `SessionService.getContext` only treats `Bearer api_…`/`org_…` values as API keys ([`services/session.ts#L127`](https://github.com/NEARBuilders/everything-dev/blob/v2.0.0-rc.27/plugins/auth/src/services/session.ts#L127)). The upstream [`device-link.ts`](https://github.com/NEARBuilders/everything-dev/blob/v2.0.0-rc.27/plugins/auth/src/device-link.ts) plugin records a single-use, 60-second claim after `/device/token` succeeds. It also exposes `POST /api/auth/device-link/claim`, which exchanges the token for a signed session cookie.
- **The CLI already turns the approval into an API key.** [`packages/everything-dev/src/services/auth/device-login.ts`](https://github.com/NEARBuilders/everything-dev/blob/v2.0.0-rc.27/packages/everything-dev/src/services/auth/device-login.ts) runs code → poll → claim (L238) and then either `mintApiKey` (L318: a `user-keys` key named `bos login — <device> — <date>`, with optional `expiresIn`) or `mintDeployKey` (L353). `mintDeployKey` goes through the plugin's server-side `createDeployKey` route because Better Auth rejects client-set `permissions` (`SERVER_ONLY_PROPERTY`). That route bakes in `{ bundles: ["write"] }` plus account/gateway metadata ([`services/api-keys.ts#L123-L179`](https://github.com/NEARBuilders/everything-dev/blob/v2.0.0-rc.27/plugins/auth/src/services/api-keys.ts#L123-L179)).
- **There's an approval UI.** The auth-ui remote, which this app composes, serves `/login/device` (code entry) and `/login/device/approve` ([`plugins/auth/ui/src/routes/_public/login/device/approve.tsx`](https://github.com/NEARBuilders/everything-dev/blob/v2.0.0-rc.27/plugins/auth/ui/src/routes/_public/login/device/approve.tsx)). Signed-out users are sent to login with the pairing params kept (L106), and the page calls `auth.device.approve({ userCode })` (L136). It doesn't show which client is asking or what scope it wants.
- **Keys carry permissions, but only some routes check them.** The `user-keys` config ([`auth-instance.ts#L434-L451`](https://github.com/NEARBuilders/everything-dev/blob/v2.0.0-rc.27/plugins/auth/src/auth-instance.ts#L434-L451)) has metadata, expiry from 1 to 3650 days, and 1000 requests per minute. `getContext` resolves a `user-keys` key to its owning user ([`services/session.ts#L188`](https://github.com/NEARBuilders/everything-dev/blob/v2.0.0-rc.27/plugins/auth/src/services/session.ts#L188)). Here, [`api/src/lib/auth.ts`](../api/src/lib/auth.ts) `requireAuth` checks only that a user is present, while `requireApiKey(perms)` (L233) checks permissions. Only the review routes use `requireApiKey` today ([`api/src/index.ts#L818`](../api/src/index.ts#L818)). `createProject` (L1126) and the other writes use `requireAuth`, so a key's `permissions` don't limit what it can write there.

### Questions answered

**Does Better Auth or better-near-auth support a device grant today, or do we build it?**
It's supported and already running. Better Auth 1.7.7's `deviceAuthorization` plugin is enabled upstream, and better-near-auth/everything-dev add the device-link claim and the CLI client. What's missing is narrower:
1. A client id for agents, because the allow-list holds one site id plus the CLI.
2. A server-side exchange from the approved device token to a scoped, expiring API key. A raw agent can't reuse the CLI's client-side mint because it can't set `permissions`.
3. Revoking the bridging session. The CLI flow leaves a full web session (Better Auth's default 7 days; `auth-instance.ts` doesn't override it) alive after minting its key.
4. Approval-page copy that names the client and the requested scope.

**What's the right scope model for a device grant?**
The grant's output should be an ordinary `user-keys` API key, not a long-lived session. That reuses everything keys already have: `permissions`, `expiresAt`, rate limits, `metadata`, verification in `getContext`, and the delete button on `/settings/api-keys`.
- **Scopes are API-key permission statements.** The agent asks with the RFC 8628 `scope` parameter (`POST /device/code { client_id, scope: "projects:write builders:write" }`). Better Auth already stores it in `device_code.scope` and returns it to the approving user from `GET /device`. The server maps it onto an allow-listed statement set and writes it to the key as `permissions`, the same way `createDeployKey` sets `{ bundles: ["write"] }`. Unknown scopes are rejected (`invalid_scope`), never widened.
- **Grants are time-boxed.** They expire after 30 days by default, inside the existing 1–3650 day bound. The agent can ask for less but never more.
- **Grants are revocable from settings.** Every device-minted key is named `agent — <client label> — <date>` and carries `metadata: { grant: "device", clientId, scope }`, so it appears on `/settings/api-keys` and deletes like any key.
- **Scopes only bite where routes check them.** In this app that means agent-writable routes move from `requireAuth` to a permission check when the caller is an API key: a local `requireScope` that passes session callers and checks `context.apiKey.permissions` for key callers. That change is local.

**How does it interact with SIWN wallet sessions?**
Approval uses the browser's existing session, whatever method created it (SIWN, passkey, email, phone). The approve page already sends signed-out users through login and back with the `user_code` kept. A wallet signature per grant isn't needed: the grant is an off-chain API key, and NEP-413 ownership was already proven when the session was created. Two refinements:
- **Ask for a recently created session.** Approval should need a session younger than about 10 minutes, like Better Auth's `freshAge` check on `unlink-account`, so a stale tab can't approve. Older sessions get a re-sign-in prompt.
- **Keep the wallet for on-chain access.** If an agent needs on-chain access, the existing delegate mode (`pubKey` + `contract` params) already adds a function-call key through a wallet transaction on the same approve page. Agent API grants and on-chain delegate keys stay separate, opt-in parts of one approval.

**UX: where does the approval prompt live, and what does the agent-side handshake look like (MCP-friendly)?**
- **The prompt lives upstream.** It's `/login/device/approve` in the auth-ui remote, already composed into this app, with `source=agent`. It needs to show the client label, the requested scopes in plain words ("Create and edit your projects"), the expiry, and Approve/Deny. Building a local approval page here would fork auth UI, which the standing rule says not to do before design is discussed.
- **The handshake runs before MCP.** MCP itself needs a credential (`tools/list` returns 401 without one), so the agent does a plain-HTTP handshake first. This copy-paste prompt works with any agent:
  1. `POST https://nearbuilders.org/api/auth/device/code` with `{ "client_id": "nearbuilders-agent", "scope": "projects:write" }`, which returns `user_code`, `verification_uri_complete` and `interval`.
  2. Show the user the link and code, and ask them to approve.
  3. Poll the exchange endpoint every `interval` seconds until it returns `{ key, expiresAt }`, handling `authorization_pending`, `slow_down`, `access_denied` and `expired_token`.
  4. Call `POST /api/mcp` with `x-api-key: <key>`.
- **The key stays in the agent.** It goes from the server straight to the agent, never through the clipboard.
- **MCP-native OAuth is a later option.** The MCP authorization spec expects OAuth 2.1 authorization-code + PKCE, and Better Auth 1.7.7's core ships no OAuth-provider/MCP plugin (`better-auth/dist/plugins/` lists `device-authorization`, `bearer`, `jwt`, `generic-oauth` and others, but no provider). It's worth revisiting once agent grants exist, but it shouldn't block this.

**How do the #318/#320 cards change once device linking exists?**
The card keeps its two-step shape, and the credential step changes:
- **"Connect your agent" becomes the default action.** The copyable prompt carries only the site URL, the MCP URL, the device handshake above, and the field instructions for project info (#318) or the builder profile (#320). There's no key in the prompt or the clipboard.
- **"Create an API key" moves to a fallback.** It sits behind a "my agent can't open links" disclosure, the in-page key flow #318 ships now.
- **The prompt's request depends on the card.** The project card asks for `projects:write`, and the /join card asks for `builders:write`.

So #318/#320 should build the card with the credential as a swappable slot (key-in-prompt today, device handshake later) and the field instructions injected, as #320 already requires.

### Recommendation
**Extend the existing device-authorization + device-link flow, upstream, so it ends in a scoped, expiring, revocable API key rather than a session.** Don't build a second grant mechanism here, and don't adopt OAuth/MCP-native auth yet.

#### Where each part lands
**Upstream in everything-dev (`plugins/auth`):** these are code in the auth plugin, and auth changes land there.
- `deviceLink.agentClients`, an allow-list of `{ clientId, label, scopes: { <scope>: <permission statements> }, maxExpiresInDays }` read by `validateClient`. Keep `clientId` immutable per ADR 0025.
- A new endpoint `POST /api/auth/device-link/agent-key { device_code, client_id }`. It runs the token grant internally, mints a `user-keys` key with server-side `permissions` mapped from the stored `device_code.scope`, `expiresIn` and `metadata`, and deletes the bridging session in the same transaction. It returns the key once.
- Approve-page copy: read `GET /device?user_code` for client and scope, render the scopes and the expiry, add `source=agent` handling, and require a fresh session.

**Runtime config (`bos.app.ts` here, after the platform pin that ships the above):**
- `auth.variables.deviceLink`: set nearbuilders' own `clientId` (as citynode.app does) and an `agentClients` entry for `nearbuilders-agent`, with the scopes `projects:write` and `builders:write`.

**Local in nearbuilders.org:**
- `requireScope(...)` in `api/src/lib/auth.ts`, applied to the agent-writable routes (`createProject`, `updateProject`, builder-profile writes). Session callers pass, and key callers need the permission.
- The #318/#320 card's "Connect your agent" prompt.
- Agent docs: the `/skill` page and the agent section of `AGENTS.md`. That section is sync-owned, so its upstream counterpart goes in the same change.

### Proposed follow-up tickets (not filed)
1. **everything-dev: agent device grants mint scoped API keys.** Add the `deviceLink.agentClients` config and the `POST /device-link/agent-key` exchange, which mints a `user-keys` key with server-side permissions from the stored scope, expiry and metadata and deletes the bridging session. Integration test alongside `tests/integration/device-link.test.ts`: code → approve → exchange → key verifies, session gone, unknown scope rejected.
2. **everything-dev: approve page names the agent, its scopes and the expiry.** `/login/device/approve` reads `GET /device` for client and scope, renders scopes in plain words, handles `source=agent`, and requires a session younger than about 10 minutes. i18n strings go in `plugins/auth/ui/src/i18n/catalogs.ts`.
3. **nearbuilders.org: `requireScope` for agent-writable routes.** Session callers pass, and API-key callers need the named permission. Apply it to project create/update and builder-profile writes, with tests for a session caller, a key with the scope, a key without it, and an expired key.
4. **nearbuilders.org: enable agent device grants in runtime config.** After the platform pin bump that ships (1), set `auth.variables.deviceLink` (own `clientId` plus the `nearbuilders-agent` client with `projects:write`/`builders:write`) in `bos.app.ts`.
5. **nearbuilders.org: "Connect your agent" on the #318/#320 card.** Make the device handshake the default credential step and keep in-page key creation as the fallback. Update the `/skill` page and the agent auth docs (upstream counterpart for the synced `AGENTS.md` section).
