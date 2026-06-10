import { useStore } from "@tanstack/react-form";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ErrorText, fieldError, HelperText, validateOptionalMaxLength } from "./project-form";

export type BuilderFormValues = {
  name: string;
  bio: string;
  skills: string;
  location: string;
  links: Record<string, string>;
};

export const SOCIAL_LINKS = [
  { key: "website", label: "Website", placeholder: "https://example.com" },
  { key: "github", label: "GitHub", placeholder: "https://github.com/username" },
  { key: "twitter", label: "X (Twitter)", placeholder: "https://x.com/username" },
  { key: "telegram", label: "Telegram", placeholder: "https://t.me/username" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/username" },
] as const;

export function parseSkills(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const validateSkills = (value?: string) => {
  const skills = parseSkills(value ?? "");
  if (skills.length > 20) return "Max 20 skills";
  if (skills.some((s) => s.length > 50)) return "Each skill must be 50 characters or fewer";
  return undefined;
};

export const validateUrl = (value?: string) => {
  const v = value?.trim();
  if (!v) return undefined;
  if (v.length > 200) return "Max 200 characters";
  try {
    const url = new URL(v);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "Must start with http:// or https://";
    }
    return undefined;
  } catch {
    return "Enter a valid URL";
  }
};

const SOCIAL_URL_FROM_HANDLE: Record<string, (handle: string) => string> = {
  github: (h) => `https://github.com/${h}`,
  twitter: (h) => `https://x.com/${h}`,
  telegram: (h) => `https://t.me/${h}`,
  linkedin: (h) => `https://linkedin.com/in/${h}`,
  website: (h) => `https://${h.replace(/^\/+/, "")}`,
};

export function socialToUrl(key: string, raw?: string): string {
  const value = raw?.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const handle = value.replace(/^@/, "");
  const build = SOCIAL_URL_FROM_HANDLE[key];
  return build ? build(handle) : value;
}

export function initialFormLinks(
  links?: Record<string, string> | null,
  social?: Record<string, unknown> | null,
): Record<string, string> {
  return Object.fromEntries(
    SOCIAL_LINKS.map(({ key }) => {
      const saved = links?.[key];
      if (saved) return [key, saved];
      const fromSocial = typeof social?.[key] === "string" ? (social[key] as string) : undefined;
      return [key, socialToUrl(key, fromSocial)];
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
    const value = formLinks[key]?.trim();
    if (value) result[key] = value;
  }
  return result;
}

export function BuilderFormFields({ form }: { form: any }) {
  const skillsRaw = useStore(form.store, (s: any) => s.values.skills ?? "");
  const skills = parseSkills(skillsRaw);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <form.Field
          name="name"
          validators={{
            onChange: ({ value }: any) =>
              validateOptionalMaxLength(value, 100, "Max 100 characters"),
            onSubmit: ({ value }: any) =>
              validateOptionalMaxLength(value, 100, "Max 100 characters"),
          }}
        >
          {(field: any) => {
            const err = fieldError(field.state.meta.errors[0]);
            return (
              <div className="space-y-1.5">
                <Label htmlFor="name">Display name</Label>
                <Input
                  id="name"
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Builder name"
                  className={err ? "!border-destructive" : ""}
                />
                {err && <ErrorText>{err}</ErrorText>}
              </div>
            );
          }}
        </form.Field>

        <form.Field
          name="location"
          validators={{
            onChange: ({ value }: any) =>
              validateOptionalMaxLength(value, 100, "Max 100 characters"),
            onSubmit: ({ value }: any) =>
              validateOptionalMaxLength(value, 100, "Max 100 characters"),
          }}
        >
          {(field: any) => {
            const err = fieldError(field.state.meta.errors[0]);
            return (
              <div className="space-y-1.5">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="City, Country or Remote"
                  className={err ? "!border-destructive" : ""}
                />
                {err && <ErrorText>{err}</ErrorText>}
              </div>
            );
          }}
        </form.Field>
      </div>

      <form.Field
        name="bio"
        validators={{
          onChange: ({ value }: any) =>
            validateOptionalMaxLength(value, 1000, "Max 1000 characters"),
          onSubmit: ({ value }: any) =>
            validateOptionalMaxLength(value, 1000, "Max 1000 characters"),
        }}
      >
        {(field: any) => {
          const err = fieldError(field.state.meta.errors[0]);
          return (
            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="What do you build? What are you working on?"
                rows={4}
                className={cn(
                  "resize-none",
                  err ? "border-destructive focus-visible:border-destructive" : "",
                )}
              />
              {err && <ErrorText>{err}</ErrorText>}
            </div>
          );
        }}
      </form.Field>

      <form.Field
        name="skills"
        validators={{
          onChange: ({ value }: any) => validateSkills(value),
          onSubmit: ({ value }: any) => validateSkills(value),
        }}
      >
        {(field: any) => {
          const err = fieldError(field.state.meta.errors[0]);
          return (
            <div className="space-y-1.5">
              <Label htmlFor="skills">
                Skills <span className="font-normal text-muted-foreground">(comma-separated)</span>
              </Label>
              <Input
                id="skills"
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="React, Rust, Smart Contracts…"
                className={err ? "!border-destructive" : ""}
              />
              {err && <ErrorText>{err}</ErrorText>}
              {skills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {skills.map((skill) => (
                    <Badge
                      key={skill}
                      variant="secondary"
                      className="rounded-full px-3 py-1 text-xs font-medium"
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              ) : (
                <HelperText>Add a few skills to help people find you.</HelperText>
              )}
            </div>
          );
        }}
      </form.Field>

      <div className="space-y-3">
        <div>
          <Label>Social links</Label>
          <HelperText>
            Prefilled from your NEAR Social profile where available — keep, edit, or clear them.
          </HelperText>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SOCIAL_LINKS.map(({ key, label, placeholder }) => (
            <form.Field
              key={key}
              name={`links.${key}`}
              validators={{
                onChange: ({ value }: any) => validateUrl(value),
                onSubmit: ({ value }: any) => validateUrl(value),
              }}
            >
              {(field: any) => {
                const err = fieldError(field.state.meta.errors[0]);
                return (
                  <div className="space-y-1.5">
                    <Label htmlFor={`link-${key}`} className="text-xs text-muted-foreground">
                      {label}
                    </Label>
                    <Input
                      id={`link-${key}`}
                      type="url"
                      value={field.state.value ?? ""}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={placeholder}
                      className={cn("font-mono text-sm", err ? "!border-destructive" : "")}
                    />
                    {err && <ErrorText>{err}</ErrorText>}
                  </div>
                );
              }}
            </form.Field>
          ))}
        </div>
      </div>
    </div>
  );
}
