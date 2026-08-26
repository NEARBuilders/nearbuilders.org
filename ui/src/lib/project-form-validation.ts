export type ProjectFormValues = {
  kind: "project" | "idea" | "scope" | "result";
  title: string;
  description?: string;
  repository?: string;
  content?: string;
  visibility: "private" | "unlisted" | "public";
  status?: "active" | "paused" | "archived";
  ownerId?: string;
  domain?: string;
};

export const validateTitle = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "Title is required";
  if (trimmed.length > 200) return "Max 200 characters";
  return undefined;
};

export const validateDescription = (value?: string) => {
  if ((value ?? "").length > 1000) return "Max 1000 characters";
  return undefined;
};

export const validateRepository = (value: string | undefined, kind: ProjectFormValues["kind"]) => {
  const trimmed = value?.trim() ?? "";
  if (kind === "project" && !trimmed) return "Repository URL is required for projects";
  if (!trimmed) return undefined;
  if (trimmed.length > 500) return "Max 500 characters";
  try {
    new URL(trimmed);
    return undefined;
  } catch {
    return "Must be a valid URL";
  }
};

export const validateContent = (value: string | undefined, kind: ProjectFormValues["kind"]) => {
  const trimmed = value?.trim() ?? "";
  if ((kind === "idea" || kind === "scope" || kind === "result") && !trimmed)
    return `Markdown content is required for ${kind}s`;
  if ((value ?? "").length > 50000) return "Max 50,000 characters";
  return undefined;
};

export const validateOptionalMaxLength = (
  value: string | undefined,
  max: number,
  message: string,
) => {
  if ((value ?? "").length > max) return message;
  return undefined;
};

export type ProjectFormValidation = {
  errors: Partial<Record<keyof ProjectFormValues, string>>;
  missingCount: number;
  invalidFieldCount: number;
  isValid: boolean;
};

export function getProjectFormValidation(
  values: Partial<ProjectFormValues>,
): ProjectFormValidation {
  const kind = values.kind ?? "idea";
  const errors: Partial<Record<keyof ProjectFormValues, string>> = {};
  const setError = (field: keyof ProjectFormValues, error?: string) => {
    if (error) errors[field] = error;
  };

  setError("title", validateTitle(values.title ?? ""));
  setError("description", validateDescription(values.description));
  setError(
    kind === "project" ? "repository" : "content",
    kind === "project"
      ? validateRepository(values.repository, kind)
      : validateContent(values.content, kind),
  );
  setError("domain", validateOptionalMaxLength(values.domain, 255, "Max 255 characters"));
  setError("ownerId", validateOptionalMaxLength(values.ownerId, 255, "Max 255 characters"));

  const missingCount = [
    !values.title?.trim(),
    kind === "project" ? !values.repository?.trim() : !values.content?.trim(),
  ].filter(Boolean).length;
  const invalidFieldCount = Object.keys(errors).length;

  return {
    errors,
    missingCount,
    invalidFieldCount,
    isValid: invalidFieldCount === 0,
  };
}
