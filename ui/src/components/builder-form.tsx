import {
  countrySuggestions,
  locationError,
  normalizeSkills,
  parseSkillList,
  skillSuggestions,
} from "@everything-dev/builders-plugin/builder-tags";
import { useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApiClient } from "@/app";
import { CityNodePicker } from "@/components/city-node-picker";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { socialIcon } from "@/components/ui/social-icons";
import { Textarea } from "@/components/ui/textarea";
import {
  type BuilderCatalogFormValues,
  builderCatalogFromFormValues,
  getBuilderCatalogErrors,
  PREFERRED_CONTACTS,
  type PreferredContact,
  validateBuilderCatalog,
} from "@/lib/builder-catalog";
import { SOCIAL_LINKS, validateHandle } from "@/lib/social-links";
import { cn } from "@/lib/utils";
import { ErrorText, fieldError, HelperText, validateOptionalMaxLength } from "./project-form";

export type BuilderFormValues = {
  name: string;
  bio: string;
  skills: string;
  location: string;
  cityNode: string;
  links: Record<string, string>;
  catalog: BuilderCatalogFormValues;
};

export function parseSkills(raw: string): string[] {
  return parseSkillList(raw);
}

export function parseBuilderSkills(raw: string, existing: readonly string[] = []): string[] {
  return normalizeSkills(parseSkillList(raw), existing);
}

export const validateSkills = (value?: string, required = false) => {
  const skills = parseBuilderSkills(value ?? "");
  if (required && skills.length === 0) return "Add at least one skill";
  if (skills.length > 20) return "Max 20 skills";
  if (skills.some((s) => s.length > 50)) return "Each skill must be 50 characters or fewer";
  return undefined;
};

export const validateLocation = (value?: string) => {
  const lengthError = validateOptionalMaxLength(value, 100, "Max 100 characters");
  if (lengthError) return lengthError;
  return locationError(value);
};

function useExistingSkillTags(): string[] {
  const apiClient = useApiClient();
  const { data } = useQuery({
    queryKey: ["builder-skill-tags"],
    queryFn: async () => {
      const result = await apiClient.listBuilders({ limit: 100 });
      return result.data.flatMap((builder) => builder.skills);
    },
    staleTime: 60_000,
  });
  return data ?? [];
}

