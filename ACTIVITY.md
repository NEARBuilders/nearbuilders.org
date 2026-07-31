# Activity Service
**Target: August 2026**

activity.nearbuilders.org

# **Summary**

Several ideas converge on a shared activity layer — reputations, points, personalities, and footprints all need the same plumbing. This initial scope proposes delivering a stand-alone aggregation service at `activity.nearbuilders.org`, where any NEAR project — games, polling services for GitHub or on-chain activity, or nearbuilders.org itself — registers through an admin dashboard, gets its own API key, then POSTs events to an HTTP gateway.

To ensure low cost and low latency, the initial implementation suggests to leverage Nostr + Redis. On API key creation, a Nostr keypair is also issued and linked to the project. The gateway signs events with per-project Nostr keys (AES-256 encrypted at rest) and publishes to relays. Nostr handles event storage and distribution. Redis stores raw event counts per actor per type; leaderboard reads multiply counts by current point values from config, making points fully dynamic with zero rebuild on change. SSE streams new events to the UI. Depends on the NEAR <> Nostr integration scope for `nostr-core` relay communication and `near-nostr` NEAR ↔ Nostr pubkey linking.

For context, this scope is derived from the following few projects:

### **1. Near Trust Passport: A Portable Reputation Layer For The Ecosystem**

- **Submitted by:** **`theark.near`**
- **Date:** 2026-06-26
- **Link:** https://nearbuilders.org/projects/idea/near-trust-passport-a-portable-reputation-layer-for-the-ecosystem-igj5w5?kind=idea
- **Summary:** An open reputation layer that collects users' past achievements across the ecosystem — governance participation, builder contributions, community moderation, educational quests, hackathon participation, bug reports, etc. Generates a trust score per category. Projects can use it for airdrops, beta access, DAO contributor identification, and builder showcases. Reputation belongs to the user, not any single app.

---

### **2. NEAR Points!**

- **Submitted by:** **`rykc22.tg`**
- **Date:** 2026-07-15
- **Link:** https://nearbuilders.org/projects?preview=proj_1784098879591_rqklwjz
- **Summary:** An ecosystem-wide unified loyalty/rewards platform. Users earn points for transaction volume, staking, NFT minting, governance voting, referrals, daily logins, and social tasks. Includes a dynamic campaign engine for protocols to create time-limited promotions, tier-based rewards, and NFT badges. Points can be redeemed in a marketplace for token airdrops, NFTs, dApp fee discounts, merchandise, and real-world rewards.

---

### **3. Wallet Personality Engine**

- **Submitted by:** **`unrealamine_boi01.tg`**
- **Date:** 2026-06-29
- **Link:** https://nearbuilders.org/projects?preview=proj_1782727459968_ix3gax9 
- **Summary:** Classifies NEAR wallets based on on-chain behavior (not token balance) into roles like Builder, Governance Voter, DeFi User, NFT Collector, Community Contributor, Long-Term Holder, or Early Adopter. Helps projects personalize experiences, reward meaningful participation, and understand users while preserving privacy. Recognizes what users do, not just what they own.

### **4. NearBuilders Activity & Footprints**

