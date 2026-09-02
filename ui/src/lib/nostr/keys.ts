import { generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { bytesToHex, hexToBytes } from "nostr-tools/utils";

const STORAGE_PREFIX = "nostr:session:";

export interface NostrSession {
  secretKeyHex: string;
  pubkey: string;
}

export function loadSession(nearAccountId: string): NostrSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + nearAccountId);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveSession(nearAccountId: string, secretKeyHex: string, pubkey: string) {
  localStorage.setItem(STORAGE_PREFIX + nearAccountId, JSON.stringify({ secretKeyHex, pubkey }));
}

export function clearSession(nearAccountId: string) {
  localStorage.removeItem(STORAGE_PREFIX + nearAccountId);
}

export function generateAndStore(nearAccountId: string): NostrSession {
  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  const hex = bytesToHex(sk);
  saveSession(nearAccountId, hex, pk);
  return { secretKeyHex: hex, pubkey: pk };
}

export function secretKeyBytes(session: NostrSession): Uint8Array {
  return hexToBytes(session.secretKeyHex);
}
