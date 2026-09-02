import { SimplePool } from "nostr-tools/pool";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import { COMMENT_KINDS, Kind, type NearNostrComment, type NearNostrTarget } from "./types";

const DEFAULT_RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"];

function pool() {
  return new SimplePool();
}

export function buildCommentTags(opts: {
  target: NearNostrTarget;
  nearAccountId: string;
  pubkey: string;
  clientName: string;
  parentEventId?: string;
  rootEventId?: string;
  parentPubkey?: string;
}): string[][] {
  const targetKey = `${opts.target.type}:${opts.target.id}`;
  const tags: string[][] = [
    ["t", opts.target.type],
    ["t", opts.clientName],
    ["p", opts.pubkey],
  ];
  if (opts.parentEventId) {
    tags.push(["e", opts.rootEventId ?? opts.parentEventId, "", "root"]);
    tags.push(["e", opts.parentEventId, "", "reply"]);
    if (opts.parentPubkey) {
      tags.push(["p", opts.parentPubkey]);
    }
  }
  if (opts.target.url) {
    tags.push(["r", opts.target.url]);
  }
  tags.push(["client", opts.clientName]);
  tags.push(["near_target", targetKey]);
  tags.push(["near_account", opts.nearAccountId]);
  return tags;
}

export function publishComment(opts: {
  target: NearNostrTarget;
  content: string;
  secretKey: Uint8Array;
  nearAccountId: string;
  parentEventId?: string;
  rootEventId?: string;
  parentPubkey?: string;
  clientName?: string;
  relays?: string[];
}): Promise<{ id: string; statuses: Map<string, boolean> }> {
  const relays = opts.relays ?? DEFAULT_RELAYS;
  const clientName = opts.clientName ?? "nostr.nearbuilders.org";
  const pubkey = getPublicKey(opts.secretKey);

  const tags = buildCommentTags({
    target: opts.target,
    nearAccountId: opts.nearAccountId,
    pubkey,
    clientName,
    parentEventId: opts.parentEventId,
    rootEventId: opts.rootEventId,
    parentPubkey: opts.parentPubkey,
  });

  const event = finalizeEvent(
    {
      kind: Kind.COMMENT,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: opts.content,
    },
    opts.secretKey,
  );

  const p = pool();
  const results = p.publish(relays, event as any);
  const statuses = new Map<string, boolean>();

  return Promise.allSettled(
    results.map(async (pr, i) => {
      try {
        await pr;
        statuses.set(relays[i]!, true);
      } catch {
        statuses.set(relays[i]!, false);
      }
    }),
  ).then(() => {
    p.close(relays);
    return { id: event.id, statuses };
  });
}

export async function listComments(opts: {
  target: NearNostrTarget;
  clientName?: string;
  limit?: number;
  relays?: string[];
}): Promise<NearNostrComment[]> {
  const relays = opts.relays ?? DEFAULT_RELAYS;
  const targetKey = `${opts.target.type}:${opts.target.id}`;
  const clientName = opts.clientName ?? "nostr.nearbuilders.org";

  const p = pool();
  const events = await p.querySync(relays, {
    kinds: [...COMMENT_KINDS],
    "#t": [opts.target.type, clientName],
    limit: opts.limit ?? 50,
  } as any);

  p.close(relays);

  const filtered = (
    events as unknown as {
      id: string;
      pubkey: string;
      content: string;
      created_at: number;
      tags: string[][];
    }[]
  ).filter((e) => e.tags?.some((t) => t[0] === "near_target" && t[1] === targetKey));

  return filtered.map((e) => {
    const parentId = e.tags?.find((t) => t[0] === "e" && t[3] === "reply")?.[1];
    const rootId = e.tags?.find((t) => t[0] === "e" && t[3] === "root")?.[1] ?? parentId;
    return {
      eventId: e.id,
      pubkey: e.pubkey,
      nearAccountId: e.tags?.find((t) => t[0] === "near_account")?.[1],
      content: e.content,
      createdAt: e.created_at,
      parentId,
      rootId,
      target: opts.target,
    };
  });
}

export async function getProfile(
  pubkey: string,
  relays?: string[],
): Promise<{
  name?: string;
  picture?: string;
  about?: string;
} | null> {
  const relayList = relays ?? DEFAULT_RELAYS;
  const p = pool();
  try {
    const events = await p.querySync(relayList, [
      { kinds: [0], authors: [pubkey], limit: 1 },
    ] as any);
    if (events.length === 0) return null;
    return JSON.parse((events[0] as any).content);
  } catch {
    return null;
  } finally {
    p.close(relayList);
  }
}
