import { generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { bytesToHex, hexToBytes } from "nostr-tools/utils";
import { nip19Decode } from "./nip19";

export type NostrSession = {
  mode: "local";
  pubkey: string;
  secretKeyHex: string;
};

const storageKeyFor = (nearAccountId: string): string => `nostr:session:${nearAccountId}`;

export function saveSession(nearAccountId: string, session: NostrSession): void {
  try {
    localStorage.setItem(storageKeyFor(nearAccountId), JSON.stringify(session));
  } catch {
    // storage unavailable (private mode etc.) -- session stays in-memory only
  }
}

export function loadSession(nearAccountId: string): NostrSession | null {
  try {
    const raw = localStorage.getItem(storageKeyFor(nearAccountId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NostrSession;
    if (parsed?.mode !== "local" || typeof parsed.secretKeyHex !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(nearAccountId: string): void {
  try {
    localStorage.removeItem(storageKeyFor(nearAccountId));
  } catch {
    // nothing to clear
  }
}

export function secretKeyBytes(session: NostrSession): Uint8Array {
  return hexToBytes(session.secretKeyHex);
}

/**
 * Generate a fresh Nostr keypair, persist it locally, and return the session.
 * The secret key never leaves the browser.
 */
export function generateAndStore(nearAccountId: string): NostrSession {
  const sk = generateSecretKey();
  const session: NostrSession = {
    mode: "local",
    pubkey: getPublicKey(sk),
    secretKeyHex: bytesToHex(sk),
  };
  saveSession(nearAccountId, session);
  return session;
}

/**
 * Import an nsec (bech32) secret key, persist it locally, and return the session.
 * Throws on malformed input.
 */
export function importAndStore(nearAccountId: string, nsec: string): NostrSession {
  const decoded = nip19Decode(nsec.trim());
  if (decoded.type !== "nsec") {
    throw new Error("Expected an nsec1... secret key");
  }
  const sk = decoded.data as Uint8Array;
  const session: NostrSession = {
    mode: "local",
    pubkey: getPublicKey(sk),
    secretKeyHex: bytesToHex(sk),
  };
  saveSession(nearAccountId, session);
  return session;
}
