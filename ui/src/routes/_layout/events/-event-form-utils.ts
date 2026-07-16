const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 1000;
const CONTENT_MAX_LENGTH = 50000;
const LOCATION_MAX_LENGTH = 200;
const LUMA_URL_MAX_LENGTH = 500;

type EventFormValues = {
  title: string;
  description: string;
  content: string;
  lumaUrl: string;
  location: string;
};

type NormalizedEventFormValues = {
  title: string;
  description?: string;
  content?: string;
  lumaUrl?: string;
  location?: string;
  wasTrimmed: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function trimToMax(value: string | undefined, maxLength: number) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength).trimEnd() : trimmed;
}

export function normalizeEventFormValues(values: EventFormValues): NormalizedEventFormValues {
  const title = trimToMax(values.title, TITLE_MAX_LENGTH) ?? "";
  const description = trimToMax(values.description, DESCRIPTION_MAX_LENGTH);
  const content = trimToMax(values.content, CONTENT_MAX_LENGTH);
  const lumaUrl = trimToMax(values.lumaUrl, LUMA_URL_MAX_LENGTH);
  const location = trimToMax(values.location, LOCATION_MAX_LENGTH);

  return {
    title,
    description,
    content,
    lumaUrl,
    location,
    wasTrimmed:
      title !== values.title.trim() ||
      description !== (values.description.trim() || undefined) ||
      content !== (values.content.trim() || undefined) ||
      lumaUrl !== (values.lumaUrl.trim() || undefined) ||
      location !== (values.location.trim() || undefined),
  };
}

function getIssuePath(issue: Record<string, unknown>) {
  const path = issue.path;
  if (Array.isArray(path) && path.length > 0) return path.join(".");
  if (typeof path === "string" && path) return path;
  return undefined;
}

function getIssueMessage(issue: Record<string, unknown>) {
  return typeof issue.message === "string" && issue.message ? issue.message : undefined;
}

function findValidationIssues(value: unknown): Record<string, unknown>[] {
  if (!isRecord(value)) return [];

  const validationErrors = value.validationErrors;
  if (Array.isArray(validationErrors)) return validationErrors.filter(isRecord);

  const issues = value.issues;
  if (Array.isArray(issues)) return issues.filter(isRecord);

  for (const key of ["data", "cause", "error"]) {
    const found = findValidationIssues(value[key]);
    if (found.length > 0) return found;
  }

  return [];
}

export function getEventFormErrorMessage(error: unknown, fallback: string) {
  const issues = findValidationIssues(error);
  const issue = issues[0];

  if (issue) {
    const path = getIssuePath(issue);
    const message = getIssueMessage(issue);
    if (path && message) return `${path}: ${message}`;
    if (message) return message;
  }

  if (error instanceof Error && error.message) return error.message;
  if (isRecord(error) && typeof error.message === "string" && error.message) return error.message;
  return fallback;
}
