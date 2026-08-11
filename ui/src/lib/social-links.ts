export const SOCIAL_LINKS = [
  { key: "website", label: "Website", base: "https://", placeholder: "example.com" },
  { key: "github", label: "GitHub", base: "https://github.com/", placeholder: "username" },
  { key: "twitter", label: "X", base: "https://x.com/", placeholder: "username" },
  { key: "telegram", label: "Telegram", base: "https://t.me/", placeholder: "username" },
  { key: "linkedin", label: "LinkedIn", base: "https://linkedin.com/in/", placeholder: "username" },
  {
    key: "discord",
    label: "Discord",
    base: "https://discord.com/users/",
    placeholder: "123456789012345678",
  },
] as const;

function linkConfig(key: string) {
  return SOCIAL_LINKS.find((l) => l.key === key);
}

export function linkLabel(key: string): string {
  return linkConfig(key)?.label ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export const validateHandle = (key: string, value?: string) => {
  const v = value?.trim();
  if (!v) return undefined;
  if (v.length > 100) return "Too long";
  if (/\s/.test(v)) return "No spaces allowed";
  if (key === "discord" && !/^\d{17,20}$/.test(v)) return "Must be a numeric Discord user ID";
  return undefined;
};

export function handleToUrl(key: string, raw?: string): string {
  const value = raw?.trim().replace(/^@/, "").replace(/^\/+/, "");
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `${linkConfig(key)?.base ?? "https://"}${value}`;
}

export function urlToHandle(key: string, raw?: string): string {
  const value = raw?.trim();
  if (!value) return "";
  const host = (linkConfig(key)?.base ?? "https://").replace(/^https?:\/\//i, "");
  const stripped = value.replace(/^https?:\/\//i, "");
  if (host && stripped.toLowerCase().startsWith(host.toLowerCase())) {
    return stripped.slice(host.length).replace(/^@/, "");
  }
  return stripped.replace(/^@/, "");
}

export function socialLinkToUrl(key: string, raw?: string): string {
  const value = raw?.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return handleToUrl(key, urlToHandle(key, value));
}

export function mergeSocialLinks(
  ...sources: Array<Record<string, unknown> | null | undefined>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const source of sources) {
    for (const [key, value] of Object.entries(source ?? {})) {
      if (typeof value !== "string") continue;
      const url = socialLinkToUrl(key, value);
      if (url) result[key] = url;
    }
  }
  return result;
}

export function initialFormLinks(
  links?: Record<string, string> | null,
  social?: Record<string, unknown> | null,
): Record<string, string> {
  return Object.fromEntries(
    SOCIAL_LINKS.map(({ key }) => {
      const saved = links?.[key];
      if (saved) return [key, urlToHandle(key, saved)];
      const fromSocial = typeof social?.[key] === "string" ? (social[key] as string) : undefined;
      return [key, urlToHandle(key, fromSocial)];
    }),
  );
}

export function composeLinks(
  formLinks: Record<string, string>,
  original?: Record<string, string> | null,
): Record<string, string> {
  const known = new Set<string>(SOCIAL_LINKS.map((l) => l.key));
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(original ?? {})) {
    if (!known.has(k) && v) result[k] = v;
  }
  for (const { key } of SOCIAL_LINKS) {
    const url = handleToUrl(key, formLinks[key]);
    if (url) result[key] = url;
  }
  return result;
}
