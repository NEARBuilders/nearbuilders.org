---
name: fastkv-registry
description: Publish, resolve, and discover runtime configs on a FastKV registry. Use when debugging bos:// config resolution, tenant config publishing, FastKV read URLs, registry namespaces, or discovery listings that come back empty.
---

# FastKV Registry

FastKV is a key-value layer indexed from NEAR function calls to a `__fastdata_kv` contract method. Runtime configs (`bos.config.json`), plugin manifests, and app metadata all live there. This skill covers the invariants that keep writers, readers, and resolvers in agreement.

## The storage model

Every `__fastdata_kv` call writes key-value pairs. FastKV indexes each row under two account dimensions:

- **receiver** — the contract that received the call (`current_account_id` on the row)
- **signer** — the account whose signature initiated it (`predecessor_id` on the row)

The canonical read URL mirrors both:

```
GET <fastkv-base>/v0/latest/<receiver>/<signer>/<url-encoded-key>
```

Two consequences:

1. **Rows are namespaced by receiver.** The same key written via calls to different contracts lands in disjoint tries. A reader pointed at the wrong receiver sees `{"entries":[]}` — a silent miss, not an error.
2. **The signer segment is the publishing account**, not a relayer. Meta-transactions (delegate actions) preserve the original sender; a DAO multisig records the DAO account. Build the URL from the account that *intended* to publish.

On mainnet the shared base is `https://kv.main.fastnear.com`; testnet is `https://kv.test.fastnear.com`.

## One registry, one helper

A `bos://<account>/<gateway>` URL resolves to the key `apps/<account>/<gateway>/bos.config.json` under the **global registry receiver** (the ecosystem's canonical contract, e.g. a well-known registry account). This resolution plane is load-bearing:

- Hosts load tenant configs from it at request time.
- `extends:` chains are walked through it — a child runtime's parent must be resolvable there or the whole lineage fails.

Therefore:

- **Runtime configs that any host must serve go to the global registry. Always.** Do not point the publish path at a project-local receiver; the host will never find it.
- **Never hand-roll the URL.** Import the shell package's builder (e.g. `buildRegistryConfigUrl(accountId, gatewayId)`) everywhere: CLI publish, wizard re-checks, host fetches, smoke tests. Namespace and key derivation change in exactly one place.
- **A custom registry receiver is for isolated experiments only** (CLI `--registry <contract>` plumbs through publish and confirmation). Anything published there is invisible to `bos://` resolution.

## Publish vs. discovery are different planes

- **Publish plane** — writing configs/manifests so `bos://` resolves. Global registry receiver. Verified by re-reading the exact URL and comparing payloads.
- **Discovery plane** — "what apps exist?" listings. A FastKV prefix scan over a registry is one option, but a project's own database (tenant/subscription tables) is usually the better source: it is authoritative, isolated per project, and does not leak other ecosystems' rows.

Keep the planes separate. Do not let a project-local discovery namespace override leak into the publish path — that is the classic failure mode: publish succeeds, the writer's own re-check even succeeds (same wrong receiver), and the host 404s forever.

## Debugging an empty read

1. Decode the failure: `{"entries":[]}` means wrong `(receiver, signer)` or the tx has not landed yet; non-200 means transport.
2. Enumerate the trie to find where the row actually landed: `POST <base>/v0/latest/<receiver>` with body `{"limit": 100, "key_prefix": "apps/"}` — try the suspected receivers. The row's `predecessor_id` tells you the real signer.
3. Compare the writer's target contract with the reader's assumed receiver. Mismatch = config drift between the publish path and the resolution path. Fix by aligning the writer to the global registry (remove project-local overrides), then re-publish.
4. Confirm payload equality after the row lands — writers should poll until the re-read matches what they intended (publish-and-confirm loop).

## Checklist for any new publish surface

- [ ] Publishes to the global registry receiver by default (test pins this).
- [ ] Re-check/confirmation uses the same URL builder as the host.
- [ ] Hostname/identity data shown in listings comes from the project database, not from string-deriving `slug.gateway`.
- [ ] `extends:` targets exist in the global registry before a child is published against them.
- [ ] Orphan rows from earlier mis-targeted writes are documented (they cannot be GC'd casually).
