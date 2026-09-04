import { nip19 } from "nostr-tools";

export type Nip19DecodeResult =
  | { type: "nsec"; data: Uint8Array }
  | { type: "npub"; data: string }
  | { type: string; data: unknown };

export function nip19Decode(encoded: string): Nip19DecodeResult {
  return nip19.decode(encoded) as Nip19DecodeResult;
}

export function npubEncode(pubkeyHex: string): string {
  return nip19.npubEncode(pubkeyHex);
}
