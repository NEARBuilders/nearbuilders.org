import type { ApiClient } from "@/app";

export type ProjectCatalog = NonNullable<
  Awaited<ReturnType<ApiClient["getProjectBySlug"]>>["data"]["catalog"]
>;

export const CATALOG_PHASES = [
  { value: "mainnet", label: "Mainnet" },
  { value: "testnet", label: "Testnet" },
  { value: "prototype", label: "Prototype" },
  { value: "still building", label: "Still building" },
  { value: "inactive", label: "Inactive" },
] as const;

export type CatalogPhase = (typeof CATALOG_PHASES)[number]["value"];

export const CATALOG_LINKS = [
  { key: "twitter", label: "X", placeholder: "https://x.com/project" },
  { key: "telegram", label: "Telegram", placeholder: "https://t.me/project" },
  { key: "discord", label: "Discord", placeholder: "https://discord.gg/invite" },
  { key: "medium", label: "Medium", placeholder: "https://medium.com/@project" },
  { key: "whitepaper", label: "Whitepaper", placeholder: "https://docs.example.com" },
  { key: "nearsocial", label: "NEAR Social", placeholder: "https://near.social/project.near" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/project" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@project" },
] as const;

export type CatalogLinkKey = (typeof CATALOG_LINKS)[number]["key"];

export const CATALOG_TAGLINE_MAX = 140;
export const CATALOG_CATEGORIES_MAX = 6;

export type ProjectCatalogFormValues = {
  tagline: string;
  categories: string[];
  phase: CatalogPhase | "";
  links: Partial<Record<CatalogLinkKey, string>>;
  tokenContract: string;
  coingeckoId: string;
};

export const emptyProjectCatalog = (): ProjectCatalogFormValues => ({
  tagline: "",
  categories: [],
  phase: "",
  links: {},
  tokenContract: "",
  coingeckoId: "",
});

export function projectCatalogToFormValues(
  catalog: ProjectCatalog | null | undefined,
): ProjectCatalogFormValues {
  return {
    tagline: catalog?.tagline ?? "",
    categories: catalog?.categories ?? [],
    phase: catalog?.phase ?? "",
    links: Object.fromEntries(
      CATALOG_LINKS.map(({ key }) => [key, catalog?.links?.[key] ?? ""]),
    ) as ProjectCatalogFormValues["links"],
    tokenContract: catalog?.tokenContract ?? "",
    coingeckoId: catalog?.coingeckoId ?? "",
  };
}

export function projectCatalogFromFormValues(
  values: ProjectCatalogFormValues | undefined,
): ProjectCatalog | null {
  if (!values) return null;
  const catalog: ProjectCatalog = {};
  const tagline = values.tagline.trim();
  if (tagline) catalog.tagline = tagline;
  if (values.categories.length > 0) catalog.categories = values.categories;
  if (values.phase) catalog.phase = values.phase;
  const links = Object.fromEntries(
    Object.entries(values.links)
      .map(([key, value]) => [key, value?.trim() ?? ""] as const)
      .filter(([, value]) => value.length > 0),
  );
  if (Object.keys(links).length > 0) catalog.links = links;
  const tokenContract = values.tokenContract.trim().toLowerCase();
  if (tokenContract) catalog.tokenContract = tokenContract;
  const coingeckoId = values.coingeckoId.trim().toLowerCase();
  if (coingeckoId) catalog.coingeckoId = coingeckoId;
  return Object.keys(catalog).length > 0 ? catalog : null;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export type ProjectCatalogErrors = Partial<
  Record<"tagline" | "categories" | "tokenContract" | "coingeckoId" | CatalogLinkKey, string>
>;

export function getProjectCatalogErrors(
  values: ProjectCatalogFormValues | undefined,
): ProjectCatalogErrors {
  const errors: ProjectCatalogErrors = {};
  if (!values) return errors;
  if (values.tagline.trim().length > CATALOG_TAGLINE_MAX) {
    errors.tagline = `Max ${CATALOG_TAGLINE_MAX} characters`;
  }
  if (values.categories.length > CATALOG_CATEGORIES_MAX) {
    errors.categories = `Pick up to ${CATALOG_CATEGORIES_MAX} categories`;
  }
  for (const { key } of CATALOG_LINKS) {
    const value = values.links[key]?.trim();
    if (!value) continue;
    if (value.length > 500) errors[key] = "Max 500 characters";
    else if (!isHttpUrl(value)) errors[key] = "Must be an absolute http(s) URL";
  }
  const tokenContract = values.tokenContract.trim().toLowerCase();
  if (tokenContract && !/^(?=.{2,64}$)[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(tokenContract)) {
    errors.tokenContract = "Enter a NEAR account id like token.example.near";
  }
  const coingeckoId = values.coingeckoId.trim().toLowerCase();
  if (coingeckoId && !/^[a-z0-9-]{1,100}$/.test(coingeckoId)) {
    errors.coingeckoId = "Use the CoinGecko API id, like near or ref-finance";
  }
  return errors;
}

export function validateProjectCatalog(values: ProjectCatalogFormValues | undefined) {
  const errors = getProjectCatalogErrors(values);
  return Object.values(errors)[0];
}

export type CatalogReadinessInput = {
  description?: string | null;
  logoUrl?: string | null;
  catalog?: Pick<ProjectCatalog, "tagline" | "categories"> | null;
};

export function getCatalogReadiness(project: CatalogReadinessInput) {
  const items = [
    { key: "tagline", label: "One-line tagline", complete: Boolean(project.catalog?.tagline) },
    {
      key: "description",
      label: "Short description",
      complete: Boolean(project.description?.trim()),
    },
    { key: "logo", label: "Logo", complete: Boolean(project.logoUrl?.trim()) },
    {
      key: "categories",
      label: "At least one category",
      complete: (project.catalog?.categories?.length ?? 0) > 0,
    },
  ];
  return {
    items,
    missing: items.filter((item) => !item.complete),
    ready: items.every((item) => item.complete),
  };
}

export const catalogCategoriesQueryOptions = (
  apiClient: Pick<ApiClient, "listCatalogCategories">,
) => ({
  queryKey: ["catalog-categories"] as const,
  queryFn: async () => (await apiClient.listCatalogCategories({})).data,
  staleTime: 60 * 60_000,
});
