import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { Copy, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  absoluteAssetUrl,
  BRAND_LOGO_SRC,
  type BrandColor,
  type BrandIcon,
  buildDesignMd,
  collectBrandIcons,
  downloadAsset,
  extractBrandPalette,
  filenameFromHref,
} from "@/lib/brand";
import brandStyles from "../../../styles.css?raw";

const palette = extractBrandPalette(brandStyles);

export const Route = createFileRoute("/_layout/brand/")({
  head: () => ({
    meta: [
      { title: "Brand | NEAR Builders" },
      {
        name: "description",
        content: "Logo, favicon, colors, and type for NEAR Builders.",
      },
    ],
  }),
  component: BrandPage,
});

function BrandPage() {
  const location = useLocation();
  const [icons, setIcons] = useState<BrandIcon[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadIcons().then((next) => {
      if (!cancelled) setIcons(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const brandColors = palette.colors.filter((color) => color.property.startsWith("--brand-"));
  const surfaceColors = palette.colors.filter((color) => !color.property.startsWith("--brand-"));

  const copyDesignMd = () => {
    void navigator.clipboard
      .writeText(
        buildDesignMd(palette, {
          name: "Near Builders",
          logoHref: absoluteAssetUrl(BRAND_LOGO_SRC, location.href),
          description: "Brand tokens for nearbuilders.org",
        }),
      )
      .then(
        () => toast.success("Copied DESIGN.md"),
        () => toast.error("Could not copy DESIGN.md"),
      );
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <header className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">Identity</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
          Brand
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Logo, icons, colors, and type used on this site. Colors and the font come from the
          stylesheet. Icons come from the document head. Right-click the logo in the header or
          footer to open, copy, or download it. Copy a Stitch-format DESIGN.md for AI agents.
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-5" onClick={copyDesignMd}>
          <Copy />
          Copy to DESIGN.md
        </Button>
        <Button variant="outline" size="sm" className="mt-5 ml-2" asChild>
          <Link to="/brand/design-system">Design system</Link>
        </Button>
      </header>

      <section className="mt-12">
        <SectionHeading title="Logo" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="flex h-40 items-center justify-center rounded-xl border border-border bg-card p-6">
            <img src={BRAND_LOGO_SRC} alt="" className="h-16 w-auto" />
          </div>
          <div className="flex h-40 items-center justify-center rounded-xl border border-border bg-foreground p-6">
            <img src={BRAND_LOGO_SRC} alt="" className="h-16 w-auto" />
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() =>
            downloadAsset(BRAND_LOGO_SRC, filenameFromHref(BRAND_LOGO_SRC, "logo.png"))
          }
        >
          <Download />
          Download logo
        </Button>
      </section>

      <section className="mt-14">
        <SectionHeading title="Icons" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(icons ?? []).map((icon) => (
            <article key={icon.href} className="rounded-xl border border-border bg-card p-4">
              <div className="flex h-20 items-center justify-center rounded-lg border border-border bg-background">
                <img src={icon.href} alt="" className="h-10 w-10 object-contain" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-foreground">{icon.label}</h3>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{icon.href}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => downloadAsset(icon.href, filenameFromHref(icon.href, "icon"))}
              >
                <Download />
                Download
              </Button>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <SectionHeading title="Colors" />
        <ColorGroup title="Brand" colors={brandColors} />
        <ColorGroup title="Surfaces" colors={surfaceColors} />
      </section>

      <section className="mt-14">
        <SectionHeading title="Type" />
        <div
          className="mt-5 rounded-xl border border-border bg-card p-6"
          style={palette.fontFamily ? { fontFamily: palette.fontFamily } : undefined}
        >
          <p className="text-4xl font-black tracking-tight text-foreground">Near Builders</p>
          <p className="mt-4 text-base text-foreground">
            The quick brown fox jumps over the lazy dog.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">0123456789</p>
          <dl className="mt-6 space-y-2 border-t border-border pt-4 font-mono text-xs text-muted-foreground">
            <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
              <dt className="shrink-0 font-sans text-xs font-bold uppercase tracking-widest text-brand-accent">
                Family
              </dt>
              <dd className="min-w-0 break-words">{palette.fontFamily}</dd>
            </div>
            {palette.fontWeight && (
              <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                <dt className="shrink-0 font-sans text-xs font-bold uppercase tracking-widest text-brand-accent">
                  Weight
                </dt>
                <dd>{palette.fontWeight}</dd>
              </div>
            )}
          </dl>
        </div>
      </section>
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return <h2 className="text-xs font-bold uppercase tracking-widest text-brand-accent">{title}</h2>;
}

function ColorGroup({ title, colors }: { title: string; colors: BrandColor[] }) {
  if (colors.length === 0) return null;
  return (
    <div className="mt-5">
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {colors.map((color) => (
          <article key={color.property} className="rounded-xl border border-border bg-card p-4">
            <ColorSwatch color={color} />
            <h4 className="mt-3 text-sm font-bold text-foreground">{color.label}</h4>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{color.property}</p>
            <div className="mt-3 space-y-1">
              {color.light && color.dark && color.light === color.dark ? (
                <CopyValue label="Both themes" value={color.light} />
              ) : (
                <>
                  {color.light && <CopyValue label="Light" value={color.light} />}
                  {color.dark && <CopyValue label="Dark" value={color.dark} />}
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ColorSwatch({ color }: { color: BrandColor }) {
  const light = color.light ?? color.dark ?? "transparent";
  const dark = color.dark ?? color.light ?? "transparent";
  if (light === dark) {
    return (
      <div className="h-16 rounded-lg border border-border" style={{ backgroundColor: light }} />
    );
  }
  return (
    <div className="flex h-16 overflow-hidden rounded-lg border border-border">
      <div className="flex-1" style={{ backgroundColor: light }} />
      <div className="flex-1" style={{ backgroundColor: dark }} />
    </div>
  );
}

function CopyValue({ label, value }: { label: string; value: string }) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-3 rounded-md px-1 py-0.5 text-left hover:bg-muted"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(
          () => toast.success(`Copied ${value}`),
          () => toast.error("Could not copy color"),
        );
      }}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-xs text-foreground">{value}</span>
    </button>
  );
}

async function loadIcons(): Promise<BrandIcon[]> {
  const links = Array.from(
    document.querySelectorAll<HTMLLinkElement>(
      'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
    ),
  ).map((link) => ({ href: link.getAttribute("href") ?? "", rel: link.rel }));

  const manifestHref = document
    .querySelector<HTMLLinkElement>('link[rel="manifest"]')
    ?.getAttribute("href");
  let manifest: { href: string; icons?: Array<{ src?: string; sizes?: string }> } | null = null;
  if (manifestHref) {
    try {
      const response = await fetch(manifestHref);
      if (response.ok) {
        const json = (await response.json()) as {
          icons?: Array<{ src?: string; sizes?: string }>;
        };
        manifest = { href: manifestHref, icons: json.icons };
      }
    } catch {
      manifest = null;
    }
  }

  return collectBrandIcons(links, manifest);
}
