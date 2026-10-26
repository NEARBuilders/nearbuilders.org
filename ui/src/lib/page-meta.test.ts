import { getSocialImageMeta } from "everything-dev/ui/metadata";
import { getMetaKey } from "everything-dev/ui/router";
import { describe, expect, it } from "vitest";
import type { ClientRuntimeConfig } from "@/app";
import { pageHead, publicPages, rootOpenGraphMeta, siteMetadataImage } from "./page-meta";
import { getSiteUrl } from "./site-url";

const runtimeConfig = {
  hostUrl: "https://nearbuilders.org",
  account: "builders.near",
  runtime: {
    accountId: "builders.near",
    gatewayId: "near",
    runtimeBasePath: "/",
    title: "NEAR Builders",
    description: "The NEAR builder network.",
    hostUrl: "https://nearbuilders.org",
  },
} satisfies Partial<ClientRuntimeConfig>;

type Meta = {
  title?: string;
  name?: string;
  property?: string;
  content?: string;
};

function mergeMeta(groups: Meta[][]) {
  const merged = new Map<string, Meta>();
  for (const group of groups) {
    for (const meta of group) merged.set(getMetaKey(meta), meta);
  }
  return [...merged.values()];
}

function content(meta: Meta[], key: { title: true } | { name: string } | { property: string }) {
  if ("title" in key) return meta.find((item) => item.title !== undefined)?.title;
  if ("name" in key) return meta.find((item) => item.name === key.name)?.content;
  return meta.find((item) => item.property === key.property)?.content;
}

function rootHead(pathname: string) {
  const title = runtimeConfig.runtime.title ?? runtimeConfig.account;
  const description = runtimeConfig.runtime.description ?? "";
  return [
    { title },
    { name: "description", content: description },
    ...rootOpenGraphMeta({
      title,
      description,
      canonicalUrl: getSiteUrl(runtimeConfig, pathname),
      imageUrl: siteMetadataImage(runtimeConfig),
    }),
  ];
}

describe("page open graph metadata", () => {
  it.each(
    Object.values(publicPages),
  )("uses the page title, description, and canonical url for $pathname", (page) => {
    const merged = mergeMeta([rootHead(page.pathname), pageHead(page)]);
    const canonicalUrl = `https://nearbuilders.org${page.pathname}`;

    expect(content(merged, { title: true })).toBe(page.title);
    expect(content(merged, { name: "description" })).toBe(page.description);
    expect(content(merged, { property: "og:title" })).toBe(page.title);
    expect(content(merged, { property: "og:description" })).toBe(page.description);
    expect(content(merged, { name: "twitter:title" })).toBe(page.title);
    expect(content(merged, { name: "twitter:description" })).toBe(page.description);
    expect(content(merged, { property: "og:url" })).toBe(canonicalUrl);
    expect(content(merged, { property: "og:image" })).toBe("https://nearbuilders.org/metadata.png");
    expect(content(merged, { property: "og:image:alt" })).toBe(page.description);
    expect(content(merged, { name: "twitter:image:alt" })).toBe(page.description);
    expect(content(merged, { property: "og:type" })).toBe("website");
    expect(merged.filter((item) => item.property === "og:title")).toHaveLength(1);
    expect(merged.filter((item) => item.property === "og:image:alt")).toHaveLength(1);
    expect(merged.filter((item) => item.name === "twitter:image:alt")).toHaveLength(1);
    expect(merged.filter((item) => item.property === "og:url")).toHaveLength(1);
  });

  it("keeps the runtime title, description, and social image when a route does not define its own", () => {
    const merged = rootHead("/about");

    expect(content(merged, { title: true })).toBe("NEAR Builders");
    expect(content(merged, { name: "description" })).toBe("The NEAR builder network.");
    expect(content(merged, { property: "og:title" })).toBe("NEAR Builders");
    expect(content(merged, { property: "og:description" })).toBe("The NEAR builder network.");
    expect(content(merged, { property: "og:url" })).toBe("https://nearbuilders.org/about");
    expect(content(merged, { property: "og:image" })).toBe("https://nearbuilders.org/metadata.png");
    expect(content(merged, { name: "twitter:image" })).toBe(
      "https://nearbuilders.org/metadata.png",
    );
    expect(content(merged, { property: "og:image:alt" })).toBe("The NEAR builder network.");
    expect(content(merged, { name: "twitter:image:alt" })).toBe("The NEAR builder network.");
  });

  it("keeps the runtime image alt when a page sets a title without a description", () => {
    const merged = mergeMeta([
      rootHead("/notifications"),
      pageHead({ title: "Notifications | NEAR Builders" }),
    ]);

    expect(content(merged, { title: true })).toBe("Notifications | NEAR Builders");
    expect(content(merged, { property: "og:title" })).toBe("Notifications | NEAR Builders");
    expect(content(merged, { name: "description" })).toBe("The NEAR builder network.");
    expect(content(merged, { property: "og:image:alt" })).toBe("The NEAR builder network.");
    expect(content(merged, { name: "twitter:image:alt" })).toBe("The NEAR builder network.");
  });

  it("preserves detail-page title, type, url, and image over the root tags", () => {
    const description = "A widget project.";
    const detail = [
      { title: "Widgets | NEAR Builders" },
      { name: "description", content: description },
      ...getSocialImageMeta({
        imageUrl: "https://assets.nearbuilders.org/metadata.png",
        title: "Widgets",
        description,
        siteName: "NEAR Builders",
        siteUrl: "https://nearbuilders.org/projects/project/widgets",
        type: "article",
        alt: description,
      }),
    ];
    const merged = mergeMeta([rootHead("/projects/project/widgets"), detail]);

    expect(content(merged, { title: true })).toBe("Widgets | NEAR Builders");
    expect(content(merged, { property: "og:title" })).toBe("Widgets");
    expect(content(merged, { property: "og:description" })).toBe(description);
    expect(content(merged, { property: "og:type" })).toBe("article");
    expect(content(merged, { property: "og:url" })).toBe(
      "https://nearbuilders.org/projects/project/widgets",
    );
    expect(content(merged, { property: "og:image" })).toBe(
      "https://assets.nearbuilders.org/metadata.png",
    );
    expect(content(merged, { property: "og:image:alt" })).toBe(description);
    expect(content(merged, { name: "twitter:image:alt" })).toBe(description);
    expect(content(merged, { name: "twitter:image" })).toBe(
      "https://assets.nearbuilders.org/metadata.png",
    );
  });
});
