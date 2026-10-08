export function isSafeImageUrl(value: string | null | undefined): value is string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
