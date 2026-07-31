# Nostr <> NEAR Integration
**Target: August 2026**

nostr.nearbuilders.org

# **Summary**

Build a reusable NEAR <> Nostr integration package that lets NEAR applications add comments, messaging, and feed-style interactions backed by public Nostr relays. Start by migrating the existing Legion Chat — Nostr Feed code into a modular API/UI architecture, then integrate it into nearbuilders.org as the first production surface.

The strategic bet: if nearbuilders.org uses the same Nostr relay layer that Buzz uses, builder conversations become portable, agent-readable, and interoperable with emerging human + agent collaboration tools like Buzz.

# **Problem**

NEAR builder discussion currently lives across fragmented surfaces: Telegram, websites, project pages, social feeds, and internal tooling. This makes it hard to:

- Attach conversation directly to builder profiles, projects, scopes, and submissions.
- Preserve message history in an open, portable format.
- Let agents read and act on ecosystem discussion with proper context.
- Build alternative UIs without rewriting the identity, relay, and messaging logic each time.

Nostr is a good fit because it is a simple public relay protocol for signed events, not a single platform. The official Nostr repo describes it as a protocol that does not rely on a trusted central server and uses cryptographic keys/signatures for tamperproof events: [nostr-protocol/nostr](https://github.com/nostr-protocol/nostr). Relays act as message storage/broadcast servers, while clients own most app logic: [Nostr relays overview](https://nostr.com/relays).

# **Product Direction**

Create a NEAR-native Nostr module that can be embedded into NEAR Builder products.

Core direction:

- **Identity:** connect NEAR accounts with Nostr public keys, using the Legion Chat implementation as the starting point.
- **Messaging:** support comments, threads, DMs or channel-like conversations where appropriate.
- **Portability:** publish/read standard Nostr events where possible so messages are not locked to one app.
- **Agent-readiness:** structure messages so Buzz-style agents can consume relevant discussions, project context, and history.
- **Composable UI:** separate backend/API logic from UI so nearbuilders.org, Legion, City Nodes, or alternate apps can render their own experiences.
- **OpenAPI-first:** use the everything-dev framework so the API has a generated spec and SDK, making it easier for builders to integrate.

Relevant external context:

- Block describes Buzz as a Nostr-based collaboration workspace with channels, threads, DMs, media, code repositories, and automated workflows: [Introducing Buzz](https://buzz.xyz).
- TNW frames Buzz as an open-source workspace where humans and AI agents share context, with companies owning their collaboration layer rather than being locked into proprietary platforms: [TNW on Buzz](https://thenextweb.com/news/block-buzz-humans-ai-agents-workspace).
- NIPs are the convention layer for Nostr-compatible client/relay behavior; the integration should implement only the NIPs needed for this use case: [Nostr NIPs](https://github.com/nostr-protocol/nips).

# **Service Architecture**

Implement the integration as two layers: **nostr-core** and **near-nostr**.

## **nostr-core**

`nostr-core` should be a thin, reusable wrapper around the standard Nostr relay protocol. It should avoid NEAR-specific assumptions and expose the smallest useful API for publishing, querying, and subscribing to Nostr events.

Core responsibilities:

- Define shared schemas for Nostr events, unsigned events, filters, relay responses, and subscription messages.
- Publish signed events to one or more relays.
- Query relays using standard Nostr filters.
- Subscribe to realtime relay updates.
- Close subscriptions.
- Normalize relay responses such as accepted events, rejected events, notices, and end-of-stored-events messages.

Minimal API shape:

```tsx
nostrCore.publishEvent({
  event,
  relays,
})

nostrCore.queryEvents({
  filters,
  relays,
  timeoutMs,
})

nostrCore.subscribe({
  filters,
  relays,
})

nostrCore.closeSubscription({
  subscriptionId,
  relays,
})
```

The core Nostr schema should stay close to the protocol:

```tsx
type NostrEvent = {
  id: string
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
  sig: string
}

type NostrFilter = {
  ids?: string[]
  authors?: string[]
  kinds?: number[]
  since?: number
  until?: number
  limit?: number
  "#e"?: string[]
  "#p"?: string[]
  "#a"?: string[]
  "#d"?: string[]
  "#t"?: string[]
  "#r"?: string[]
}
```

This layer should map directly to the simple Nostr relay message model:

- `["EVENT", event]` for publishing.
- `["REQ", subscriptionId, ...filters]` for querying or subscribing.
- `["CLOSE", subscriptionId]` for closing a subscription.
- Relay responses such as `EVENT`, `OK`, `EOSE`, and `NOTICE`.

## **near-nostr**

`near-nostr` should be the opinionated NEAR application layer built on top of `nostr-core`. It should make Nostr easy to embed in NEAR Builder products without forcing each app to understand relay details, tag conventions, account linking, or comment/thread modeling.

Core responsibilities:

- Link NEAR accounts to Nostr public keys.
- Resolve a NEAR account’s linked Nostr identity and profile metadata.
- Create comments, replies, and feed posts as Nostr events.
- List comments or threads attached to NEAR Builder objects.
- Apply consistent tagging conventions for nearbuilders.org, Legion, City Nodes, and future NEAR apps.
- Provide an OpenAPI/oRPC surface and generated SDK through the everything-dev framework.

Recommended API shape:

```tsx
nearNostr.linkAccount({
  nearAccountId,
  nostrPubkey,
  proof,
})

nearNostr.getIdentity({
  nearAccountId,
})

nearNostr.createComment({
  target,
  content,
  parentEventId,
  nearAccountId,
  relays,
})

nearNostr.listComments({
  target,
  limit,
  cursor,
  relays,
})

nearNostr.createThread({
  target,
  title,
  content,
  nearAccountId,
  relays,
})

nearNostr.listThread({
  rootEventId,
  relays,
})
```

A NEAR Builder target should be represented consistently:

```tsx
type NearNostrTarget = {
  type: "builder" | "project" | "scope" | "submission" | "page"
  id: string
  url?: string
}
```

When creating a comment, `near-nostr` should translate the app-level target into Nostr tags. For example:

```tsx
[
  ["client", "nearbuilders"],
  ["app", "nearbuilders.org"],
  ["near_account", "elliot.near"],
  ["target_type", "project"],
  ["target_id", "near-ai-agent-market"],
  ["target_url", "https://nearbuilders.org/projects/near-ai-agent-market"],
  ["t", "nearbuilders"],
  ["t", "project"]
]
```

For broad Nostr compatibility, the implementation should prefer standard tags where possible:

- `e` tags for event references and replies.
- `p` tags for user/pubkey references.
- `t` tags for topics such as `nearbuilders`, `project`, or `scope`.
- `r` tags for URLs.
- `a` tags for addressable or parameterized references where useful.

Custom tags such as `target_type` and `target_id` are useful for app semantics, but relay support for filtering arbitrary custom tags may vary. The API should therefore maintain enough local indexing or standard-tag mapping to reliably list comments by NEAR Builder object.

## **oRPC/OpenAPI Direction**

The oRPC spec should expose both layers:

- `nostr-core` for low-level event, filter, relay, and subscription operations.
- `near-nostr` for NEAR-native product actions such as account linking, comments, feeds, and threads.

This gives builders two integration paths:

- Use `near-nostr` for the common product flows.
- Use `nostr-core` directly when building custom clients, alternate UIs, relay tooling, or agent integrations.

The first release should keep the Nostr implementation intentionally small. Start with:

- Basic Nostr event schema.
- Basic filter schema.
- Kind `0` metadata/profile support.
- Kind `1` public text notes/comments.
- `e`, `p`, `t`, `r`, and optionally `a` tags.
- Public comments and threads.
- NEAR account <> Nostr pubkey linking.

Defer DMs, advanced moderation, private messaging guarantees, and new Nostr standards until the comments/feed use case is working in production.

```
NEAR Wallet (user)
    │
    │  signs in, links Nostr identity
    ▼
near-nostr  (NEAR account ↔ Nostr pubkey)
    │
    │  creates signed Nostr events (comments, threads, metadata)
    ▼
nostr-core  (publish, query, subscribe)
    │
    │  EVENT / REQ / CLOSE
    ▼
Nostr relays  (storage + distribution)
    │
    │  subscribed clients receive events
    ▼
nearbuilders.org UI  +  Legion Chat  +  alternate UIs
    │
    │  structured events on relay stream
    ▼
Buzz-style agents  (read, summarize, route, act)
```

# **Proposed Flow**

1. **User connects wallet**
    - User signs into nearbuilders.org with a NEAR account.
    - App detects whether the user already has a linked Nostr identity.
2. **User links or creates Nostr identity**
    - If linked: load the user’s Nostr profile and relay settings.
    - If not linked: guide the user through a lightweight connect/create flow based on the existing Legion Chat pattern.
3. **User comments or messages**
    - User writes a comment on a builder profile, project page, scope, or feed.
    - App publishes a signed Nostr event to the configured relay(s).
    - App stores only the minimal mapping/indexing needed on the NEAR/nearbuilders side.
4. **Apps render the same conversation**
    - nearbuilders.org renders the thread inline.
    - Legion Chat or alternate UIs can render the same event stream.
    - Buzz agents can observe/reason over the public relay stream where configured.
5. **Agents act with context**
    - Agents can summarize activity, surface unanswered questions, route builder needs, or identify promising projects from public discussion history.

# **Initial Scope**

- Migrate the existing Legion Chat — Nostr Feed code into a reusable package or service.
- Define a clean NEAR account <> Nostr key/account linking model.
- Create an API layer with OpenAPI spec + SDK via everything-dev.
- Integrate the first version into nearbuilders.org.
- Support a default relay configuration compatible with the Buzz direction.
- Document integration steps for future NEAR apps.
- Preserve references to Nostr docs, Legion Chat, Buzz, and nearbuilders.org in the final handoff.

# **Engagement Model**

- NEAR account linking enables identity portability — comments and threads travel with the user across apps and UIs
- Comments and threads appear inline on builder profiles, project pages, and scope documents
- Messages published via Nostr are readable from the configured relay(s) outside the original UI
- Structured events let Buzz-style agents summarize, route, and act on builder discussion from the relay stream
- The same Nostr relay infrastructure serves both chat and activity scopes

**Owner:** NearBuilders / Builder Ops
**Builder:** Jemartel
**Reviewers:** NearBuilders product owner, NEAR DevRel, and agent/Buzz integration reviewer
**Cadence:** weekly demo until August target
**Handoff:** repo, API docs, SDK, integration guide, and nearbuilders.org PR

# **Milestones**

1. **Discovery + architecture**
    - Audit Legion Chat implementation.
    - Decide Nostr identity/key handling approach.
    - Confirm relay assumptions and Buzz compatibility needs.
2. **Package/service extraction**
    - Separate reusable logic from existing Legion Chat UI.
    - Add API boundary and OpenAPI generation.
3. **nearbuilders.org integration**
    - Add comments/feed component to one or two target surfaces.
    - Validate wallet/Nostr linking UX.
4. **Agent-readiness pass**
    - Confirm events are structured and discoverable enough for Buzz-style agents.
    - Add docs/examples for agents reading the relay stream.

# **Out of Scope (August)**

- Building a full Buzz competitor.
- Replacing Telegram or all existing Legion communication.
- Creating a new Nostr standard.
- Complex moderation/reputation systems beyond basic controls.
- Full private messaging guarantees.
- Deep on-chain storage of all messages.

# **Success Metrics**

- nearbuilders.org has at least one live surface with Nostr-backed comments or feed.
- NEAR account <> Nostr account linking works for existing and new users.
- Existing Legion Chat functionality is preserved or improved after migration.
- Another UI can consume the same API/SDK without custom backend work.
- Messages are readable from the configured relay(s) outside the original UI.
- Agents can summarize or act on relevant builder discussion from the relay stream.
- Integration docs are clear enough for a second NEAR app to adopt.

# **Delivery Outcome**

By end of August, deliver a compact, reusable NEAR <> Nostr integration that:

- Moves Legion Chat’s NEAR/Nostr connection into a maintainable architecture.
- Adds Nostr-powered comments or messaging to nearbuilders.org.
- Keeps the relay-based message layer open for alternate UIs and Buzz-style agents.
- Establishes the a practical social/messaging primitive for NEAR Builder products.