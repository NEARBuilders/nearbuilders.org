import { Context, Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import type {
  IssueDifficultySchema,
  IssueLabelSchema,
  IssueUserSchema,
  RepoIssueSchema,
} from "../contract";

type RepoIssue = z.infer<typeof RepoIssueSchema>;
type IssueLabel = z.infer<typeof IssueLabelSchema>;
type IssueUser = z.infer<typeof IssueUserSchema>;
type IssueDifficulty = z.infer<typeof IssueDifficultySchema>;

export interface RepoRef {
  owner: string;
  name: string;
}

const RawLabelSchema = z.union([
  z.string(),
  z.object({
    name: z.string(),
    color: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
  }),
]);

const RawUserSchema = z.object({
  login: z.string(),
  avatar_url: z.string().nullable().optional(),
  html_url: z.string().nullable().optional(),
});

const RawIssueSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  body: z.string().nullable().optional(),
  html_url: z.string().url(),
  state: z.enum(["open", "closed"]),
  labels: z.array(RawLabelSchema).default([]),
  user: RawUserSchema.nullable().optional(),
  comments: z.number().int().nonnegative().default(0),
  created_at: z.string(),
  updated_at: z.string(),
  pull_request: z.unknown().optional(),
});

const DIFFICULTY_LABELS: Array<{ match: RegExp; difficulty: IssueDifficulty }> = [
  { match: /^good first issue$/i, difficulty: "beginner" },
  { match: /^beginner$/i, difficulty: "beginner" },
  { match: /^easy$/i, difficulty: "beginner" },
  { match: /^level:\s*beginner$/i, difficulty: "beginner" },
  { match: /^help wanted$/i, difficulty: "intermediate" },
  { match: /^intermediate$/i, difficulty: "intermediate" },
  { match: /^medium$/i, difficulty: "intermediate" },
  { match: /^level:\s*intermediate$/i, difficulty: "intermediate" },
  { match: /^advanced$/i, difficulty: "advanced" },
  { match: /^hard$/i, difficulty: "advanced" },
  { match: /^level:\s*advanced$/i, difficulty: "advanced" },
];

function inferDifficulty(labels: IssueLabel[]): IssueDifficulty {
  for (const rule of DIFFICULTY_LABELS) {
    if (labels.some((l) => rule.match.test(l.name))) return rule.difficulty;
  }
  return "unknown";
}

function normalizeLabels(raw: z.infer<typeof RawLabelSchema>[]): IssueLabel[] {
  return raw
    .map((label) => {
      if (typeof label === "string") return { name: label, color: null, description: null };
      return {
        name: label.name,
        color: label.color ?? null,
        description: label.description ?? null,
      };
    })
    .filter((l) => l.name.trim().length > 0);
}

function normalizeUser(raw: z.infer<typeof RawUserSchema> | null | undefined): IssueUser | null {
  if (!raw) return null;
  return {
    login: raw.login,
    avatarUrl: raw.avatar_url ?? null,
    htmlUrl: raw.html_url ?? null,
  };
}

function normalizeIssue(repo: RepoRef, raw: z.infer<typeof RawIssueSchema>): RepoIssue | null {
  if (raw.pull_request) return null;
  const labels = normalizeLabels(raw.labels);
  return {
    repoOwner: repo.owner,
    repoName: repo.name,
    number: raw.number,
    title: raw.title,
    body: raw.body ?? null,
    htmlUrl: raw.html_url,
    state: raw.state,
    labels,
    difficulty: inferDifficulty(labels),
    author: normalizeUser(raw.user ?? null),
    commentCount: raw.comments,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    claim: null,
  };
}

function upstreamError(error: unknown, timeoutMs: number) {
  if (error instanceof ORPCError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError" || /timeout/i.test(message)) {
    return new ORPCError("TIMEOUT", {
      message: "GitHub API request timed out",
      data: { timeoutMs, operation: "github", retryable: true },
    });
  }
  return new ORPCError("CONNECTION_ERROR", {
    message: "Could not reach GitHub",
    data: { host: "api.github.com", suggestion: "Try again shortly" },
  });
}

