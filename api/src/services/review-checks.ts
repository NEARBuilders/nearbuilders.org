import { readString, readStringArray } from "../lib/utils";

export type CheckStatus = "pass" | "warn" | "fail" | "skip";

export type EvaluationCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string | null;
};

export type ReviewSubject = {
  pluginId: string;
  entityId: string;
  createdBy: string;
  payload: unknown;
  source?: string | null;
};

export type CheckDependencies = {
  now: number;
  fetch: typeof fetch;
  lookupHost: (hostname: string) => Promise<string[]>;
  githubToken?: string;
  nearRpcUrl: (accountId: string) => string;
  findDuplicateProject: (input: {
    entityId: string;
    title: string | null;
    slug: string | null;
    repository: string | null;
  }) => Promise<string | null>;
  hasBuilderProfile: (nearAccount: string) => Promise<boolean | null>;
  findBuilderWithSameName: (input: { nearAccount: string; name: string }) => Promise<string | null>;
  findDuplicateEvent: (input: {
    entityId: string;
    title: string;
    startAt: number;
  }) => Promise<string | null>;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;
const MIN_TEXT_LENGTH = 40;
const STALE_REPO_DAYS = 180;
const NEW_REPO_DAYS = 30;

const SOURCE_LABELS: Record<string, string> = {
  web: "Submitted on the website",
  telegram: "Nominated via Telegram",
  x: "Nominated via X",
  "nearcatalog-claim": "NEAR Catalog claim",
};

export function describeSource(source: string | null | undefined): string | null {
  if (!source) return null;
  return SOURCE_LABELS[source] ?? `Source: ${source}`;
}

function readPayload(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

function check(
  id: string,
  label: string,
  status: CheckStatus,
  detail: string | null = null,
): EvaluationCheck {
  return { id, label: label.slice(0, 200), status, detail: detail?.slice(0, 500) ?? null };
}

function textLengthCheck(id: string, label: string, value: string | undefined): EvaluationCheck {
  const length = value?.trim().length ?? 0;
  if (length === 0) return check(id, label, "warn", "Missing");
  if (length < MIN_TEXT_LENGTH) return check(id, label, "warn", `Only ${length} characters`);
  return check(id, label, "pass", `${length} characters`);
}

export function parseGithubRepository(value: string): { owner: string; repo: string } | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return null;
  const [owner, repo] = url.pathname.split("/").filter(Boolean);
  if (!owner || !repo) return null;
  const name = repo.replace(/\.git$/, "");
  if (!/^[A-Za-z0-9-]+$/.test(owner) || !/^[A-Za-z0-9._-]+$/.test(name)) return null;
  return { owner, repo: name };
}

export function parseDomain(value: string): string | null {
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const { hostname } = new URL(candidate);
    return hostname.includes(".") ? hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function isPrivateAddress(address: string): boolean {
  if (address === "::1" || address === "::") return true;
  const lower = address.toLowerCase();
  if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80")) return true;
  const mapped = lower.startsWith("::ffff:") ? lower.slice(7) : lower;
  const parts = mapped.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = parts as [number, number, number, number];
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

async function githubRepositoryCheck(
  repository: string | undefined,
  deps: CheckDependencies,
): Promise<EvaluationCheck> {
  const label = "GitHub repository";
  if (!repository) return check("repository", label, "warn", "No repository linked");
  const parsed = parseGithubRepository(repository);
  if (!parsed) return check("repository", label, "skip", "Not a GitHub repository link");
  try {
    const response = await deps.fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
      {
        headers: {
          accept: "application/vnd.github+json",
          "user-agent": "nearbuilders-review-evaluator",
          ...(deps.githubToken ? { authorization: `Bearer ${deps.githubToken}` } : {}),
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (response.status === 404) {
      return check("repository", label, "fail", "Repository not found or private");
    }
    if (!response.ok) {
      return check("repository", label, "skip", `GitHub returned HTTP ${response.status}`);
    }
    const body = (await response.json()) as {
      archived?: boolean;
      pushed_at?: string;
      created_at?: string;
    };
    if (body.archived) return check("repository", label, "warn", "Repository is archived");
    const createdAt = body.created_at ? Date.parse(body.created_at) : Number.NaN;
    if (!Number.isNaN(createdAt)) {
      const ageDays = Math.floor((deps.now - createdAt) / DAY_MS);
      if (ageDays < NEW_REPO_DAYS) {
        return check(
          "repository",
          label,
          "warn",
          `Repository created ${ageDays === 1 ? "1 day" : `${Math.max(ageDays, 0)} days`} ago`,
        );
      }
    }
    const pushedAt = body.pushed_at ? Date.parse(body.pushed_at) : Number.NaN;
    if (Number.isNaN(pushedAt)) return check("repository", label, "pass", "Repository exists");
    const days = Math.floor((deps.now - pushedAt) / DAY_MS);
    const ago = (count: number) => (count === 1 ? "1 day ago" : `${count} days ago`);
    if (days > STALE_REPO_DAYS) {
      return check("repository", label, "warn", `Last push ${ago(days)}`);
    }
    return check("repository", label, "pass", `Last push ${ago(Math.max(days, 0))}`);
  } catch {
    return check("repository", label, "skip", "GitHub lookup failed");
  }
}

async function domainCheck(
  domain: string | undefined,
  deps: CheckDependencies,
): Promise<EvaluationCheck> {
  const label = "Domain resolves";
  if (!domain) return check("domain", label, "skip", "No domain listed");
  const hostname = parseDomain(domain);
  if (!hostname) return check("domain", label, "fail", "Not a valid domain");
  try {
    const addresses = await deps.lookupHost(hostname);
    if (addresses.length === 0)
      return check("domain", label, "fail", `${hostname} does not resolve`);
    if (addresses.every(isPrivateAddress)) {
      return check("domain", label, "warn", `${hostname} resolves to a private address`);
    }
    return check("domain", label, "pass", hostname);
  } catch {
    return check("domain", label, "fail", `${hostname} does not resolve`);
  }
}

async function nearAccountCheck(
  accountId: string,
  deps: CheckDependencies,
): Promise<EvaluationCheck> {
  const label = "NEAR account exists";
  try {
    const response = await deps.fetch(deps.nearRpcUrl(accountId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "review-evaluator",
        method: "query",
        params: { request_type: "view_account", finality: "final", account_id: accountId },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok)
      return check("near_account", label, "skip", `RPC returned HTTP ${response.status}`);
    const body = (await response.json()) as {
      result?: unknown;
      error?: { cause?: { name?: string } };
    };
    if (body.result) return check("near_account", label, "pass", accountId);
    if (body.error?.cause?.name === "UNKNOWN_ACCOUNT") {
      return check("near_account", label, "fail", `${accountId} does not exist on-chain`);
    }
    return check("near_account", label, "skip", "RPC lookup inconclusive");
  } catch {
    return check("near_account", label, "skip", "RPC lookup failed");
  }
}

async function builderProfileCheck(
  id: string,
  label: string,
  account: string,
  deps: CheckDependencies,
): Promise<EvaluationCheck> {
  try {
    const exists = await deps.hasBuilderProfile(account);
    if (exists === null) return check(id, label, "skip", "Lookup unavailable");
    return exists
      ? check(id, label, "pass", account)
      : check(id, label, "warn", `${account} has no approved builder profile`);
  } catch {
    return check(id, label, "skip", "Lookup failed");
  }
}

async function sameNameCheck(
  nearAccount: string,
  name: string | undefined,
  deps: CheckDependencies,
): Promise<EvaluationCheck> {
  const label = "Unique display name";
  if (!name) return check("same_name", label, "skip", "No name");
  try {
    const match = await deps.findBuilderWithSameName({ nearAccount, name });
    return match
      ? check("same_name", label, "warn", `Same name as existing builder ${match}`)
      : check("same_name", label, "pass");
  } catch {
    return check("same_name", label, "skip", "Lookup failed");
  }
}

async function builderChecks(subject: ReviewSubject, deps: CheckDependencies) {
  const payload = readPayload(subject.payload);
  const name = readString(payload.name);
  const skills = readStringArray(payload.skills) ?? [];
  const links = readPayload(payload.links);
  const linkCount = Object.values(links).filter((value) => readString(value)).length;
  return [
    name
      ? check("name", "Display name", "pass", name.slice(0, 80))
      : check("name", "Display name", "fail", "Missing"),
    textLengthCheck("bio", "Bio", readString(payload.bio)),
    skills.length > 0
      ? check("skills", "Skills listed", "pass", skills.slice(0, 5).join(", "))
      : check("skills", "Skills listed", "warn", "No skills listed"),
    linkCount > 0
      ? check("links", "Profile links", "pass", `${linkCount} link(s)`)
      : check("links", "Profile links", "warn", "No links"),
    await nearAccountCheck(subject.entityId, deps),
    await sameNameCheck(subject.entityId, name, deps),
  ];
}

async function projectChecks(subject: ReviewSubject, deps: CheckDependencies) {
  const payload = readPayload(subject.payload);
  const title = readString(payload.title) ?? null;
  const repository = readString(payload.repository);
  const [repositoryResult, domainResult, duplicate] = await Promise.all([
    githubRepositoryCheck(repository, deps),
    domainCheck(readString(payload.domain), deps),
    deps
      .findDuplicateProject({
        entityId: subject.entityId,
        title,
        slug: readString(payload.slug) ?? null,
        repository: repository ?? null,
      })
      .catch(() => undefined),
  ]);
  return [
    title
      ? check("title", "Title", "pass", title.slice(0, 80))
      : check("title", "Title", "fail", "Missing"),
    textLengthCheck("description", "Description", readString(payload.description)),
    repositoryResult,
    domainResult,
    duplicate === undefined
      ? check("duplicate", "Not a duplicate", "skip", "Lookup failed")
      : duplicate
        ? check("duplicate", "Not a duplicate", "fail", `Matches existing project "${duplicate}"`)
        : check("duplicate", "Not a duplicate", "pass"),
    await builderProfileCheck("owner_builder", "Submitter is a builder", subject.createdBy, deps),
  ];
}

async function eventChecks(subject: ReviewSubject, deps: CheckDependencies) {
  const payload = readPayload(subject.payload);
  const title = readString(payload.title);
  const startAt = Date.parse(readString(payload.startAt) ?? "");
  let duplicate: EvaluationCheck;
  if (!title || Number.isNaN(startAt)) {
    duplicate = check("duplicate", "Not a duplicate", "skip", "Needs a title and date");
  } else {
    try {
      const match = await deps.findDuplicateEvent({ entityId: subject.entityId, title, startAt });
      duplicate = match
        ? check("duplicate", "Not a duplicate", "fail", `Matches existing event "${match}"`)
        : check("duplicate", "Not a duplicate", "pass");
    } catch {
      duplicate = check("duplicate", "Not a duplicate", "skip", "Lookup failed");
    }
  }
  return [
    title
      ? check("title", "Title", "pass", title.slice(0, 80))
      : check("title", "Title", "fail", "Missing"),
    Number.isNaN(startAt)
      ? check("start_date", "Upcoming date", "warn", "No valid start date")
      : startAt < deps.now
        ? check("start_date", "Upcoming date", "fail", "Event date has passed")
        : check(
            "start_date",
            "Upcoming date",
            "pass",
            new Date(startAt).toISOString().slice(0, 10),
          ),
    readString(payload.location)
      ? check("location", "Location", "pass", readString(payload.location)!.slice(0, 80))
      : check("location", "Location", "warn", "No location"),
    duplicate,
  ];
}

async function catalogClaimChecks(subject: ReviewSubject, deps: CheckDependencies) {
  const payload = readPayload(subject.payload);
  const roles = readStringArray(payload.roles) ?? [];
  const claimant = readString(payload.nearAccount) ?? subject.createdBy;
  return [
    roles.length > 0
      ? check("roles", "Roles listed", "pass", roles.join(", "))
      : check("roles", "Roles listed", "fail", "No roles"),
    await builderProfileCheck("claimant_builder", "Claimant is a builder", claimant, deps),
  ];
}

async function queueChecks(
  subject: ReviewSubject,
  deps: CheckDependencies,
): Promise<EvaluationCheck[]> {
  switch (subject.pluginId) {
    case "builders":
      return await builderChecks(subject, deps);
    case "projects":
      return await projectChecks(subject, deps);
    case "events":
      return await eventChecks(subject, deps);
    case "nearcatalog":
      return await catalogClaimChecks(subject, deps);
    default:
      return [];
  }
}

export async function runReviewChecks(
  subject: ReviewSubject,
  deps: CheckDependencies,
): Promise<EvaluationCheck[]> {
  const source = describeSource(subject.source);
  return [
    source
      ? check("source", "Submission source", "pass", source)
      : check("source", "Submission source", "skip", "Unknown"),
    ...(await queueChecks(subject, deps)),
  ];
}