export function BuilderFormFields({ form, required = false }: { form: any; required?: boolean }) {
  const skillsRaw = useStore(form.store, (s: any) => s.values.skills ?? "");
  const location = useStore(form.store, (s: any) => s.values.location ?? "");
  const skills = parseBuilderSkills(skillsRaw);
  const existingSkills = useExistingSkillTags();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <form.Field
          name="name"
          validators={{
            onChange: ({ value }: any) =>
              required && !value?.trim()
                ? "Display name is required"
                : validateOptionalMaxLength(value, 100, "Max 100 characters"),
            onSubmit: ({ value }: any) =>
              required && !value?.trim()
                ? "Display name is required"
                : validateOptionalMaxLength(value, 100, "Max 100 characters"),
          }}
        >
          {(field: any) => {
            const err = fieldError(field.state.meta.errors[0]);
            return (
              <div className="space-y-1.5">
                <Label htmlFor="name">
                  Display name
                  {required && <span className="text-destructive"> *</span>}
                </Label>
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
            onChange: ({ value }: any) => validateLocation(value),
            onSubmit: ({ value }: any) => validateLocation(value),
          }}
        >
          {(field: any) => {
            const err = fieldError(field.state.meta.errors[0]);
            return (
              <div className="space-y-1.5">
                <Label htmlFor="location">Location</Label>
                <SuggestionInput
                  id="location"
                  value={field.state.value ?? ""}
                  onChange={(value) => field.handleChange(value)}
                  placeholder="Country or City, Country"
                  suggestions={countrySuggestions(field.state.value ?? "")}
                  invalid={Boolean(err)}
                />
                {err && <ErrorText>{err}</ErrorText>}
              </div>
            );
          }}
        </form.Field>
      </div>

      <form.Field name="cityNode">
        {(field: any) => (
          <div className="space-y-1.5">
            <Label htmlFor="cityNode">City node</Label>
            <CityNodePicker
              id="cityNode"
              value={field.state.value ?? ""}
              onChange={(value) => field.handleChange(value)}
              location={location}
            />
          </div>
        )}
      </form.Field>

      <form.Field
        name="bio"
        validators={{
          onChange: ({ value }: any) =>
            required && !value?.trim()
              ? "Bio is required"
              : validateOptionalMaxLength(value, 1000, "Max 1000 characters"),
          onSubmit: ({ value }: any) =>
            required && !value?.trim()
              ? "Bio is required"
              : validateOptionalMaxLength(value, 1000, "Max 1000 characters"),
        }}
      >
        {(field: any) => {
          const err = fieldError(field.state.meta.errors[0]);
          return (
            <div className="space-y-1.5">
              <Label htmlFor="bio">
                Bio
                {required && <span className="text-destructive"> *</span>}
              </Label>
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
          onChange: ({ value }: any) => validateSkills(value, required),
          onSubmit: ({ value }: any) => validateSkills(value, required),
        }}
      >
        {(field: any) => {
          const err = fieldError(field.state.meta.errors[0]);
          const currentToken = (field.state.value ?? "").split(",").pop()?.trim() ?? "";
          return (
            <div className="space-y-1.5">
              <Label htmlFor="skills">
                Skills
                {required && <span className="text-destructive"> *</span>}{" "}
                <span className="font-normal text-muted-foreground">(comma-separated)</span>
              </Label>
              <SuggestionInput
                id="skills"
                value={field.state.value ?? ""}
                onChange={(value) => field.handleChange(value)}
                placeholder="React, Rust, Smart Contracts…"
                suggestions={skillSuggestions(currentToken, existingSkills)}
                onPick={(suggestion) => {
                  const parts = parseSkillList(field.state.value ?? "");
                  const next = normalizeSkills([...parts.slice(0, -1), suggestion], existingSkills);
                  field.handleChange(`${next.join(", ")}, `);
                }}
                invalid={Boolean(err)}
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
          {SOCIAL_LINKS.map(({ key, label, placeholder }) => {
            const Icon = socialIcon(key);
            return (
              <form.Field
                key={key}
                name={`links.${key}`}
                validators={{
                  onChange: ({ value }: any) => validateHandle(key, value),
                  onSubmit: ({ value }: any) => validateHandle(key, value),
                }}
              >
                {(field: any) => {
                  const err = fieldError(field.state.meta.errors[0]);
                  return (
                    <div className="space-y-1.5">
                      <div
                        className={cn(
                          // oxlint-disable-next-line shadcn/no-arbitrary-values -- shadcn/ui's standard 3px focus ring and border/shadow transition; not on Tailwind's built-in ring scale (0/1/2/4/8) or named transition utilities
                          "flex h-10 w-full items-center overflow-hidden rounded-md border bg-input text-sm transition-[border-color,box-shadow] focus-within:ring-[3px] focus-within:ring-ring/20",
                          err
                            ? "border-destructive focus-within:border-destructive"
                            : "border-border focus-within:border-ring",
                        )}
                      >
                        <span className="flex h-full items-center border-r border-border px-3 text-muted-foreground">
                          <Icon className="size-4" />
                        </span>
                        <input
                          id={`link-${key}`}
                          aria-label={label}
                          value={field.state.value ?? ""}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder={placeholder}
                          className="h-full w-full bg-transparent px-3 text-foreground outline-none placeholder:text-muted-foreground"
                        />
                      </div>
                      {err && <ErrorText>{err}</ErrorText>}
                    </div>
                  );
                }}
              </form.Field>
            );
          })}
        </div>
      </div>

      <form.Field
        name="catalog"
        validators={{
          onChange: ({ value }: any) => validateBuilderCatalog(value, form.getFieldValue("links")),
          onSubmit: ({ value }: any) => validateBuilderCatalog(value, form.getFieldValue("links")),
        }}
      >
        {(field: any) => <BuilderCatalogFields form={form} field={field} />}
      </form.Field>
    </div>
  );
}

const NO_CONTACT = "none";

function BuilderCatalogFields({ form, field }: { form: any; field: any }) {
  const links = useStore(form.store, (s: any) => s.values.links ?? {});
  const value = field.state.value as BuilderCatalogFormValues;
  const errors = getBuilderCatalogErrors(value, links);
  const showErrors = field.state.meta.isTouched || form.state.submissionAttempts > 0;
  const update = (patch: Partial<BuilderCatalogFormValues>) =>
    field.handleChange({ ...value, ...patch });
  const errorFor = (key: keyof typeof errors) => (showErrors ? errors[key] : undefined);
  const textFields = [
    { key: "organization", label: "Organization", placeholder: "Where you work or build" },
    { key: "team", label: "Team", placeholder: "Team inside the organization" },
    { key: "jobTitle", label: "Job title", placeholder: "Founder, Engineer…" },
    { key: "publicEmail", label: "Public email", placeholder: "you@example.com" },
  ] as const;

  const hasErrors = showErrors && Object.keys(errors).length > 0;
  const [open, setOpen] = useState(() => builderCatalogFromFormValues(value) !== null);
  const expanded = open || hasErrors;

  return (
    <div className="space-y-4 border-t border-border pt-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Label>Also list me on NEAR Catalog</Label>
          <HelperText>
            Optional. Your public email shows on your profile only if you add it here.
          </HelperText>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!expanded)}
          aria-expanded={expanded}
          aria-controls="builder-catalog-fields"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-foreground hover:underline"
        >
          {expanded ? "Hide" : builderCatalogFromFormValues(value) ? "Edit" : "Add details"}
          <ChevronDown
            size={14}
            className={cn("text-muted-foreground transition-transform", expanded && "rotate-180")}
          />
        </button>
      </div>

      {expanded && (
        <div id="builder-catalog-fields" className="space-y-4">
          <div className="space-y-1.5 sm:max-w-xs">
            <Label htmlFor="catalog-preferred-contact">Preferred contact</Label>
            <Select
              value={value.preferredContact || NO_CONTACT}
              onValueChange={(next) =>
                update({ preferredContact: next === NO_CONTACT ? "" : (next as PreferredContact) })
              }
            >
              <SelectTrigger id="catalog-preferred-contact" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CONTACT}>Not set</SelectItem>
                {PREFERRED_CONTACTS.map((contact) => (
                  <SelectItem key={contact.value} value={contact.value}>
                    {contact.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errorFor("preferredContact") && <ErrorText>{errorFor("preferredContact")}</ErrorText>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {textFields.map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`catalog-${key}`}>{label}</Label>
                <Input
                  id={`catalog-${key}`}
                  type={key === "publicEmail" ? "email" : "text"}
                  value={value[key]}
                  onChange={(e) => update({ [key]: e.target.value })}
                  onBlur={field.handleBlur}
                  placeholder={placeholder}
                  aria-invalid={Boolean(errorFor(key))}
                />
                {errorFor(key) && <ErrorText>{errorFor(key)}</ErrorText>}
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="catalog-avatarUrl">Avatar URL</Label>
            <Input
              id="catalog-avatarUrl"
              value={value.avatarUrl}
              onChange={(e) => update({ avatarUrl: e.target.value })}
              onBlur={field.handleBlur}
              placeholder="https://example.com/avatar.png"
              aria-invalid={Boolean(errorFor("avatarUrl"))}
            />
            {errorFor("avatarUrl") ? (
              <ErrorText>{errorFor("avatarUrl")}</ErrorText>
            ) : (
              <HelperText>Leave empty to use your NEAR Social profile image.</HelperText>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SuggestionInput({
  id,
  value,
  onChange,
  onPick,
  placeholder,
  suggestions,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onPick?: (value: string) => void;
  placeholder: string;
  suggestions: string[];
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const options = useMemo(
    () =>
      suggestions.filter(
        (suggestion) => suggestion.toLocaleLowerCase() !== value.trim().toLocaleLowerCase(),
      ),
    [suggestions, value],
  );

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        className={invalid ? "!border-destructive" : ""}
      />
      {open && options.length > 0 ? (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-popover p-1 shadow-md">
          {options.map((option) => (
            <li key={option}>
              <button
                type="button"
                className="flex w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (onPick) onPick(option);
                  else onChange(option);
                  setOpen(false);
                }}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