export interface GithubMethodsConfig {
  token?: string | null;
  fetchImpl?: (input: URL, init?: RequestInit) => Promise<Response>;
  timeoutMs?: number;
}

export function createGithubMethods(config: GithubMethodsConfig = {}) {
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 8000;
  const baseHeaders: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "nearbuilders-issues-plugin",
  };
  if (config.token) baseHeaders.authorization = `Bearer ${config.token}`;

  const request = <T extends z.ZodType>(url: URL, schema: T) =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetchImpl(url, {
          headers: baseHeaders,
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (response.status === 404) {
          throw new ORPCError("NOT_FOUND", {
            message: "GitHub resource not found",
            data: { resource: "github", url: url.toString() },
          });
        }
        if (response.status === 403 || response.status === 429) {
          const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "60", 10);
          throw new ORPCError("RATE_LIMITED", {
            message: "GitHub rate limit reached",
            data: { retryAfter: Number.isFinite(retryAfter) ? Math.max(retryAfter, 1) : 60 },
          });
        }
        if (!response.ok) {
          throw new ORPCError("SERVICE_UNAVAILABLE", {
            message: `GitHub responded with ${response.status}`,
            data: { maintenanceWindow: false },
          });
        }
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          throw new ORPCError("SERVICE_UNAVAILABLE", {
            message: "GitHub returned an invalid response",
            data: { maintenanceWindow: false },
          });
        }
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          throw new ORPCError("SERVICE_UNAVAILABLE", {
            message: "GitHub returned an unexpected shape",
            data: { maintenanceWindow: false },
          });
        }
        return parsed.data as z.infer<T>;
      },
      catch: (error) => upstreamError(error, timeoutMs),
    });

  return {
    listOpenIssues: (repo: RepoRef, perPage = 30, page = 1) =>
      Effect.gen(function* () {
        const url = new URL(`https://api.github.com/repos/${repo.owner}/${repo.name}/issues`);
        url.searchParams.set("state", "open");
        url.searchParams.set("per_page", String(Math.min(perPage, 100)));
        url.searchParams.set("page", String(Math.max(page, 1)));
        url.searchParams.set("sort", "updated");
        url.searchParams.set("direction", "desc");
        const rows = yield* request(url, z.array(RawIssueSchema));
        return rows
          .map((row) => normalizeIssue(repo, row))
          .filter((issue): issue is RepoIssue => issue !== null);
      }),

    getIssue: (repo: RepoRef, number: number) =>
      Effect.gen(function* () {
        const url = new URL(
          `https://api.github.com/repos/${repo.owner}/${repo.name}/issues/${number}`,
        );
        const raw = yield* request(url, RawIssueSchema);
        const issue = normalizeIssue(repo, raw);
        if (!issue) {
          return yield* Effect.fail(
            new ORPCError("NOT_FOUND", {
              message: "Issue not found (or is a pull request)",
              data: { resource: "github-issue" },
            }),
          );
        }
        return issue;
      }),

    getPullRequestState: (repo: RepoRef, prNumber: number) =>
      Effect.gen(function* () {
        const url = new URL(
          `https://api.github.com/repos/${repo.owner}/${repo.name}/pulls/${prNumber}`,
        );
        const raw = yield* request(
          url,
          z.object({
            state: z.enum(["open", "closed"]),
            merged: z.boolean().default(false),
          }),
        );
        if (raw.merged) return "merged" as const;
        return raw.state;
      }),
  };
}

type GithubMethods = ReturnType<typeof createGithubMethods>;

export class GithubService extends Context.Tag("issues/GithubService")<
  GithubService,
  GithubMethods
>() {}

export const GithubServiceLive = (config: GithubMethodsConfig) =>
  Layer.succeed(GithubService, createGithubMethods(config));
