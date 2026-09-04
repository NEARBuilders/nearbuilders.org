export type NearNostrTargetType = string;

export type NearNostrTarget = {
  type: NearNostrTargetType;
  id: string;
};

export const parseTargetString = (
  raw: string,
  fallbackType: NearNostrTargetType = "project",
): NearNostrTarget | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const idx = trimmed.indexOf(":");
  if (idx === -1) return { type: fallbackType, id: trimmed };
  const type = trimmed.slice(0, idx);
  const id = trimmed.slice(idx + 1);
  if (!type || !id) return null;
  return { type: type as NearNostrTargetType, id };
};

export const formatTargetString = (target: NearNostrTarget): string =>
  `${target.type}:${target.id}`;
