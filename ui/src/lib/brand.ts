const SURFACE_PROPERTIES = new Set([
  "--background",
  "--foreground",
  "--card",
  "--muted-foreground",
  "--border",
]);

export const BRAND_LOGO_SRC = "/logo.png";

export type BrandColor = {
  property: string;
  label: string;
  light: string | null;
  dark: string | null;
};

export type BrandPalette = {
  colors: BrandColor[];
  fontFamily: string | null;
  fontWeight: string | null;
};

export type BrandIcon = {
  href: string;
  label: string;
};

type ManifestIcon = {
  src?: string;
  sizes?: string;
};

export function extractBrandPalette(css: string): BrandPalette {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const light = new Map<string, string>();
  const dark = new Map<string, string>();
  const order: string[] = [];
  let fontFamily: string | null = null;
  let fontWeight: string | null = null;
  let index = 0;

  while (index < source.length) {
    while (index < source.length && /\s/.test(source[index] ?? "")) index += 1;
    if (index >= source.length) break;
    if (source[index] === "}") {
      index += 1;
      continue;
    }

    const open = source.indexOf("{", index);
    const semi = source.indexOf(";", index);
    if (open === -1) break;
    if (semi !== -1 && semi < open) {
      index = semi + 1;
      continue;
    }

    const prelude = source.slice(index, open).trim();
    if (prelude.startsWith("@") && shouldSkipAtRule(prelude)) {
      index = endOfBlock(source, open) + 1;
      continue;
    }
    if (prelude.startsWith("@")) {
      index = open + 1;
      continue;
    }

    const close = endOfBlock(source, open);
    const body = source.slice(open + 1, close);
    const bucket = themeBucket(prelude);
    if (bucket === "font") {
      for (const declaration of readDeclarations(body)) {
        if (declaration.property === "font-family") fontFamily = declaration.value;
        if (declaration.property === "font-weight") fontWeight = declaration.value;
      }
    } else if (bucket) {
      const target = bucket === "light" ? light : dark;
      for (const declaration of readDeclarations(body)) {
        if (!isBrandProperty(declaration.property)) continue;
        target.set(declaration.property, declaration.value);
        if (!order.includes(declaration.property)) order.push(declaration.property);
      }
    }
    index = close + 1;
  }

  const colors = order
    .map((property) => ({
      property,
      label: labelForProperty(property),
      light: light.get(property) ?? null,
      dark: dark.get(property) ?? null,
    }))
    .filter((color) => color.light || color.dark);

  return {
    colors: [
      ...colors.filter((color) => color.property.startsWith("--brand-")),
      ...colors.filter((color) => !color.property.startsWith("--brand-")),
    ],
    fontFamily,
    fontWeight,
  };
}

export function labelForProperty(property: string): string {
  const name = property.replace(/^--(?:brand-)?/, "").replace(/-/g, " ");
  return name.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function filenameFromHref(href: string, fallback: string): string {
  const path = href.split("?")[0]?.split("#")[0] ?? "";
  const name = path.split("/").pop();
  return name || fallback;
}

export function absoluteAssetUrl(path: string, locationHref?: string): string {
  if (!path) return path;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path;

  const bases: string[] = [];
  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin;
    bases.push(locationHref ? new URL(locationHref, origin).href : origin);
  } else if (locationHref && /^[a-z][a-z0-9+.-]*:/i.test(locationHref)) {
    bases.push(locationHref);
  }
  if (typeof document !== "undefined" && document.baseURI) {
    bases.push(document.baseURI);
  }

  for (const base of bases) {
    try {
      return new URL(path, base).href;
    } catch {}
  }

  return path;
}

export function iconLabel(href: string, rel: string): string {
  if (rel.includes("apple")) return "Apple touch icon";
  const file = filenameFromHref(href, "icon");
  if (file.endsWith(".ico")) return "Favicon";
  const size = file.match(/(\d+x\d+)/);
  if (size?.[1]) return `Icon ${size[1]}`;
  return "Icon";
}

