# NEAR Builders skill

Use this when a builder asks you to help them get started on NEAR: join NEAR Builders, pick a topic, find the docs, and get involved. Everything here links to live pages on `https://nearbuilders.org`.

## What NEAR Builders is

NEAR Builders (`nearbuilders.org`) is an open network where people building on NEAR find each other, make their work visible, and find where to start building.

- **Builders**: a directory of approved builder profiles (name, bio, skills, location, links), each tied to one NEAR account.
- **Projects**: a board where builders share projects and ideas, upvote them, and find teams.
- **Events**: NEAR events and meetups.
- **Activity**: a feed of what builders are shipping, with a leaderboard.
- **Build page**: the hub for building on NEAR at [nearbuilders.org/build](https://nearbuilders.org/build), kept current by the builder community.

## Join

There is one place to join: [nearbuilders.org/join](https://nearbuilders.org/join).

1. Open `/join` and connect the NEAR account that should appear on the builder profile.
2. Fill in the builder profile: name, bio, skills, location and links.
3. Submit. The profile stays pending until an admin approves it. Once approved, the builder appears in the directory.

### Nominations

A nomination is someone vouching that a NEAR account should become a builder.

- **Telegram or X**: when someone nominates you on Telegram or X, you get a link like `https://nearbuilders.org/join?nomination=…`. Open it and join as above; the nomination is attached to your profile for review. If the link was already used or is invalid, you can still join without it.
- **Web**: to nominate someone else, sign in and use the nominate form at [nearbuilders.org/builders/add](https://nearbuilders.org/builders/add) with their NEAR account. The nominate form is only for nominating others; to join yourself, use `/join`.

## Start building

The build page groups building on NEAR into three topics. These are the same links as [nearbuilders.org/build](https://nearbuilders.org/build).

### Private Cloud

Run AI models and agents on private, verifiable compute with NEAR AI.

- [NEAR AI Docs](https://docs.near.ai)

**NEAR AI Cloud** lets you call open models through an OpenAI-compatible API, running inside private, verifiable hardware.

- [Agent skill](https://github.com/near/agent-skills/tree/main/skills/near-ai-cloud): load this into your coding agent to work with NEAR AI Cloud
- [Models](https://near.ai/models)

To get access:

1. [Get an API key](https://cloud.near.ai) from the NEAR AI Cloud dashboard.
2. Point any OpenAI SDK at the base URL: `https://cloud-api.near.ai/v1`

### Agentic Commerce

Let agents swap, pay and settle across chains through NEAR Intents.

- [NEAR Intents Docs](https://docs.near-intents.org)

**Agent Connect** (the NEAR Intents Agent API) gives an AI agent its own account on NEAR Intents, acting within rules its owner signs.

- [Agent skill](https://github.com/NEAR-Intents-Agent-API/skills): load this into your coding agent to work with Agent Connect
- [TypeScript SDK](https://github.com/NEAR-Intents-Agent-API/sdk-typescript)
- [Demo app](https://github.com/NEAR-Intents-Agent-API/demo)
- [Examples](https://github.com/NEAR-Intents-Agent-API/examples)

To get access:

1. [Get an API key](https://partners.demo.agentsonintents.com/) from the partner portal.
2. Point your agent at the base URL: `https://api.demo.agentsonintents.com`

### Smart Contracts

Write, test and deploy contracts and apps on NEAR Protocol.

- [NEAR Docs](https://docs.near.org)

**Write a contract**: learn how contracts work on NEAR, pick an SDK, start from a reference contract, and get testnet NEAR to deploy it.

- [What is a smart contract](https://docs.near.org/smart-contracts/what-is)
- [SDK libraries](https://docs.near.org/tools/sdk)
- [Reference contracts](https://docs.near.org/tools/contracts-list)
- [Testnet faucet](https://near-faucet.io): get testnet NEAR to deploy and test contracts

## Get involved

- **Give feedback**: help improve NEAR Builders through the [feedback.nearbuilders.org project](https://nearbuilders.org/projects/project/feedback-nearbuilders-org-ew364z).
- **Follow activity**: see what builders are shipping at [nearbuilders.org/activity](https://nearbuilders.org/activity), and follow the [activity.nearbuilders.org project](https://nearbuilders.org/projects/project/activity-nearbuilders-org-2erd1k) that powers it.
- **Share a project**: sign in and add it at [nearbuilders.org/projects/new/project](https://nearbuilders.org/projects/new/project) so other builders can find it, upvote it and join in.
- **Talk to builders**: join the builder Telegram chat at [t.me/nearbuilderschat](https://t.me/nearbuilderschat).

## Public pages

- [`/`](https://nearbuilders.org/): home
- [`/build`](https://nearbuilders.org/build): build page with topics and docs
- [`/join`](https://nearbuilders.org/join): join NEAR Builders
- [`/builders`](https://nearbuilders.org/builders): builder directory
- [`/builders/add`](https://nearbuilders.org/builders/add): nominate a builder
- [`/projects`](https://nearbuilders.org/projects): projects and ideas
- [`/events`](https://nearbuilders.org/events): events
- [`/activity`](https://nearbuilders.org/activity): activity feed and [leaderboard](https://nearbuilders.org/activity/leaderboard)
- [`/about`](https://nearbuilders.org/about): about the platform
- [`/skill`](https://nearbuilders.org/skill) and [`/skill.md`](https://nearbuilders.org/skill.md): this skill
- [`/llms.txt`](https://nearbuilders.org/llms.txt) and [`/README.md`](https://nearbuilders.org/README.md): short summaries for agents and people

## NEAR Builders API for agents

The data behind these pages is available over HTTP at `https://nearbuilders.org/api`.

- **Reference**: interactive docs at [nearbuilders.org/api](https://nearbuilders.org/api) and the OpenAPI spec at [nearbuilders.org/api/spec.json](https://nearbuilders.org/api/spec.json).
- **Public reads**: for example `GET /api/v1/builders`, `GET /api/v1/builders/{nearAccount}`, `GET /api/v1/projects`, `GET /api/v1/projects/by-slug/{slug}`, `GET /api/v1/events` and `GET /api/v1/activity`.
- **Writes**: creating or editing projects, profiles and nominations needs the builder to be signed in. A builder can create an API key at [nearbuilders.org/settings/api-keys](https://nearbuilders.org/settings/api-keys) and send it in the `x-api-key` header, but not every write route accepts a key. If a route returns `UNAUTHORIZED`, ask the builder to do that step on the site.
- **Typed client**: the same procedures are available over oRPC at `https://nearbuilders.org/api/rpc`.

Check the spec before calling a route; do not guess paths or fields.

## Run or fork NEAR Builders

To run, fork or contribute to the platform itself, see [Run or fork NEAR Builders](https://github.com/NEARBuilders/nearbuilders.org#run-or-fork-near-builders) in the repository README.
