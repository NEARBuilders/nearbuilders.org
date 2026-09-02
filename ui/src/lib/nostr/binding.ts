import { finalizeEvent } from "nostr-tools/pure";
import { DEFAULT_RELAYS } from "./types";

const KV_API = "https://kv.main.fastnear.com";
const BINDING_CONTRACT = "contextual.near";

export const CLIENT_NAME = "nostr.nearbuilders.org";

export type SignedBindingEvent = {
  id: string;
  pubkey: string;
  content: string;
  tags: string[][];
  created_at: number;
  sig: string;
};

export function createBindingChallenge(
  nearAccountId: string,
  expiresInSeconds = 300,
): { challenge: string; expiresAt: number } {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return {
    challenge: `bind:${nearAccountId}:${expiresAt}:${CLIENT_NAME}`,
    expiresAt,
  };
}

export function signBindingChallenge(secretKey: Uint8Array, challenge: string): SignedBindingEvent {
  return finalizeEvent(
    {
      kind: 27235,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["challenge", challenge],
        ["client", CLIENT_NAME],
      ],
      content: challenge,
    },
    secretKey,
  ) as SignedBindingEvent;
}

export type NearNostrBinding = {
  nearAccountId: string;
  nostrPubkey: string;
  relay?: string;
  proof?: string;
  boundAt?: number;
};

export async function getBinding(nearAccountId: string): Promise<NearNostrBinding | null> {
  try {
    const res = await fetch(
      `${KV_API}/v0/latest/${BINDING_CONTRACT}/${nearAccountId}/nostr/${nearAccountId}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const entry = data?.entries?.[0];
    if (!entry?.value) return null;
    const parsed = typeof entry.value === "string" ? JSON.parse(entry.value) : entry.value;
    return {
      nearAccountId,
      nostrPubkey: parsed.npub ?? parsed.value?.npub,
      relay: parsed.relay ?? parsed.value?.relay,
      proof: parsed.proof ?? parsed.value?.proof,
      boundAt: parsed.bound_at ?? parsed.value?.bound_at,
    };
  } catch {
    return null;
  }
}

export function buildTxArgs(opts: {
  nearAccountId: string;
  nostrPubkey: string;
  proof: string;
  relay?: string;
}): { contract: string; method: string; args: Record<string, unknown> } {
  return {
    contract: BINDING_CONTRACT,
    method: "__fastdata_kv",
    args: {
      [`nostr/${opts.nearAccountId}`]: JSON.stringify({
        npub: opts.nostrPubkey,
        relay: opts.relay ?? DEFAULT_RELAYS[0],
        proof: opts.proof,
        bound_at: Math.floor(Date.now() / 1000),
      }),
    },
  };
}
