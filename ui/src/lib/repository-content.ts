export function sanitizeMarkdownContent(content: string): string {
  return content
    .replace(/<!-- markdownlint-disable[^>]*-->/g, "")
    .replace(/<div align="center">[\s\S]*?<\/div>/g, "")
    .trim();
}

export function getRawReadmeUrls(repositoryUrl: string): string[] {
  try {
    const url = new URL(repositoryUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
      return [];
    }

    const [owner, repo] = parts;
    return [
      `https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`,
      `https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`,
    ];
  } catch {
    return [];
  }
}

function parseGithubRepo(repositoryUrl: string): { owner: string; repo: string } | null {
  try {
    const url = new URL(repositoryUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const [owner, repo] = parts;
    return { owner, repo: repo.replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

export interface RepositoryCommit {
  sha: string;
  message: string;
  url: string;
  author: string | null;
  date: string | null;
}

export async function fetchRepositoryCommits(
  repositoryUrl: string,
  limit = 8,
): Promise<RepositoryCommit[]> {
  const parsed = parseGithubRepo(repositoryUrl);
  if (!parsed) return [];

  try {
    const response = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits?per_page=${limit}`,
      { headers: { Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) {
      console.warn("[repository-content] commits lookup failed:", response.status, repositoryUrl);
      return [];
    }
    const commits = (await response.json()) as Array<{
      sha: string;
      html_url: string;
      commit?: {
        message?: string;
        committer?: { date?: string; name?: string };
        author?: { date?: string; name?: string };
      };
      author?: { login?: string } | null;
    }>;
    return commits.map((entry) => ({
      sha: entry.sha,
      message: (entry.commit?.message ?? "").split("\n")[0],
      url: entry.html_url,
      author:
        entry.author?.login ?? entry.commit?.author?.name ?? entry.commit?.committer?.name ?? null,
      date: entry.commit?.committer?.date ?? entry.commit?.author?.date ?? null,
    }));
  } catch (error) {
    console.warn("[repository-content] commits lookup error for", repositoryUrl, error);
    return [];
  }
}

export async function fetchRepositoryLastCommitDate(repositoryUrl: string): Promise<string | null> {
  const commits = await fetchRepositoryCommits(repositoryUrl, 1);
  return commits[0]?.date ?? null;
}

export function mostRecentIsoDate(...dates: Array<string | null | undefined>): string | null {
  const valid = dates.filter(
    (date): date is string => date != null && !Number.isNaN(new Date(date).getTime()),
  );
  if (valid.length === 0) return null;
  return valid.reduce((latest, current) =>
    new Date(current) > new Date(latest) ? current : latest,
  );
}

export async function fetchRepositoryReadme(repositoryUrl: string): Promise<string | null> {
  const candidates = getRawReadmeUrls(repositoryUrl);
  if (candidates.length === 0) {
    console.warn("[repository-content] Could not derive raw README URLs from:", repositoryUrl);
    return null;
  }

  for (const url of candidates) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) {
        console.warn("[repository-content] fetch failed:", response.status, url);
        continue;
      }
      return sanitizeMarkdownContent(await response.text());
    } catch (error) {
      console.warn("[repository-content] fetch error for", url, error);
    }
  }

  console.warn("[repository-content] all README candidates failed for:", repositoryUrl);
  return null;
}
