import { CATALOG_CATEGORIES_FALLBACK } from "../catalog-categories";

export const CATALOG_PARTNER_SUBMIT_URL =
  "https://indexer.nearcatalog.xyz/wp-json/nearcatalog/v1/partner-submit";
const DEFAULT_TIMEOUT_MS = 5000;
const CATALOG_SITE = "https://nearcatalog.xyz";
const PROJECT_PHASES = ["Mainnet", "Testnet", "Prototype", "Still Building", "Inactive"];

export type CatalogSubmitKind = "project" | "person";

export type CatalogSubmitResult = { submissionId: string | null; fallbackContact: boolean };

export interface CatalogSubmitClient {
  upsertProject(input: {
    externalId: string;
    record: Record<string, unknown>;
  }): Promise<CatalogSubmitResult>;
}

export class CatalogSubmitError extends Error {
  override readonly name = "CatalogSubmitError";
}

export function catalogExternalId(kind: CatalogSubmitKind, entityId: string) {
  return `${kind}:${entityId}`;
}

export function catalogPageUrl(kind: CatalogSubmitKind, slug: string | null) {
  return kind === "project" && slug ? `${CATALOG_SITE}/project/${encodeURIComponent(slug)}` : null;
}

function readText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function categoryLabel(id: string) {
  return CATALOG_CATEGORIES_FALLBACK.find((category) => category.id === id)?.label ?? id;
}

function nearSocialAccount(value: unknown) {
  const text = readText(value);
  if (!text) return "";
  const last = text.replace(/\/+$/, "").split("/").pop() ?? "";
  return /^[a-z0-9._-]+\.(near|testnet|tg)$/.test(last) ? last : "";
}

export function catalogPartnerPayload(input: {
  externalId: string;
  record: Record<string, unknown>;
  contactInfo: string;
}) {
  const { record } = input;
  const categories = Array.isArray(record.categories)
    ? record.categories.map((id) => categoryLabel(String(id)))
    : [];
  const phase = readText(record.phase);
  const fields: Record<string, string> = {
    project_name: readText(record.title),
    project_description: readText(record.description),
    project_logo: readText(record.logo),
    contact_info: input.contactInfo,
    one_liner: readText(record.oneliner),
    primary_category: categories.join(", "),
    uid: input.externalId,
    nearsocial_address: nearSocialAccount(record["nearsocial-address"]),
    website: readText(record.website),
    dapp_url: readText(record.dapp),
    project_twitter: readText(record.twitter),
    project_telegram: readText(record.telegram),
    project_discord: readText(record.discord),
    blog_medium: readText(record.medium),
    github: readText(record.github),
    whitepaper_url: readText(record.whitepaper),
    project_phase: PROJECT_PHASES.includes(phase) ? phase : "",
    token_address_near: readText(record["token-address"]),
    token_coingeckoid: readText(record["coingecko-address"]),
  };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== ""));
}

function replyMessage(text: string) {
  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    if (typeof body.message === "string") return body.message;
  } catch {}
  return text;
}

export function createHttpCatalogSubmitClient(options: {
  url?: string;
  token: string;
  contactInfo?: string;
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
}): CatalogSubmitClient {
  const url = options.url || CATALOG_PARTNER_SUBMIT_URL;
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const redact = (text: string) =>
    options.token ? text.split(options.token).join("[redacted]") : text;

  return {
    async upsertProject(input) {
      const teamContact = readText(input.record.contact) || readText(input.record.telegram);
      const contactInfo = teamContact || options.contactInfo;
      if (!contactInfo) {
        throw new CatalogSubmitError(
          "No contact for NEAR Catalog: the project team has no public contact and NEARCATALOG_CONTACT is not set",
        );
      }
      let response: Response;
      try {
        response = await fetchImplementation(url, {
          method: "POST",
          headers: {
            authorization: `Bearer ${options.token}`,
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify(
            catalogPartnerPayload({
              externalId: input.externalId,
              record: input.record,
              contactInfo,
            }),
          ),
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
      let body: Record<string, unknown> = {};
      try {
        body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      } catch {}
      if (response.status !== 200 || body.status !== "success") {
        throw new CatalogSubmitError(
          redact(
            `NEAR Catalog returned ${response.status}: ${replyMessage(text).slice(0, 300)}`.trim(),
          ),
        );
      }
      return { submissionId: readText(body.submission_id) || null, fallbackContact: !teamContact };
    },
  };
}

export function createCatalogSubmitClientFromConfig(config: {
  url?: string | null;
  token?: string | null;
  contactInfo?: string | null;
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
}): CatalogSubmitClient | null {
  const token = config.token?.trim();
  if (!token) return null;
  return createHttpCatalogSubmitClient({
    url: config.url?.trim() || undefined,
    token,
    contactInfo: config.contactInfo?.trim() || undefined,
    fetchImplementation: config.fetchImplementation,
    timeoutMs: config.timeoutMs,
  });
}
