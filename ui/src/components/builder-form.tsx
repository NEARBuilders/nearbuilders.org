import {
  countrySuggestions,
  locationError,
  normalizeSkills,
  parseSkillList,
  skillSuggestions,
} from "@everything-dev/builders-plugin/builder-tags";
import { useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApiClient } from "@/app";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { socialIcon } from "@/components/ui/social-icons";
import { Textarea } from "@/components/ui/textarea";
import { SOCIAL_LINKS, validateHandle } from "@/lib/social-links";
import { cn } from "@/lib/utils";
import { ErrorText, fieldError, HelperText, validateOptionalMaxLength } from "./project-form";

export type BuilderFormValues = {
  name: string;
  bio: string;
  skills: string;
  location: string;
  links: Record<string, string>;
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
