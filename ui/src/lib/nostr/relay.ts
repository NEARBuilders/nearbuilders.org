import { type EventTemplate, finalizeEvent, type VerifiedEvent } from "nostr-tools/pure";
import type { NearNostrTarget } from "./types";

const CLIENT_NAME = "nearbuilders.org";

const nearTargetKey = (targetType: string, target: string): string => `${targetType}:${target}`;

export type Signer = { mode: "local"; secretKey: Uint8Array } | { mode: "extension" };

export type SignCommentEventOptions = {
  content: string;
  target: NearNostrTarget;
  nearAccountId: string;
  signer: Signer;
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
 * `signer` selects local-key signing (secret stays in the browser) or a
 * NIP-07 extension. The plugin verifies the signature, re-asserts the
 * near_target tag, and publishes via nostr-tools SimplePool.
 */
export async function signCommentEvent(opts: SignCommentEventOptions): Promise<VerifiedEvent> {
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

  const template: EventTemplate = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: opts.content,
  };

  if (opts.signer.mode === "local") {
    return finalizeEvent(template, opts.signer.secretKey);
  }
  if (window.nostr) {
    return window.nostr.signEvent(template) as Promise<VerifiedEvent>;
  }
  throw new Error("Extension signer requested but no Nostr extension is available");
}

export { CLIENT_NAME };
