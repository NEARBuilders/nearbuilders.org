export function parseTitleFromContent(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

export function parseDescriptionFromContent(content: string): string | null {
  const withoutTitle = content.replace(/^#\s+.+$/m, "").trim();
  if (!withoutTitle) return null;
  const plain = withoutTitle
    .replace(/[#*_~`>[\]()!-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return null;
  return plain.length > 250 ? `${plain.slice(0, 250).trimEnd()}\u2026` : plain;
}
