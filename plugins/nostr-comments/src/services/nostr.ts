/**
 * Nostr comments service — wraps near-nostr-sdk.
 * Stateless: comments are on Nostr relays, no local DB.
 */

import {
  StandardAdapter,
  BuzzAdapter,
  type RelayAdapter,
  type NostrEvent,
} from "near-nostr-sdk";
import { createHash } from "crypto";
import WebSocket from "ws";

// ws is externaled in rspack.config.js — rspack resolves to require("ws")

// ── Types ──

export type NostrComment = {
  id: string;
  pubkey: string;
  content: string;
  target: string;
  targetType: string;
  nearAccountId?: string | null;
  parentEventId?: string | null;
  createdAt: number;
  tags?: string[][];
  source: "standard" | "buzz";
};

export type PublishResult = {
  eventId: string;
  statuses: { relay: string; success: boolean }[];
};

export type ChannelInfo = {
  id: string;
  name?: string | null;
  members?: number | null;
};

// ── NostrCommentService ──

/**
 * Unified service wrapping near-nostr-sdk adapters.
 * Accepts pre-signed events (from extension/nsec) — never holds keys server-side.
 */

/** FastNear KV base URL (binding verification for requireVerified) */
const KV_API = "https://kv.main.fastnear.com";

export class NostrCommentService {
  #adapters: Map<string, RelayAdapter> = new Map();

