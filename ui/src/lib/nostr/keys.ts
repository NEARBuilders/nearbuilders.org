import { generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { bytesToHex, hexToBytes } from "nostr-tools/utils";
import { nip19Decode } from "./nip19";

export type NostrSession = {
  mode: "local" | "extension";
  secretKeyHex?: string;
  pubkey: string;
};

const STORAGE_PREFIX = "nostr:session:";

export function loadSession(nearAccountId: string): NostrSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + nearAccountId);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveSession(nearAccountId: string, session: NostrSession) {
  localStorage.setItem(STORAGE_PREFIX + nearAccountId, JSON.stringify(session));
}

export function clearSession(nearAccountId: string) {
  localStorage.removeItem(STORAGE_PREFIX + nearAccountId);
}

export function generateAndStore(nearAccountId: string): NostrSession {
  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  const session: NostrSession = { mode: "local", secretKeyHex: bytesToHex(sk), pubkey: pk };
  saveSession(nearAccountId, session);
  return session;
}

export function importAndStore(nearAccountId: string, nsec: string): NostrSession {
  const decoded = nip19Decode(nsec.trim());
  if (!decoded || decoded.type !== "nsec") {
    throw new Error("Not a valid nsec key");
  }
  const sk = decoded.data as Uint8Array;
  const pk = getPublicKey(sk);
  const session: NostrSession = { mode: "local", secretKeyHex: bytesToHex(sk), pubkey: pk };
  saveSession(nearAccountId, session);
  return session;
}

export async function connectExtensionAndStore(nearAccountId: string): Promise<NostrSession> {
  if (!window.nostr) {
    throw new Error("No Nostr extension found");
  }
  const pk = await window.nostr.getPublicKey();
  const session: NostrSession = { mode: "extension", pubkey: pk };
  saveSession(nearAccountId, session);
  return session;
}

export function secretKeyBytes(session: NostrSession): Uint8Array {
  if (session.mode !== "local" || !session.secretKeyHex) {
    throw new Error("Session has no local secret key");
  }
  return hexToBytes(session.secretKeyHex);
}
