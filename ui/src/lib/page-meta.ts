import { getSocialImageMeta } from "everything-dev/ui/metadata";
import type { ClientRuntimeConfig } from "@/app";

type RuntimeConfig = Partial<ClientRuntimeConfig> | undefined;

type PageMeta =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string };

export const publicPages = {
  home: {
    title: "NEAR Builders — Build what's next, together",
    description:
      "Find collaborators, discover open projects, and ship products with builders on NEAR.",
    pathname: "/",
  },
  projects: {
    title: "Projects | NearBuilders",
    description: "Find projects, ideas, scopes, and results from the NEAR builder network.",
    pathname: "/projects",
  },
  events: {
    title: "Events | NEAR Builders",
    description: "Browse NEAR builder events.",
    pathname: "/events",
  },
  activity: {
    title: "Activity | NEAR Builders",
    description: "Browse and endorse contributions across the NEAR Builders ecosystem.",
    pathname: "/activity",
  },
  builders: {
    title: "Builders | NEAR Builders",
    description:
      "Discover builders in the NEAR ecosystem. Find collaborators, explore profiles, and connect with the community.",
    pathname: "/builders",
  },
  leaderboard: {
    title: "Leaderboard | NEAR Builders",
    description: "The builders contributing most across the NEAR Builders ecosystem.",
    pathname: "/activity/leaderboard",
  },
} as const;

export function siteMetadataImage(runtimeConfig: RuntimeConfig) {
  const hostUrl = runtimeConfig?.hostUrl;
  if (!hostUrl) return "/metadata.png";
  const runtimeBasePath = runtimeConfig?.runtime?.runtimeBasePath ?? "/";
  const root = `${hostUrl}${runtimeBasePath === "/" ? "" : runtimeBasePath}`;
  return `${root}/metadata.png`;
}

export function rootOpenGraphMeta(input: {
  title: string;
  description: string;
  canonicalUrl?: string;
  imageUrl: string;
}) {
  return getSocialImageMeta({
    imageUrl: input.imageUrl,
    title: input.title,
    description: input.description,
    siteName: input.title || undefined,
    siteUrl: input.canonicalUrl || undefined,
    alt: input.description || undefined,
  });
}

export function pageHead(page: { title: string; description?: string }): PageMeta[] {
  const meta: PageMeta[] = [
    { title: page.title },
    { property: "og:title", content: page.title },
    { name: "twitter:title", content: page.title },
  ];
  if (page.description !== undefined) {
    meta.push(
      { name: "description", content: page.description },
      { property: "og:description", content: page.description },
      { name: "twitter:description", content: page.description },
      { property: "og:image:alt", content: page.description },
      { name: "twitter:image:alt", content: page.description },
    );
  }
  return meta;
}
