import { useCallback, useState } from "react";

const STORAGE_KEY = "nb:bookmarks";

function readBookmarks(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeBookmarks(ids: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage unavailable (private browsing, quota) — bookmark just won't persist.
  }
}

export function useBookmark(entityId: string) {
  const [isBookmarked, setIsBookmarked] = useState(() => readBookmarks().has(entityId));

  const toggle = useCallback(() => {
    const ids = readBookmarks();
    if (ids.has(entityId)) {
      ids.delete(entityId);
    } else {
      ids.add(entityId);
    }
    writeBookmarks(ids);
    setIsBookmarked(ids.has(entityId));
  }, [entityId]);

  return { isBookmarked, toggle };
}
