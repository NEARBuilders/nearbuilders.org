/**
 * Nostr bindings service — KV reads, profile enrichment, challenge/verify.
 * No database. All state lives in FastNear KV + Nostr relays.
 */

export interface BindingServiceConfig {
  kvApiUrl: string;
  bindingContract: string;
  standardRelays: string[];
  challengeExpirySeconds: number;
}

export interface BindingEntry {
  npub: string;
  relay: string;
  proof: string;
  bound_at: number;
}

export interface Identity {
  nearAccountId: string;
  nostrPubkey: string;
  relay: string;
  proof: string;
  boundAt: number;
  profile?: {
    name?: string | null;
    picture?: string | null;
    about?: string | null;
    nip05?: string | null;
    website?: string | null;
  } | null;
}

export class BindingService {
  private kvApiUrl: string;
  private bindingContract: string;
  private standardRelays: string[];
  private challengeExpiry: number;

  constructor(config: BindingServiceConfig) {
    this.kvApiUrl = config.kvApiUrl;
    this.bindingContract = config.bindingContract;
    this.standardRelays = config.standardRelays;
    this.challengeExpiry = config.challengeExpirySeconds;
  }

  /**
   * Read binding from FastNear KV.
   * GET /v0/latest/{contract}/{predecessor_id}/{key}
   */
  async getBinding(nearAccountId: string): Promise<BindingEntry | null> {
    try {
      const url = `${this.kvApiUrl}/v0/latest/${this.bindingContract}/${nearAccountId}/nostr/${nearAccountId}`;
      const res = await fetch(url);
      if (!res.ok || res.status === 404) return null;

      const data = (await res.json()) as {
        entries?: Array<{ value: unknown }>;
      };
      const entry = data?.entries?.[0];
      if (!entry?.value) return null;

      const parsed =
        typeof entry.value === "string"
          ? (JSON.parse(entry.value) as BindingEntry)
          : (entry.value as BindingEntry);
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Get binding mapped to camelCase for the contract output.
   */
  async getBindingOutput(
    nearAccountId: string,
  ): Promise<{ npub: string; relay: string; proof: string; boundAt: number } | null> {
    const entry = await this.getBinding(nearAccountId);
    if (!entry) return null;
    return {
      npub: entry.npub,
      relay: entry.relay,
      proof: entry.proof,
      boundAt: entry.bound_at,
    };
  }

  /**
   * Resolve full identity: binding + optional kind-0 profile.
   */
  async getIdentity(
    nearAccountId: string,
    enrichProfile = true,
  ): Promise<Identity | null> {
    const binding = await this.getBinding(nearAccountId);
    if (!binding) return null;

    const result: Identity = {
      nearAccountId,
      nostrPubkey: binding.npub,
      relay: binding.relay,
      proof: binding.proof,
      boundAt: binding.bound_at,
    };

    if (enrichProfile) {
      result.profile = await this.getProfile(binding.npub);
    }

    return result;
  }

  /**
   * Fetch Nostr kind-0 profile from relays.
   */
  async getProfile(
    pubkey: string,
  ): Promise<Identity["profile"] | null> {
    try {
      // Use a relay that supports kind-0 lookups
      const relay = this.standardRelays[0];
      if (!relay) return null;

      const res = await fetch(relay, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          "REQ",
          "profile",
          { kinds: [0], authors: [pubkey], limit: 1 },
        ]),
      });

      if (!res.ok) return null;

      const text = await res.text();
      // Parse NDJSON lines, find EVENT
      const lines = text.split("\n").filter((l) => l.startsWith("[\"EVENT\""));
      if (lines.length === 0) return null;

      const event = JSON.parse(lines[0]!) as {
        content: string;
      };
      if (!event.content) return null;

      return JSON.parse(event.content) as Identity["profile"];
    } catch {
      return null;
    }
  }

  /**
   * Generate a binding challenge string.
   */
  createChallenge(nearAccountId: string): {
    challenge: string;
    expiresAt: number;
  } {
    const expiresAt = Math.floor(Date.now() / 1000) + this.challengeExpiry;
    return {
      challenge: `bind:${nearAccountId}:${expiresAt}:near-nostr-bindings`,
      expiresAt,
    };
  }

  /**
   * Verify a signed Nostr event against a challenge.
   */
  verifyChallenge(
    event: {
      id: string;
      pubkey: string;
      content: string;
      tags: string[][];
      created_at: number;
      sig: string;
    },
    nearAccountId: string,
  ): { valid: boolean; nostrPubkey: string; proof: string } {
    // Extract challenge from content
    const challenge = event.content;
    if (!challenge || !challenge.startsWith("bind:")) {
      throw new Error("No binding challenge found in event content");
    }

    const parts = challenge.split(":");
    if (
      parts.length !== 4 ||
      parts[0] !== "bind" ||
      parts[1] !== nearAccountId
    ) {
      throw new Error("Challenge does not match the authenticated account");
    }

    const expiresAt = parseInt(parts[2]!, 10);
    if (Math.floor(Date.now() / 1000) > expiresAt) {
      throw new Error("Challenge expired");
    }

    const proof = JSON.stringify({
      nostrPubkey: event.pubkey,
      challenge,
      eventId: event.id,
      verifiedBy: nearAccountId,
      verifiedAt: Math.floor(Date.now() / 1000),
    });

    return { valid: true, nostrPubkey: event.pubkey, proof };
  }

  /**
   * Prepare KV write args for client-side wallet transaction.
   */
  prepareBindingWrite(params: {
    nostrPubkey: string;
    relay: string;
    proof: string;
    nearAccountId: string;
  }) {
    const key = `nostr/${params.nearAccountId}`;
    const value = JSON.stringify({
      npub: params.nostrPubkey,
      relay: params.relay,
      proof: params.proof,
      bound_at: Math.floor(Date.now() / 1000),
    });

    return {
      contractId: this.bindingContract,
      methodName: "__fastdata_kv" as const,
      key,
      value,
      args: { [key]: value },
      gas: "300000000000000",
      attachedDeposit: "10000000000000000000000", // 0.01 NEAR
    };
  }
}
