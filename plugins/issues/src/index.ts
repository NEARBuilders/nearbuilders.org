import { createPlugin } from "every-plugin";
import { Cause, Effect, Exit, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { DatabaseLive } from "./db/layer";
import { ContextSchema } from "./lib/context";
import { ClaimService, ClaimServiceLive } from "./services/claims";
import { GithubService, GithubServiceLive, type RepoRef } from "./services/github";

async function runEffect<A>(effect: Effect.Effect<A, ORPCError<string, unknown>>) {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isFailure(exit)) {
    const squashed = Cause.squash(exit.cause);
    if (squashed instanceof ORPCError) throw squashed;
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: squashed instanceof Error ? squashed.message : String(squashed),
    });
  }
  return exit.value;
}

function parseRepoList(raw: string | string[]): RepoRef[] {
  const items = Array.isArray(raw) ? raw : raw.split(",");
  const repos: RepoRef[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const [owner, name] = trimmed.split("/", 2);
    if (!owner || !name) continue;
    const key = `${owner.toLowerCase()}/${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    repos.push({ owner, name });
  }
  return repos;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export default createPlugin({
  variables: z.object({
    repos: z
      .union([z.string(), z.array(z.string())])
      .default("NEARBuilders/nearbuilders.org"),
    claimTtlDays: z.number().int().min(1).max(60).default(7),
  }),

  secrets: z.object({
    ISSUES_DATABASE_URL: z.string().default("pglite:.bos/issues/:memory:"),
    GITHUB_TOKEN: z.string().optional(),
  }),

  context: ContextSchema,

  contract,

  initialize: (config, _plugins, tools) =>
    Effect.gen(function* () {
      const Database = DatabaseLive(config.secrets.ISSUES_DATABASE_URL);
      const Claims = ClaimServiceLive({
        ttlMs: config.variables.claimTtlDays * 24 * 60 * 60 * 1000,
      }).pipe(Layer.provide(Database));
      const Github = GithubServiceLive({ token: config.secrets.GITHUB_TOKEN ?? null });

      const claims = yield* tools.buildService(ClaimService, Claims);
      const github = yield* tools.buildService(GithubService, Github);

      const repos = parseRepoList(config.variables.repos);
      if (repos.length === 0) {
        yield* Effect.logWarning("[Issues] No repositories configured — /v1/issues will be empty");
      } else {
        yield* Effect.logInfo(
          `[Issues] Watching ${repos.length} repo(s): ${repos.map((r) => `${r.owner}/${r.name}`).join(", ")}`,
        );
      }

      return { claims, github, repos };
    }),

  createRouter: (services, builder) => {
    const requireAuth = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "Sign in with your NEAR wallet to claim issues",
        });
      }
      return next({ context: { ...context, userId: context.userId!, user: context.user! } });
    });

    const authorNearAccount = (context: {
      userId?: string | null;
      user?: { role?: string | null } | null;
      near?: { primaryAccountId?: string | null };
    }): string | null => {
      const account = context.near?.primaryAccountId ?? null;
      return account ? account.trim().toLowerCase() : null;
    };

    return {
      listRepoIssues: builder.listRepoIssues.handler(async ({ input }) => {
        const repos = services.repos;
        const activeRepos = repos.filter((repo) => {
          if (input.repoOwner && repo.owner.toLowerCase() !== input.repoOwner.toLowerCase()) {
            return false;
          }
          if (input.repoName && repo.name.toLowerCase() !== input.repoName.toLowerCase()) {
            return false;
          }
          return true;
        });

        const perRepo = await mapWithConcurrency(activeRepos, 3, async (repo) => {
          const issues = await runEffect(services.github.listOpenIssues(repo, 50, 1));
          const claims = await runEffect(
            services.claims.getActiveClaimsForIssues(
              repo.owner,
              repo.name,
              issues.map((i) => i.number),
            ),
          );
          return issues.map((issue) => {
            const claim = claims.get(issue.number);
            if (!claim) return issue;
            return {
              ...issue,
              claim: {
                id: claim.id,
                nearAccount: claim.nearAccount,
                claimedAt: claim.claimedAt,
                expiresAt: claim.expiresAt,
                prUrl: claim.prUrl,
                status:
                  claim.status === "merged"
                    ? ("merged" as const)
                    : claim.status === "submitted"
                      ? ("submitted" as const)
                      : ("active" as const),
              },
            };
          });
        });

        const flat = perRepo.flat();
        const labelSet = new Set<string>();
        for (const issue of flat) for (const label of issue.labels) labelSet.add(label.name);

        const filtered = flat.filter((issue) => {
          if (input.difficulty && issue.difficulty !== input.difficulty) return false;
          if (input.label && !issue.labels.some((l) => l.name === input.label)) return false;
          if (input.claimed === "claimed" && !issue.claim) return false;
          if (input.claimed === "open" && issue.claim) return false;
          return true;
        });

        filtered.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

        const limit = Math.min(input.limit ?? 25, 50);
        const offset = input.cursor ? Math.max(Number.parseInt(input.cursor, 10) || 0, 0) : 0;
        const page = filtered.slice(offset, offset + limit);
        const nextOffset = offset + limit;
        const hasMore = nextOffset < filtered.length;

        return {
          data: page,
          meta: {
            total: filtered.length,
            hasMore,
            nextCursor: hasMore ? String(nextOffset) : null,
            repos: repos.map((repo) => ({
              owner: repo.owner,
              name: repo.name,
              htmlUrl: `https://github.com/${repo.owner}/${repo.name}`,
            })),
            labels: Array.from(labelSet).sort(),
          },
        };
      }),

      getRepoIssue: builder.getRepoIssue.handler(async ({ input, errors }) => {
        const repo: RepoRef = { owner: input.repoOwner, name: input.repoName };
        const isConfigured = services.repos.some(
          (r) =>
            r.owner.toLowerCase() === repo.owner.toLowerCase() &&
            r.name.toLowerCase() === repo.name.toLowerCase(),
        );
        if (!isConfigured) {
          throw errors.NOT_FOUND({
            message: "Repository is not enabled for issue browsing",
            data: { resource: "github-repo" },
          });
        }
        const issue = await runEffect(services.github.getIssue(repo, input.number));
        const claim = await runEffect(
          services.claims.getActiveClaimForIssue(repo.owner, repo.name, input.number),
        );
        return {
          data: claim
            ? {
                ...issue,
                claim: {
                  id: claim.id,
                  nearAccount: claim.nearAccount,
                  claimedAt: claim.claimedAt,
                  expiresAt: claim.expiresAt,
                  prUrl: claim.prUrl,
                  status:
                    claim.status === "merged"
                      ? ("merged" as const)
                      : claim.status === "submitted"
                        ? ("submitted" as const)
                        : ("active" as const),
                },
              }
            : issue,
        };
      }),

      listIssueClaims: builder.listIssueClaims.handler(async ({ input }) =>
        await runEffect(services.claims.listClaims(input)),
      ),

      claimIssue: builder.claimIssue.use(requireAuth).handler(async ({ input, context, errors }) => {
        const account = input.nearAccount?.trim().toLowerCase() ?? authorNearAccount(context);
        if (!account) {
          throw errors.FORBIDDEN({
            message: "A linked NEAR account is required to claim issues",
          });
        }
        const isConfigured = services.repos.some(
          (r) =>
            r.owner.toLowerCase() === input.repoOwner.toLowerCase() &&
            r.name.toLowerCase() === input.repoName.toLowerCase(),
        );
        if (!isConfigured) {
          throw errors.NOT_FOUND({
            message: "Repository is not enabled for claiming",
            data: { resource: "github-repo" },
          });
        }
        const issue = await runEffect(
          services.github.getIssue(
            { owner: input.repoOwner, name: input.repoName },
            input.issueNumber,
          ),
        );
        const claim = await runEffect(
          services.claims.claimIssue({
            repoOwner: input.repoOwner,
            repoName: input.repoName,
            issueNumber: input.issueNumber,
            issueTitle: issue.title,
            issueUrl: issue.htmlUrl,
            nearAccount: account,
          }),
        );
        return { data: claim };
      }),

      releaseIssueClaim: builder.releaseIssueClaim
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const account = authorNearAccount(context);
          if (!account) {
            throw errors.FORBIDDEN({ message: "A linked NEAR account is required" });
          }
          const claim = await runEffect(
            services.claims.releaseClaim(input.id, account, context.user?.role === "admin"),
          );
          return { data: claim };
        }),

      attachPrToClaim: builder.attachPrToClaim
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const account = authorNearAccount(context);
          if (!account) {
            throw errors.FORBIDDEN({ message: "A linked NEAR account is required" });
          }
          const claim = await runEffect(
            services.claims.attachPr(
              input.id,
              input.prUrl,
              account,
              context.user?.role === "admin",
            ),
          );
          return { data: claim };
        }),
    };
  },
});
