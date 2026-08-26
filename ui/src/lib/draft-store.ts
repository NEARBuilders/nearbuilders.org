import { Store } from "@tanstack/store";

export type ProjectKind = "project" | "idea" | "scope" | "result";

export type ProjectDraft = {
  kind: ProjectKind;
  title: string;
  description?: string;
  repository?: string;
  content?: string;
  visibility: "private" | "unlisted" | "public";
  status?: "active" | "paused" | "archived";
  ownerId?: string;
  domain?: string;
};

type DraftState = Record<ProjectKind, ProjectDraft | null>;
export type DraftPersistenceStatus = "saving" | "saved" | "error";
type DraftPersistenceListener = (status: DraftPersistenceStatus) => void;

const STORAGE_PREFIX = "projects:new:";
const KINDS: ProjectKind[] = ["project", "idea", "scope", "result"];

function storageKey(kind: ProjectKind): string {
  return `${STORAGE_PREFIX}${kind}`;
}

function loadInitialState(): DraftState {
  const state: DraftState = { project: null, idea: null, scope: null, result: null };
  for (const kind of KINDS) {
    try {
      const raw = localStorage.getItem(storageKey(kind));
      if (raw) state[kind] = JSON.parse(raw) as ProjectDraft;
    } catch {}
  }
  return state;
}

export const draftStore = new Store<DraftState>(loadInitialState());

const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const persistenceListeners = new Map<ProjectKind, Set<DraftPersistenceListener>>();

function emitPersistenceStatus(kind: ProjectKind, status: DraftPersistenceStatus) {
  for (const listener of persistenceListeners.get(kind) ?? []) listener(status);
}

function syncKindToLocalStorage(kind: ProjectKind, draft: ProjectDraft | null) {
  if (debounceTimers[kind]) clearTimeout(debounceTimers[kind]);
  emitPersistenceStatus(kind, "saving");
  debounceTimers[kind] = setTimeout(() => {
    try {
      if (draft) {
        localStorage.setItem(storageKey(kind), JSON.stringify(draft));
      } else {
        localStorage.removeItem(storageKey(kind));
      }
      emitPersistenceStatus(kind, "saved");
    } catch {
      emitPersistenceStatus(kind, "error");
    }
  }, 300);
}

export function getDraft(kind: ProjectKind): ProjectDraft | null {
  return draftStore.state[kind] ?? null;
}

export function setDraft(kind: ProjectKind, values: ProjectDraft | null) {
  draftStore.setState((prev) => ({ ...prev, [kind]: values }));
  syncKindToLocalStorage(kind, values);
}

export function clearDraft(kind: ProjectKind) {
  setDraft(kind, null);
}

export function subscribeToDraftPersistence(kind: ProjectKind, listener: DraftPersistenceListener) {
  const listeners = persistenceListeners.get(kind) ?? new Set<DraftPersistenceListener>();
  listeners.add(listener);
  persistenceListeners.set(kind, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) persistenceListeners.delete(kind);
  };
}
