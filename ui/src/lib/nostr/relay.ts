import { finalizeEvent } from "nostr-tools/pure";
import type { NearNostrTarget } from "./types";

type SignedNostrEvent = ReturnType<typeof finalizeEvent>;

const CLIENT_NAME = "nearbuilders.org";

const nearTargetKey = (targetType: string, target: string): string => `${targetType}:${target}`;

export type SignCommentEventOptions = {
  content: string;
  target: NearNostrTarget;
  nearAccountId: string;
  secretKey: Uint8Array;
  parentEventId?: string;
};

/**
 * Build & sign a kind-1 comment event whose tags match what the remote
 * nostr plugin's `createComment` validator expects:
 *
 *   - `near_target` = `<targetType>:<id>`  (composite, validated server-side)
 *   - `near_account` = `<NEAR account>`     (so requireBound/requireVerified work)
 *   - `t` × 2 -- targetType + clientName -- keeps relay-side filtering (#t) useful
 *   - `client` = clientName (NIP-24)
 *   - `e` reply marker -- NIP-10 parent link when present
 *
 * Signing locally keeps the user's secret key in the browser. The plugin
 * then verifies the signature, re-asserts the near_target tag, and
 * publishes via the nostr-tools SimplePool.
 */
export function signCommentEvent(opts: SignCommentEventOptions): SignedNostrEvent {
  const tags: string[][] = [
    ["t", opts.target.type],
    ["t", CLIENT_NAME],
    ["client", CLIENT_NAME],
    ["near_target", nearTargetKey(opts.target.type, opts.target.id)],
    ["near_account", opts.nearAccountId],
  ];
  if (opts.parentEventId) {
    tags.push(["e", opts.parentEventId, "", "reply"]);
  }

  return finalizeEvent(
    {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: opts.content,
    },
    opts.secretKey,
  );
}

export { CLIENT_NAME };