  constructor(opts: {
    standardRelays?: string[];
    buzzRelays?: string[];
    buzzSecretKey?: Uint8Array; // only for Buzz NIP-42 auth (server identity, not user signing)
  }) {
    // Standard adapter — no keys needed
    if (opts.standardRelays?.length) {
      this.#adapters.set("standard", new StandardAdapter(opts.standardRelays));
    }

    // Buzz adapter — needs a key for NIP-42 relay auth, but NOT for signing user events
    if (opts.buzzRelays?.length && opts.buzzSecretKey) {
      this.#adapters.set("buzz", new BuzzAdapter({
        relays: opts.buzzRelays,
        secretKey: opts.buzzSecretKey,
        resolveChannel: (target: string) => {
          return createHash("sha256").update(target).digest("hex").slice(0, 16);
        },
      }));
    }
  }

  getAdapter(adapterType: string): RelayAdapter {
    const adapter = this.#adapters.get(adapterType);
    if (!adapter) throw new Error(`Unknown adapter: ${adapterType}`);
    return adapter;
  }

  hasAdapter(adapterType: string): boolean {
    return this.#adapters.has(adapterType);
  }

  /** List comments (read-only, no signing needed) */
  async listComments(opts: {
    target: string;
    targetType: string;
    adapterType: string;
    limit?: number;
    since?: number;
    enrich?: boolean;  // batch-resolve profiles
    requireBound?: boolean;  // filter: must have near_account tag
    requireVerified?: boolean;  // filter: must have verified KV binding
  }): Promise<NostrComment[]> {
    const adapter = this.getAdapter(opts.adapterType);
    const { events } = await adapter.query({
      target: opts.target,
      targetType: opts.targetType,
      clientName: "near-nostr-sdk",
      limit: opts.limit,
      since: opts.since,
    });

    const comments = events.map((e) => this.#toComment(e, opts.target, opts.targetType, opts.adapterType as "standard" | "buzz"));

    // requireBound: skip comments without near_account tag
    let filtered = opts.requireBound
      ? comments.filter((c) => c.nearAccountId)
      : comments;

    // requireVerified: batch-check KV bindings
    if (opts.requireVerified) {
      const accounts = [...new Set(
        filtered.filter((c) => c.nearAccountId).map((c) => c.nearAccountId!),
      )];
      const BATCH = 5;
      const verified = new Set<string>();
      for (let i = 0; i < accounts.length; i += BATCH) {
        const batch = accounts.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map(async (acc) => {
            try {
              const res = await fetch(
                `${KV_API}/v0/latest/contextual.near/${acc}/nostr/${acc}`,
                { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
              );
              if (!res.ok) return null;
              const data = await res.json();
              return data?.entries?.[0]?.value ? true : null;
            } catch { return null; }
          }),
        );
        results.forEach((r, idx) => {
          if (r.status === "fulfilled" && r.value) verified.add(batch[idx]);
        });
      }
      filtered = filtered.filter((c) => c.nearAccountId && verified.has(c.nearAccountId));
    }

    // enrich profiles after filtering (fewer pubkeys to resolve)
    if (opts.enrich) {
      const pubkeys = [...new Set(filtered.map((c) => c.pubkey))];
      const adapter = this.getAdapter("standard") as StandardAdapter;
      const BATCH = 5;
      for (let i = 0; i < pubkeys.length; i += BATCH) {
        const batch = pubkeys.slice(i, i + BATCH);
        const profiles = await Promise.allSettled(batch.map((pk) => adapter.getProfile(pk)));
        const profileMap = new Map<string, any>();
        profiles.forEach((r, idx) => {
          if (r.status === "fulfilled" && r.value) profileMap.set(batch[idx], r.value);
        });
        for (const c of filtered) {
          if (profileMap.has(c.pubkey)) (c as any).profile = profileMap.get(c.pubkey);
        }
      }
    }

    return filtered;
  }

  /** Publish a pre-signed event (signed client-side by extension/nsec) */
  async publishSigned(opts: {
    event: NostrEvent;
    target: string;
    targetType: string;
    adapterType: string;
  }): Promise<PublishResult> {
    // Bypass SDK bundle — use raw ws directly to avoid rspack bundling issues
    const adapter = this.getAdapter(opts.adapterType);
    const relays = (adapter as any).relays ?? ["wss://nos.lol", "wss://relay.damus.io", "wss://relay.primal.net"];
    const statuses: Array<{ relay: string; success: boolean }> = [];

    await Promise.all(
      relays.map(
        (url: string) =>
          new Promise<void>((resolve) => {
            const socket = new WebSocket(url);
            const timeout = setTimeout(() => {
              statuses.push({ relay: url, success: false });
              socket.close();
              resolve();
            }, 5000);
            socket.on("open", () => socket.send(JSON.stringify(["EVENT", opts.event])));
            socket.on("message", (data: any) => {
              const msg = JSON.parse(data.toString());
              console.log("[wsPublish] relay response:", url, JSON.stringify(msg));
              if (msg[0] === "OK") {
                statuses.push({ relay: url, success: msg[2] === true });
                clearTimeout(timeout);
                socket.close();
                resolve();
              }
            });
            socket.on("error", (err: any) => {
              console.error("[wsPublish] relay error:", url, err?.message || err);
              statuses.push({ relay: url, success: false });
              clearTimeout(timeout);
              resolve();
            });
          })
      )
    );

    return {
      eventId: (opts.event as any).id ?? "",
      statuses,
    };
  }

  /** List Buzz channels */
  async listChannels(adapterType?: string): Promise<ChannelInfo[]> {
    const type = adapterType ?? "buzz";
    const adapter = this.getAdapter(type);
    if (!(adapter instanceof BuzzAdapter)) {
      throw new Error("listChannels only works with Buzz adapter");
    }
    const events = await adapter.listChannels();
    return events.map((e: NostrEvent) => {
      const id = e.tags.find((t: string[]) => t[0] === "d")?.[1];
      const name = e.tags.find((t: string[]) => t[0] === "name")?.[1];
      return { id: id ?? e.id, name: name ?? null };
    });
  }

  // ── nostr-core: low-level relay access ──

  /** Raw relay query — any filter shape */
  async rawQuery(opts: { filter: Record<string, unknown>; relays?: string[] }): Promise<NostrEvent[]> {
    const adapter = this.getAdapter("standard") as StandardAdapter;
    // Use SimplePool directly for raw queries
    return adapter.queryRaw(opts.filter, opts.relays);
  }

  /** Publish any pre-signed event (any kind) */
  async rawPublish(opts: { event: NostrEvent; relays?: string[] }): Promise<PublishResult> {
    const relays = opts.relays ?? ["wss://nos.lol", "wss://relay.damus.io", "wss://relay.primal.net"];
    const statuses: Array<{ relay: string; success: boolean }> = [];

    await Promise.all(
      relays.map(
        (url: string) =>
          new Promise<void>((resolve) => {
            const socket = new WebSocket(url);
            const timeout = setTimeout(() => {
              statuses.push({ relay: url, success: false });
              socket.close();
              resolve();
            }, 5000);
            socket.on("open", () => socket.send(JSON.stringify(["EVENT", opts.event])));
            socket.on("message", (data: any) => {
              const msg = JSON.parse(data.toString());
              console.log("[wsPublish] relay response:", url, JSON.stringify(msg));
              if (msg[0] === "OK") {
                statuses.push({ relay: url, success: msg[2] === true });
                clearTimeout(timeout);
                socket.close();
                resolve();
              }
            });
            socket.on("error", (err: any) => {
              console.error("[wsPublish] relay error:", url, err?.message || err);
              statuses.push({ relay: url, success: false });
              clearTimeout(timeout);
              resolve();
            });
          })
      )
    );

    return {
      eventId: (opts.event as any).id ?? "",
      statuses,
    };
  }

  /** Fetch Nostr kind 0 profile for a pubkey */
  async getProfile(pubkey: string): Promise<{
    pubkey: string;
    name?: string | null;
    picture?: string | null;
    about?: string | null;
    nip05?: string | null;
    website?: string | null;
  } | null> {
    const adapter = this.getAdapter("standard") as StandardAdapter;
    return adapter.getProfile(pubkey);
  }

  close(): void {
    for (const adapter of this.#adapters.values()) {
      adapter.close();
    }
    this.#adapters.clear();
  }

  #toComment(event: NostrEvent, target: string, targetType: string, source: "standard" | "buzz"): NostrComment {
    return {
      id: event.id,
      pubkey: event.pubkey,
      content: event.content,
      target,
      targetType,
      nearAccountId: event.tags.find((t) => t[0] === "near_account")?.[1],
      parentEventId: event.tags.find((t) => t[0] === "e" && t[3] === "reply")?.[1],
      createdAt: event.created_at,
      tags: event.tags,
      source,
    };
  }
}
