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
