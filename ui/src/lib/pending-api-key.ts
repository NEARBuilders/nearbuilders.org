const PENDING_API_KEY_STORAGE_KEY = "nearbuilders:pending-api-key";

export interface PendingApiKey {
  id: string;
  key: string;
  name: string | null;
  prefix: string | null;
  start: string | null;
  createdAt: string;
  configId: string;
}

export function savePendingApiKey(pending: PendingApiKey): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PENDING_API_KEY_STORAGE_KEY, JSON.stringify(pending));
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

export function toPendingApiKey(data: {
  id: string;
  key: string;
  name: string | null;
  prefix: string | null;
  start: string | null;
  createdAt?: string | Date | null;
  configId: string;
}): PendingApiKey {
  return {
    id: data.id,
    key: data.key,
    name: data.name ?? null,
    prefix: data.prefix ?? null,
    start: data.start ?? null,
    createdAt: new Date(data.createdAt ?? Date.now()).toISOString(),
    configId: data.configId,
  };
}
