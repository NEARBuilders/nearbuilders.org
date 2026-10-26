export const CATALOG_SUBMIT_SOURCE = "nearbuilders";
const DEFAULT_TIMEOUT_MS = 5000;
const CATALOG_SITE = "https://nearcatalog.xyz";

export type CatalogSubmitKind = "project" | "person";

export type CatalogSubmitResult = { slug: string | null; url: string | null };

export interface CatalogSubmitClient {
  upsertProject(input: {
    externalId: string;
    record: Record<string, unknown>;
  }): Promise<CatalogSubmitResult>;
  upsertPerson(input: {
    externalId: string;
    record: Record<string, unknown>;
  }): Promise<CatalogSubmitResult>;
  remove(input: { kind: CatalogSubmitKind; externalId: string }): Promise<void>;
}

export class CatalogSubmitError extends Error {
  override readonly name = "CatalogSubmitError";
}

export function catalogExternalId(kind: CatalogSubmitKind, entityId: string) {
  return `${kind}:${entityId}`;
}

export function catalogSubmitRequest(
  baseUrl: string,
  action: "upsert" | "remove",
  kind: CatalogSubmitKind,
  externalId: string,
  record?: Record<string, unknown>,
) {
  const collection = kind === "project" ? "projects" : "people";
  return {
    url: `${baseUrl.replace(/\/+$/, "")}/${collection}/${encodeURIComponent(externalId)}`,
    method: action === "upsert" ? "PUT" : "DELETE",
    body:
      action === "upsert"
        ? { source: CATALOG_SUBMIT_SOURCE, externalId, kind, record }
        : { source: CATALOG_SUBMIT_SOURCE, externalId, kind },
  } as const;
}

function readText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeUrl(value: unknown) {
  const text = readText(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function catalogPageUrl(kind: CatalogSubmitKind, slug: string | null) {
  return kind === "project" && slug ? `${CATALOG_SITE}/project/${encodeURIComponent(slug)}` : null;
}

export function createHttpCatalogSubmitClient(options: {
  baseUrl: string;
  token: string;
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
}): CatalogSubmitClient {
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const redact = (text: string) =>
    options.token ? text.split(options.token).join("[redacted]") : text;

  async function send(
    action: "upsert" | "remove",
    kind: CatalogSubmitKind,
    externalId: string,
    record?: Record<string, unknown>,
  ) {
    const request = catalogSubmitRequest(options.baseUrl, action, kind, externalId, record);
    let response: Response;
    try {
      response = await fetchImplementation(request.url, {
        method: request.method,
        headers: {
          authorization: `Bearer ${options.token}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(request.body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      const reason =
        cause instanceof Error && cause.name === "TimeoutError"
          ? `timed out after ${timeoutMs}ms`
          : cause instanceof Error
            ? cause.message
            : String(cause);
      throw new CatalogSubmitError(redact(`NEAR Catalog is unreachable: ${reason}`));
    }
    const text = await response.text().catch(() => "");
    if (action === "remove" && response.status === 404) return {};
    if (!response.ok) {
      throw new CatalogSubmitError(
        redact(`NEAR Catalog returned ${response.status}: ${text.slice(0, 300)}`.trim()),
      );
    }
    try {
      return text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  const upsert = async (
    kind: CatalogSubmitKind,
    input: { externalId: string; record: Record<string, unknown> },
  ): Promise<CatalogSubmitResult> => {
    const body = await send("upsert", kind, input.externalId, input.record);
    const slug = readText(body.slug);
    return { slug, url: safeUrl(body.url) ?? catalogPageUrl(kind, slug) };
  };

  return {
    upsertProject: (input) => upsert("project", input),
    upsertPerson: (input) => upsert("person", input),
    async remove(input) {
      await send("remove", input.kind, input.externalId);
    },
  };
}

export function createCatalogSubmitClientFromConfig(config: {
  url?: string | null;
  token?: string | null;
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
}): CatalogSubmitClient | null {
  const baseUrl = config.url?.trim();
  const token = config.token?.trim();
  if (!baseUrl || !token) return null;
  return createHttpCatalogSubmitClient({
    baseUrl,
    token,
    fetchImplementation: config.fetchImplementation,
    timeoutMs: config.timeoutMs,
  });
}
