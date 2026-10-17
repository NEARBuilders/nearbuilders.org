import type { ApiClient } from "@/app";

type FeaturedProjectsApiClient = Pick<ApiClient, "listProjects">;

export type FeaturedProject = Awaited<ReturnType<ApiClient["listProjects"]>>["data"][number];

type FeaturableProject = Pick<FeaturedProject, "slug" | "status" | "visibility">;

export const featuredProjectKeys = {
  list: (slugs: readonly string[]) => ["featured-projects", ...slugs] as const,
};

export function uniqueFeaturedSlugs(slugs: readonly string[]) {
  return Array.from(new Set(slugs.map((slug) => slug.trim()).filter(Boolean)));
}

export function isFeaturableProject(project: FeaturableProject) {
  return project.status === "active" && project.visibility !== "private";
}

export function orderFeaturedProjects<T extends FeaturableProject>(
  slugs: readonly string[],
  projects: readonly T[],
): T[] {
  const bySlug = new Map(
    projects.filter(isFeaturableProject).map((project) => [project.slug, project]),
  );
  return uniqueFeaturedSlugs(slugs).flatMap((slug) => {
    const project = bySlug.get(slug);
    return project ? [project] : [];
  });
}

export function getProjectAppUrl(project: Pick<FeaturedProject, "domain">) {
  const domain = project.domain?.trim();
  if (!domain) return null;
  return /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
}

export async function fetchFeaturedProjects(
  apiClient: FeaturedProjectsApiClient,
  slugs: readonly string[],
) {
  const unique = uniqueFeaturedSlugs(slugs);
  if (unique.length === 0) return [];
  const result = await apiClient.listProjects({ slugs: unique.join(","), status: "active" });
  return orderFeaturedProjects(unique, result.data);
}

export function featuredProjectsQueryOptions(
  apiClient: FeaturedProjectsApiClient,
  slugs: readonly string[],
) {
  return {
    queryKey: featuredProjectKeys.list(slugs),
    queryFn: () => fetchFeaturedProjects(apiClient, slugs),
    staleTime: 5 * 60_000,
  };
}