export function dedupeIcons(icons: BrandIcon[]): BrandIcon[] {
  const seen = new Set<string>();
  const unique: BrandIcon[] = [];
  for (const icon of icons) {
    const key = icon.href.split("?")[0] ?? icon.href;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(icon);
  }
  return unique;
}

export function iconsFromManifest(
  icons: ManifestIcon[] | undefined,
  manifestHref: string,
): BrandIcon[] {
  if (!icons) return [];
  return icons.flatMap((icon) => {
    if (!icon.src) return [];
    return [
      {
        href: resolveHref(manifestHref, icon.src),
        label: icon.sizes ? `App icon ${icon.sizes}` : "App icon",
      },
    ];
  });
}

export function collectBrandIcons(
  links: Array<{ href: string; rel: string }>,
  manifest: { href: string; icons?: ManifestIcon[] } | null,
): BrandIcon[] {
  const fromLinks = links
    .filter((link) => link.href)
    .map((link) => ({ href: link.href, label: iconLabel(link.href, link.rel) }));
  const fromManifest = manifest ? iconsFromManifest(manifest.icons, manifest.href) : [];
  return dedupeIcons([...fromLinks, ...fromManifest]);
}

export function primaryFavicon(icons: BrandIcon[]): string {
  return (
    icons.find((icon) => icon.href.split("?")[0]?.endsWith(".ico"))?.href ??
    icons[0]?.href ??
    "/favicon.ico"
  );
}

