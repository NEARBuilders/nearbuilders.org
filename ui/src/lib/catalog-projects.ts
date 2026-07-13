import type { ClaimedCatalogProject } from "@/lib/queries/catalog";

export function normalizeCatalogDirectoryProject({ project, contributors }: ClaimedCatalogProject) {
  const createdAt =
    contributors
      .map((contributor) => contributor.createdAt)
      .sort((a, b) => a.localeCompare(b))[0] ?? new Date(0).toISOString();
  const updatedAt =
    contributors
      .map((contributor) => contributor.updatedAt)
      .sort((a, b) => b.localeCompare(a))[0] ?? createdAt;
  return {
    id: project.projectRef,
    ownerId: "",
    organizationId: null,
    kind: "project" as const,
    slug: project.slug,
    title: project.name,
    description: project.tagline ?? project.description,
    content: project.description,
    status: "active" as const,
    visibility: "public" as const,
    repository: project.repositoryUrl,
    domain: null,
    createdAt,
    updatedAt,
    source: "nearcatalog" as const,
    catalogUrl: project.catalogUrl,
    imageUrl: project.imageUrl,
    contributors: contributors.map(({ nearAccount, roles }) => ({ nearAccount, roles })),
  };
}

export function shouldLoadCatalogProjects({
  kind,
  personal,
  privateOnly,
  ownerId,
}: {
  kind: string;
  personal: boolean;
  privateOnly: boolean;
  ownerId?: string;
}) {
  return (kind === "all" || kind === "project") && !privateOnly && (!personal || Boolean(ownerId));
}
