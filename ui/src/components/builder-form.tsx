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
};

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
    </div>
  );
}