export function downloadAsset(href: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export async function copyLogoImage(href: string) {
  const response = await fetch(href);
  if (!response.ok) throw new Error("Could not load logo");
  const blob = await response.blob();
  const png = blob.type === "image/png" ? blob : await rasterToPng(blob);
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}

export function tokenNameForProperty(property: string): string {
  return property.replace(/^--(?:brand-)?/, "");
}

export function buildDesignMd(
  palette: BrandPalette,
  options: { name?: string; logoHref?: string; description?: string } = {},
): string {
  const name = options.name ?? "Near Builders";
  const description = options.description ?? "Brand tokens for the Near Builders product surface.";
  const logoHref = options.logoHref ?? BRAND_LOGO_SRC;
  const colorEntries = designColorEntries(palette);
  const primary =
    colorEntries.find((entry) => entry.token === "accent") ??
    colorEntries.find((entry) => entry.token === "primary") ??
    colorEntries[0];
  const fontFamily = primaryFontFamily(palette.fontFamily) ?? "Inter";
  const fontWeight = Number.parseInt(palette.fontWeight ?? "500", 10) || 500;

  const yamlColors = [
    primary ? `  primary: "${primary.light}"` : null,
    ...colorEntries
      .filter((entry) => entry.token !== "primary")
      .flatMap((entry) => {
        const lines = [`  ${entry.token}: "${entry.light}"`];
        if (entry.dark && entry.dark !== entry.light) {
          lines.push(`  ${entry.token}-dark: "${entry.dark}"`);
        }
        return lines;
      }),
  ]
    .filter(Boolean)
    .join("\n");

  const colorBullets = colorEntries
    .map((entry) => {
      const darkNote = entry.dark && entry.dark !== entry.light ? ` · dark ${entry.dark}` : "";
      return `- **${entry.label} (\`${entry.light}\`):** CSS \`${entry.property}\`${darkNote}.`;
    })
    .join("\n");

  return `---
version: alpha
name: ${yamlString(name)}
description: ${yamlString(description)}
colors:
${yamlColors}
typography:
  body-md:
    fontFamily: ${yamlString(fontFamily)}
    fontSize: 1rem
    fontWeight: ${fontWeight}
    lineHeight: 1.5
  headline:
    fontFamily: ${yamlString(fontFamily)}
    fontSize: 2.25rem
    fontWeight: 900
    lineHeight: 1.1
  label-caps:
    fontFamily: ${yamlString(fontFamily)}
    fontSize: 0.75rem
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0.1em
rounded:
  md: 0.75rem
  lg: 1rem
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
omitted:
  - section: components
    reason: "Brand page exports identity tokens; compose components from product UI patterns."
---

## Overview

${name} is a builder-community product surface: clean, technical, and mint-accented.
Use Inter for UI type, keep surfaces quiet, and reserve the mint accent for primary
actions, focus rings, and brand emphasis. Logo asset: \`${logoHref}\`.

## Colors

Light theme values are normative. Dark-theme overrides are listed as \`-dark\` tokens
when they differ.

${colorBullets}

## Typography

- **Family:** ${fontFamily}
- **Default weight:** ${fontWeight}
- **Headlines:** Inter Black for page titles and brand moments
- **Labels:** uppercase tracking-widest section labels in the mint accent

## Layout

Prefer a centered content column (\`max-w-7xl\`) with comfortable page padding.
Use the spacing scale above; group related blocks with card surfaces and border
separators rather than heavy chrome.

## Elevation & Depth

Depth comes from tonal layers and hairline borders, not dramatic shadows. Cards
sit on \`{colors.card}\` against \`{colors.background}\` with \`{colors.border}\`.

## Shapes

Corners are soft but restrained. Default control and card radius is \`{rounded.md}\`
(\`0.75rem\`). Pills and avatars may use \`{rounded.full}\`.

## Do's and Don'ts

- Do keep the mint accent sparse — one primary action per view when possible
- Don't invent new brand hues outside the exported tokens
- Do use semantic surface tokens (\`background\`, \`card\`, \`border\`) instead of raw grays
- Don't place low-contrast text on mint or cobalt fills
- Do ship Inter (or the documented fallback stack) rather than swapping display fonts
`;
}

function designColorEntries(palette: BrandPalette) {
  return palette.colors.flatMap((color) => {
    const light = color.light ?? color.dark;
    if (!light) return [];
    const token = tokenNameForProperty(color.property);
    return [
      {
        property: color.property,
        token,
        label: color.label,
        light,
        dark: color.dark,
      },
    ];
  });
}

function primaryFontFamily(fontFamily: string | null): string | null {
  if (!fontFamily) return null;
  const first = fontFamily
    .split(",")[0]
    ?.trim()
    .replace(/^["']|["']$/g, "");
  return first || null;
}

function yamlString(value: string): string {
  if (/[:#{}[\],&*?|>!%@`]/.test(value) || value.includes('"') || value.includes("'")) {
    return JSON.stringify(value);
  }
  if (value.includes(" ") || value === "") return JSON.stringify(value);
  return value;
}

function shouldSkipAtRule(prelude: string) {
  return (
    prelude.startsWith("@theme") ||
    prelude.startsWith("@keyframes") ||
    prelude.startsWith("@font-face")
  );
}

function themeBucket(selector: string): "light" | "dark" | "font" | null {
  const parts = selector
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.every((part) => part === "body")) return "font";
  if (parts.every((part) => part === ":root" || part === "html")) return "light";
  if (parts.every((part) => part === ".dark" || part === "html.dark" || part === ":root.dark")) {
    return "dark";
  }
  return null;
}

function readDeclarations(body: string): Array<{ property: string; value: string }> {
  const declarations: Array<{ property: string; value: string }> = [];
  for (const chunk of body.split(";")) {
    const separator = chunk.indexOf(":");
    if (separator === -1) continue;
    const property = chunk.slice(0, separator).trim();
    const value = chunk
      .slice(separator + 1)
      .trim()
      .replace(/\s*!important\s*$/, "");
    if (!property || !value) continue;
    declarations.push({ property, value });
  }
  return declarations;
}

function isBrandProperty(property: string) {
  return property.startsWith("--brand-") || SURFACE_PROPERTIES.has(property);
}

function endOfBlock(source: string, openIndex: number): number {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return source.length - 1;
}

async function rasterToPng(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not copy logo");
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!png) throw new Error("Could not copy logo");
  return png;
}

function resolveHref(baseHref: string, src: string): string {
  const clean = src.split("?")[0] ?? src;
  if (clean.startsWith("/")) return clean;
  try {
    return new URL(clean, new URL(baseHref, "http://local")).pathname;
  } catch {
    return clean;
  }
}