- **Submitted by:** NearBuilders Team
- **Date:** 2026-06 (ongoing)
- **Link:** https://github.com/NEARBuilders/nearbuilders.org/issues/23
- **Summary:** The existing activity plugin (Postgres-backed) powers a unified feed with SSE streaming, leaderboards, and moderation. Users emit manual activity events attached to their NEAR account. Admins can emit verified trusted events and hide events. Footprints (issue #23) proposes extending this to creator proof-of-work — uploadable media on builder profiles with community voting. The activity aggregator (issue #51) proposes pulling external events from GitHub, Ironclaw, and Nearn into the same feed with source badges. All events contribute to endorsement scoring. This scope would replace this existing activity plugin with a new standalone service.

---

# **Problem**

Activity data across the NEAR ecosystem is siloed — each app, game, and protocol tracks engagement independently. Contributors cannot carry reputation between projects; every new application starts from zero. There is no standard way for external projects to contribute to a shared activity layer, and content creators have no proof-of-work surface on the platform. The existing activity plugin works but is tightly coupled to the current nearbuilders.org monolith — a standalone service with clear integration guides is needed for external projects to adopt.

# **Product Direction**

Settle `activity.nearbuilders.org` as a thin aggregation service layered on Nostr. Nostr relays handle event storage, distribution, and pubkey-based identity. A lightweight Redis-backed aggregation layer stores raw event counts per actor and computes leaderboards on read. Projects push events through a simple HTTP gateway — an API key identifies the source, the service publishes the event to Nostr on their behalf. The activity service subscribes to its relays, maintains Redis count state, and streams events to the UI via SSE.

**Depends on:** NEAR <> Nostr integration — `nostr-core` for relay communication and `near-nostr` for NEAR account ↔ Nostr pubkey linking.

# **Service Architecture**

### **Service Requirements**

The activity service, regardless of implementation, must provide:

**API surface:**
- `POST /api/v1/events` — ingest an event (API key auth)
- `GET /api/v1/events` — query events with filters (source, type, actor, limit, cursor)
- `GET /api/v1/events/stream` — SSE stream of new events, filterable by source, type, actor
- `GET /api/v1/leaderboard` — leaderboard by period (week, month, all-time)

**Event model:**
- Each event has: `source` (registered source ID, managed through the admin dashboard), `type` (event kind), `actor` (NEAR account the activity is attributed to), `payload` (arbitrary JSON)
- De-duplication via idempotency key (source-prefixed, e.g., `github:pr:42`)
- Immutable — events are never modified, only hidden by admins
- Immutable event IDs enabling reliable de-duplication across submissions

**Identity & auth:**
- Every project registers with a NEAR account
- Project receives an API key for authenticating POST requests
- Events carry cryptographic provenance tied to the project's identity

**Admin dashboard:**
- Project self-serve onboarding (register, create API key, define valid event types)
- Admin source approval and rejection
- API key management (create, revoke)

**Dynamic point values:**
- Each event type carries a configurable point value
- Changing a point value retroactively updates all historical leaderboard positions
- No manual rebuild required — leaderboard reads always use current values

**Leaderboards:**
- Aggregated by actor across event types with point-weighted scoring
- Periods: weekly, monthly, all-time
- Top-N ranked by endorsement score with source breakdown per actor
- Verified events weighted higher than unverified

**SSE streaming:**
- Clients subscribe to a real-time event stream
- Filterable by source, type, and actor
- New events pushed immediately on ingest

---

### **Proposed Direction: Nostr + Redis**

The initial implementation suggests using Nostr for event storage and distribution, and Redis for leaderboard computation.

**Nostr for event storage and distribution.** Activity events are published as Nostr events with a custom kind (e.g., 31234). Nostr relays handle persistence, replication, and real-time distribution to subscribers.

**Redis for decoupled counts and scoring.** Redis stores raw event counts per actor per type, never precomputed scores:

```
counts:{period}:{actor}  →  Hash { "game.score": 42, "github.pr": 15, ... }
active:{period}          →  Sorted Set of actor names (by total event count)
```

On ingest, the activity service increments counts (`HINCRBY`). On leaderboard read, it fetches counts for active actors, multiplies each by its current point value from config, and sorts. Point values are dynamic — changing a value in config takes effect on the very next read with zero rebuild. Period-based keys (week, month) use TTL expiration. At 10K actors and 50 event types, a full leaderboard read is ~100ms; top-N reads are single-digit milliseconds.

**Event de-duplication.** Nostr event IDs are content-hashed (SHA-256). Publishing the same event twice produces the same ID — relays deduplicate automatically. No custom idempotency layer needed.

**Per-project Nostr keys.** Every project gets its own Nostr keypair — not a single shared gateway key. This gives each project a distinct Nostr identity on relays, making events independently verifiable and compatible with Buzz-style agents. Per-project keys also let projects reuse their Nostr identity for chat/comments from the [NOSTR.md](./NOSTR.md) scope.

**Key custody.** Nostr private keys are stored encrypted at rest (AES-256, master secret in env). The gateway decrypts to sign each event, then discards the plaintext. Key rotation is trivial because queries use NEAR account tags, not Nostr pubkeys — if a key is regenerated, only new events change (they sign with the new key). Historical events on relays are unaffected. Leaderboard/Redis (keyed by actor string) sees no change. No rebuild, no downtime.

**HTTP gateway for project ingest.** Projects never touch Nostr directly. They POST JSON events to a simple HTTP endpoint with an API key. The gateway:
1. Validates the API key
2. Signs the event with the project's Nostr key (decrypted at sign time)
3. Publishes to configured relays
4. Returns the event ID

**Identity model.** Every project has a NEAR account, which is linked to a Nostr pubkey via `near-nostr`. Each project's Nostr pubkey signs its own activity events. API keys authenticate the POST to the gateway; Nostr pubkeys cryptographically prove provenance on relays.

**Project onboarding flow:**
1. Project NEAR account logs into the activity dashboard
2. Creates a Nostr signing key (or links existing one) via `near-nostr`
3. Creates an API key bound to the project
4. Starts POSTing events to `POST /api/v1/events` with the API key
5. Gateway signs events with the project's Nostr key, publishes to relays

**Any project follows the same path.** For example, for a Github activity polling service, it would register as its own NEAR project, get a Nostr key and API key, then push events just like any other integration. The flow is identical whether it's a game pushing scores, a polling service ingesting feeds, or a project itself pushing events.

```
Project (NEAR account)
    │
    │  POST /api/v1/events  (API key)
    ▼
HTTP gateway
    │  validates API key
    │  signs event with project's Nostr key
    │  publishes to relays
    ▼
Nostr relays  (storage + distribution)
    │
    │  activity service subscribes
    ▼
Activity service  (Redis + SSE)
    │  HINCRBY counts:{period}:{actor} {event_type}
    │  leaderboard reads: count × current point value
    │  streams new events via SSE
    ▼
nearbuilders.org UI
```

# **Proposed Flow**

1. Project logs into activity dashboard → creates Nostr signing key → creates API key
2. Project POSTs events to `activity.nearbuilders.org/api/v1/events` with API key
3. Gateway validates key, signs event with project's Nostr key, publishes to relays
4. Activity service receives events via Nostr subscription, increments Redis count hashes per actor per event type
5. Leaderboard reads multiply counts by current point values from config (no precomputed scores, no replay on config change)
6. New events streamed to UI via SSE from the Nostr subscription stream
7. Any polling integration (e.g., a GitHub poller registered as its own NEAR project) follows steps 1–6 with its own key
8. nearbuilders.org pushes events through the same gateway for any builder activity (project created, claim applied, event joined, etc.)

# **Initial Scope**

- **Nostr relay configuration:** one relay (self-hosted for reliability), event kind definition for activity events
- **Redis count storage:** hash per actor per period (`HINCRBY` on ingest), leaderboard reads compute scores from counts × current point values in config
- **HTTP gateway:** `POST /api/v1/events` with API key auth, publishes to Nostr, returns event ID
- **Admin dashboard:** project self-serve onboarding (create Nostr key, create API key), admin source approval/rejection, API key management
- **NEAR ↔ Nostr pubkey linking:** via `near-nostr` from NEAR<>Nostr integration, one pubkey per project/actor
- **SSE streaming:** subscribe to Nostr relay, push new events to connected UI clients
- **First external polling integration** (e.g., GitHub poller as its own registered project): polls source, pushes to gateway
- **Migration:** current nearbuilders.org activity plugin emits to gateway instead of Postgres
- **Onboarding guide:** document the registration flow (log in → create Nostr key → create API key → send events)

# **Engagement Model**

- Every event type carries a configurable point value — changing a value retroactively updates all historical leaderboard positions on the next read
- Redis count hashes drive leaderboards: weekly, monthly, all-time
- Source badges in the UI distinguish event origins (nearbuilders, github, game)
- Events receive public upvotes/downvotes through the existing votes plugin

# **Out of Scope (August)**

- On-chain NEAR event indexing for Wallet Personality Engine (achievable later via a dedicated indexer project pushing to the same gateway — same pattern as GitHub poller)
- Point redemption marketplace (NEAR Points! idea)
- Cross-ecosystem portable reputation (NEAR Trust Passport idea — foundation laid by activity events)
- Rate limiting per source (Nostr relay-level limiting sufficient for MVP)

# **Success Metrics**

- 3 external projects registered and pushing events by end of August
- One polling-based integration (e.g., GitHub) surfacing in the live feed with source badge
- Activity visible on builder profiles and projects board
- Leaderboard live with weekly, monthly, and all-time aggregation from Redis
- Onboarding guide usable by external project without guidance
- Relied-upon infrastructure from [NOSTR.md](./NOSTR.md): nostr-core, near-nostr linking, relay config

# **Delivery Outcome**

- `activity.nearbuilders.org` live as thin gateway + aggregation service
- Nostr relay running and receiving activity events from the gateway
- Redis count hashes driving leaderboards with dynamic point values (no replay on config change)
- SSE streaming of new events from Nostr subscription to UI
- Admin dashboard for project self-serve onboarding, source approval/rejection, and API key management
- At least one polling-based integration (e.g., GitHub) registered as its own project and pushing events
- Activity visible on builder profiles and nearbuilders.org surfaces
- Onboarding guide: project logs in → creates Nostr key → creates API key → starts sending events
- Shared Nostr infrastructure (`nostr-core`, `near-nostr`, relay) usable by both activity and chat scopes