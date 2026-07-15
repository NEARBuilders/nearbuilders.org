import { Effect } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { type CatalogProjectSchema, CatalogProjectSlugSchema } from "../contract";
import { catalogProjectReference } from "../project-reference";

type CatalogProject = z.infer<typeof CatalogProjectSchema>;

const RawTagsSchema = z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]);

const RawProjectSchema = z.object({
  slug: CatalogProjectSlugSchema,
  profile: z.object({
    name: z.string().trim().min(1),
    tagline: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    image: z.object({ url: z.string().nullable().optional() }).nullable().optional(),
    linktree: z.record(z.string(), z.unknown()).nullable().optional(),
    tags: RawTagsSchema.nullable().optional(),
    phase: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
  }),
});

const SearchResponseSchema = z.union([
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()).max(0),
]);

function textOrNull(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function projectStatus(
  status: string | null | undefined,
  phase: string | null | undefined,
): string | null {
  const normalizedStatus = textOrNull(status);
  if (normalizedStatus) return normalizedStatus;
  return phase?.trim().toLowerCase() === "mainnet" ? "active" : null;
}

function urlOrNull(value: unknown, hostname?: string): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (hostname && parsed.hostname.replace(/^www\./, "") !== hostname) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeProject(raw: z.infer<typeof RawProjectSchema>): CatalogProject {
  const rawTags = Array.isArray(raw.profile.tags)
    ? raw.profile.tags
    : Object.values(raw.profile.tags ?? {});
  const tags = rawTags.filter(
    (tag): tag is string => typeof tag === "string" && Boolean(tag.trim()),
  );
  const repositoryUrl = urlOrNull(raw.profile.linktree?.github, "github.com");
  const phase = textOrNull(raw.profile.phase);
  const status = projectStatus(raw.profile.status, raw.profile.phase);

  return {
    slug: raw.slug,
    projectRef: catalogProjectReference(raw.slug),
    name: raw.profile.name.trim(),
    tagline: textOrNull(raw.profile.tagline),
    description: textOrNull(raw.profile.description),
    imageUrl: urlOrNull(raw.profile.image?.url),
    repositoryUrl,
    catalogUrl: `https://nearcatalog.xyz/project/${raw.slug}`,
    tags: Array.from(new Set(tags.map((tag) => tag.trim()))),
    phase,
    status,
  };
}

function upstreamError(error: unknown, timeoutMs: number, host: string) {
  if (error instanceof ORPCError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError" || /timeout/i.test(message)) {
    return new ORPCError("TIMEOUT", {
      message: "NEAR Catalog request timed out",
      data: { timeoutMs, operation: "nearcatalog", retryable: true },
    });
  }
  return new ORPCError("CONNECTION_ERROR", {
    message: "Could not connect to NEAR Catalog",
    data: { host, suggestion: "Try again later" },
  });
}

export function createCatalogMethods(
  baseUrl: string,
  fetchImpl: (input: URL, init?: RequestInit) => Promise<Response> = fetch,
  timeoutMs = 8000,
) {
  const host = new URL(baseUrl).host;
  const fetchProjectData = <T extends z.ZodType>(
    path: string,
    schema: T,
    options?: { falseIsNotFound?: boolean },
  ) =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetchImpl(new URL(path, baseUrl), {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (response.status === 404) {
          throw new ORPCError("NOT_FOUND", {
            message: "NEAR Catalog project not found",
            data: { resource: "nearcatalog-project" },
          });
        }
        if (response.status === 429) {
          const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "60", 10);
          throw new ORPCError("RATE_LIMITED", {
            message: "NEAR Catalog rate limit reached",
            data: { retryAfter: Number.isFinite(retryAfter) ? Math.max(retryAfter, 1) : 60 },
          });
        }
        if (!response.ok) {
          throw new ORPCError("SERVICE_UNAVAILABLE", {
            message: "NEAR Catalog is unavailable",
            data: { maintenanceWindow: false },
          });
        }

        let body: unknown;
        try {
          body = await response.json();
        } catch {
          throw new ORPCError("SERVICE_UNAVAILABLE", {
            message: "NEAR Catalog returned an invalid response",
            data: { maintenanceWindow: false },
          });
        }
        if (options?.falseIsNotFound && body === false) {
          throw new ORPCError("NOT_FOUND", {
            message: "NEAR Catalog project not found",
            data: { resource: "nearcatalog-project" },
          });
        }
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          throw new ORPCError("SERVICE_UNAVAILABLE", {
            message: "NEAR Catalog returned an invalid response",
            data: { maintenanceWindow: false },
          });
        }
        return parsed.data as z.infer<T>;
      },
      catch: (error) => upstreamError(error, timeoutMs, host),
    });

  return {
    searchProjects: (query: string) =>
      Effect.gen(function* () {
        const params = new URLSearchParams({ kw: query.trim() });
        const result = yield* fetchProjectData(`/search?${params}`, SearchResponseSchema);
        if (Array.isArray(result)) return [];
        return Object.values(result)
          .flatMap((project) => {
            const parsed = RawProjectSchema.safeParse(project);
            return parsed.success ? [parsed.data] : [];
          })
          .map(normalizeProject);
      }),

    getProject: (slug: string) =>
      Effect.gen(function* () {
        const params = new URLSearchParams({ pid: slug });
        const result = yield* fetchProjectData(`/project?${params}`, RawProjectSchema, {
          falseIsNotFound: true,
        });
        return normalizeProject(result);
      }),
  };
}
