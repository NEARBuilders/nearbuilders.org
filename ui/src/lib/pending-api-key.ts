import type { CreatedApiKey } from "../components/api-key-manager";

export type PendingApiKey = Pick<CreatedApiKey, "id" | "key" | "name" | "prefix" | "start"> & {
  createdAt: string;
  configId: string;
};

export type PendingApiKeyInput = Omit<CreatedApiKey, "createdAt"> & {
  createdAt?: string | Date | null;
  configId: string;
};

const PENDING_API_KEY_STORAGE_KEY = "nearbuilders:pending-api-key";

export function savePendingApiKey(pending: PendingApiKeyInput): void {
  if (typeof window === "undefined") return;
  try {
    const parsed = pending.createdAt ? new Date(pending.createdAt) : new Date();
    const createdAt = (Number.isNaN(parsed.getTime()) ? new Date() : parsed).toISOString();
    const value: PendingApiKey = { ...pending, createdAt };
    window.sessionStorage.setItem(PENDING_API_KEY_STORAGE_KEY, JSON.stringify(value));
  } catch {
    return;
  }
}

export function getPendingApiKey(configId?: string): PendingApiKey | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_API_KEY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingApiKey> | null;
    if (!parsed || typeof parsed.key !== "string" || typeof parsed.configId !== "string") {
      return null;
    }
    if (configId && parsed.configId !== configId) return null;
    return parsed as PendingApiKey;
  } catch {
    return null;
  }
}

export function clearPendingApiKey(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_API_KEY_STORAGE_KEY);
  } catch {
    return;
  }
}
