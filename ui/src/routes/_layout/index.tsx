import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  ExternalLink,
  Network,
  PanelsTopLeft,
  Rocket,
  Users,
} from "lucide-react";
import { useState } from "react";
import { type ApiClient, useApiClient } from "@/app";
import multiagencyLogo from "@/assets/multiagency-logo.svg";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_layout/")({
  loader: async ({ context }) => {
    await Promise.allSettled([
      context.queryClient.prefetchQuery(landingBuildersOptions(context.apiClient)),
      context.queryClient.prefetchQuery(networkStatsOptions(context.apiClient)),
    ]);
  },
  head: () => ({
    meta: [
      { title: "NEAR Builders — Build what's next, together" },
      {
        name: "description",
        content:
          "Find collaborators, discover open projects, and ship community-owned products with builders on NEAR.",
      },
    ],
  }),
  component: HomePage,
});

interface EcosystemLink {
  href: string;
  label: string;
  tagline: string;
  domain: string;
  logoSrc: string;
}

interface LandingBuilder {
  nearAccount: string;
  name: string;
}

interface NearSocialProfile {
  image?: {
    url?: string;
    ipfs_cid?: string;
  };
}

const ecosystemLinks: EcosystemLink[] = [
  {
    href: "https://ironclaw.com",
    label: "IronClaw",
    tagline: "Secure AI agent OS",
    domain: "ironclaw.com",
    logoSrc: "https://ironclaw.com/images/iron_claw_guy1.png",
  },
  {
    href: "https://nearcatalog.xyz",
    label: "NEAR Catalog",
    tagline: "Discover NEAR apps",
    domain: "nearcatalog.xyz",
    logoSrc: "https://nearcatalog.xyz/favicon.ico",
  },
  {
    href: "https://multiagency.ai",
    label: "MultiAgency",
    tagline: "Hire NEAR builders",
    domain: "multiagency.ai",
    logoSrc: multiagencyLogo,
  },
  {
    href: "https://nearlegion.com",
    label: "Join the Legion",
    tagline: "Prepare for NEARvana",
    domain: "nearlegion.com",
    logoSrc: "https://nearlegion.com/assets/brand/logo.webp",
  },
];

function landingBuildersOptions(apiClient: ApiClient) {
  return {
    queryKey: ["builders", "landing"] as const,
    queryFn: async (): Promise<LandingBuilder[]> => {
      const response = await apiClient.listBuilders({ limit: 3 });
      return response.data.map((builder) => ({
        nearAccount: builder.nearAccount,
        name: builder.name || builder.nearAccount,
      }));
    },
    staleTime: 60_000,
  };
}

function nearSocialProfileOptions(accountId: string) {
  return {
    queryKey: ["near-social-profile", accountId] as const,
    queryFn: async (): Promise<NearSocialProfile | null> => {
      const url = new URL("https://api.near.social/get");
      url.searchParams.set("keys", `${accountId}/profile/**`);
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = (await response.json()) as Record<
        string,
        { profile?: NearSocialProfile } | undefined
      >;
      return data[accountId]?.profile ?? null;
    },
    enabled: Boolean(accountId),
    staleTime: 5 * 60 * 1000,
  };
}

function networkStatsOptions(apiClient: ApiClient) {
  return {
    queryKey: ["network-stats"] as const,
    queryFn: async () => {
      const [builders, projects] = await Promise.all([
        apiClient.listBuilders({ limit: 1 }),
        apiClient.listProjects({ limit: 1 }),
      ]);

      return {
        builders: builders.meta.total,
        projects: projects.meta.total,
      };
    },
    staleTime: 60_000,
  };
}

function HomePage() {
  return (
    <div className="flex flex-col bg-background">
      <HeroSection />
      <PeopleBuildingSection />
      <ParticipationSection />
    </div>
  );
}

function HeroSection() {
  const apiClient = useApiClient();
  const { data: featuredBuilders = [] } = useQuery(landingBuildersOptions(apiClient));
  const { data: networkStats } = useQuery(networkStatsOptions(apiClient));

  return (
    <section className="overflow-hidden border-b border-border bg-muted/20">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:items-center lg:gap-14 lg:px-8 lg:py-24">
        <div className="relative z-10 max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs font-bold text-foreground shadow-xs">
            <span className="flex size-5 items-center justify-center rounded-full bg-brand-accent-light">
              <Network className="size-3.5 text-brand-accent" />
            </span>
            Open network for builders
          </div>
          <h1 className="text-5xl font-black leading-none tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Build what's <span className="block">next, </span>
            <span className="block text-brand-accent">together.</span>
          </h1>
          <p className="mt-7 max-w-lg text-lg font-medium leading-relaxed text-muted-foreground sm:text-xl">
            Find collaborators, discover open projects, and ship community-owned products with
            builders across NEAR.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-brand-accent px-7 text-brand-mint-foreground shadow-lg shadow-brand-accent-border hover:opacity-90"
            >
              <Link to="/builders" search={{ highlight: undefined }}>
                Explore builders
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full px-7">
              <Link to="/builders/add">Share your work</Link>
            </Button>
          </div>
          {featuredBuilders.length > 0 && (
            <div className="mt-9 flex items-center gap-4">
              <div className="flex -space-x-2">
                {featuredBuilders.map((builder) => (
                  <BuilderAvatar
                    key={builder.nearAccount}
                    builder={builder}
                    className="size-9 border-2 border-background"
                  />
                ))}
              </div>
              <p className="max-w-52 text-sm leading-snug text-muted-foreground">
                Join builders sharing their work in public on NEAR.
              </p>
            </div>
          )}
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-brand-accent-border bg-card p-5 shadow-xl shadow-brand-accent-border sm:p-7">
          <img
            src="/landing/network-paths.webp"
            alt=""
            className="pointer-events-none absolute inset-0 hidden size-full object-cover opacity-70 mix-blend-multiply sm:block"
          />
          <div className="relative">
            <div className="flex flex-nowrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-foreground">
                <Network className="size-4 text-brand-accent" />
                Builder network
              </div>
              <span className="whitespace-nowrap rounded-full border border-brand-accent bg-brand-accent px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-mint-foreground">
                Community curated
              </span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
              <Link
                to="/builders"
                search={{ highlight: undefined }}
                className="rounded-2xl border border-brand-accent-border bg-background/90 p-4 shadow-xs sm:p-5"
              >
                <p className="mt-4 text-4xl font-black leading-none tracking-tight tabular-nums text-foreground sm:text-5xl">
                  {networkStats?.builders ?? "—"}
                </p>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Builders
                </p>
              </Link>
              <Link
                to="/projects"
                className="rounded-2xl border border-brand-accent-border bg-background/90 p-4 shadow-xs sm:p-5"
              >
                <p className="mt-4 text-4xl font-black leading-none tracking-tight tabular-nums text-foreground sm:text-5xl">
                  {networkStats?.projects ?? "—"}
                </p>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Projects
                </p>
              </Link>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Connected across NEAR
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {ecosystemLinks.map((item) => (
                <EcosystemNetworkCard key={item.href} item={item} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BuilderAvatar({ builder, className }: { builder: LandingBuilder; className?: string }) {
  const { data: profile } = useQuery(nearSocialProfileOptions(builder.nearAccount));
  const [errored, setErrored] = useState(false);
  const imageUrl =
    profile?.image?.url ??
    (profile?.image?.ipfs_cid ? `https://ipfs.near.social/ipfs/${profile.image.ipfs_cid}` : null);
  const initials = builder.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-accent-light text-xs font-bold text-brand-accent",
        className,
      )}
      role="img"
      aria-label={`${builder.name} profile`}
    >
      {imageUrl && !errored && (
        <img
          src={imageUrl}
          alt=""
          onError={() => setErrored(true)}
          className="absolute inset-0 size-full object-cover"
          fetchPriority="high"
          loading="eager"
        />
      )}
      {(!imageUrl || errored) && <span aria-hidden="true">{initials}</span>}
    </div>
  );
}

function EcosystemNetworkCard({ item, className }: { item: EcosystemLink; className?: string }) {
  return (
    <a
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex h-20 w-full min-w-0 items-center gap-3 self-center rounded-xl border border-border bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-accent-border hover:shadow-md",
        className,
      )}
    >
      <LogoImage item={item} className="size-8 sm:size-10" />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-foreground">{item.label}</p>
        <p className="truncate text-[10px] text-muted-foreground">{item.tagline}</p>
      </div>
      <ExternalLink className="ml-auto hidden size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-brand-accent sm:block" />
    </a>
  );
}

function LogoImage({ item, className }: { item: EcosystemLink; className?: string }) {
  const [errored, setErrored] = useState(false);

  if (item.label === "MultiAgency") {
    return (
      <span
        className={cn(
          "block shrink-0 bg-foreground [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]",
          className,
        )}
        style={{
          maskImage: `url(${item.logoSrc})`,
          WebkitMaskImage: `url(${item.logoSrc})`,
        }}
        aria-hidden="true"
      />
    );
  }

  if (errored) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-brand-accent-light font-bold text-brand-accent",
          className,
        )}
        aria-hidden="true"
      >
        {item.label.slice(0, 1)}
      </div>
    );
  }

  return (
    <img
      src={item.logoSrc}
      alt=""
      onError={() => setErrored(true)}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

function PeopleBuildingSection() {
  return (
    <section className="border-y border-border bg-foreground py-16 text-background sm:py-20 lg:py-24">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-20 lg:px-8">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
            Your path through the network
          </p>
          <h2 className="mt-4 max-w-md text-4xl font-black leading-tight tracking-tight text-background sm:text-5xl">
            Start with an idea. Leave with momentum.
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-background/65 sm:text-lg">
            NEAR Builders helps the right people find each other, make their work visible, and keep
            shipping in public.
          </p>
          <Button
            asChild
            variant="outline"
            className="mt-8 rounded-full border-background/20 bg-background/10 text-background hover:bg-background hover:text-foreground"
          >
            <Link to="/builders" search={{ highlight: undefined }}>
              Enter the network
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="border-y border-background/20">
          <Link
            to="/builders"
            search={{ highlight: undefined }}
            className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4 border-b border-background/20 py-8 sm:items-center sm:gap-6"
          >
            <div className="flex flex-col items-center gap-3">
              <span className="font-mono text-xs font-bold text-brand-accent">01</span>
              <span className="flex size-11 items-center justify-center rounded-full bg-background/10 text-brand-accent sm:size-12">
                <Users className="size-5" />
              </span>
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight text-background">
                Find your people
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-background/60 sm:text-base">
                Discover approved builders by skill and location, then open the profiles that match
                what you want to make.
              </p>
            </div>
            <ArrowUpRight className="size-5 text-background/50 transition-all group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-brand-accent" />
          </Link>

          <Link
            to="/projects"
            className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4 border-b border-background/20 py-8 sm:items-center sm:gap-6"
          >
            <div className="flex flex-col items-center gap-3">
              <span className="font-mono text-xs font-bold text-brand-accent">02</span>
              <span className="flex size-11 items-center justify-center rounded-full bg-background/10 text-brand-accent sm:size-12">
                <PanelsTopLeft className="size-5" />
              </span>
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight text-background">
                Make the work visible
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-background/60 sm:text-base">
                Put an idea or active project in front of the network so collaborators can find a
                clear way in.
              </p>
            </div>
            <ArrowUpRight className="size-5 text-background/50 transition-all group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-brand-accent" />
          </Link>

          <Link
            to="/activity"
            className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4 py-8 sm:items-center sm:gap-6"
          >
            <div className="flex flex-col items-center gap-3">
              <span className="font-mono text-xs font-bold text-brand-accent">03</span>
              <span className="flex size-11 items-center justify-center rounded-full bg-background/10 text-brand-accent sm:size-12">
                <Rocket className="size-5" />
              </span>
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight text-background">Ship in public</h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-background/60 sm:text-base">
                Turn progress into a public signal, earn community support, and help the next
                collaboration start faster.
              </p>
            </div>
            <ArrowUpRight className="size-5 text-background/50 transition-all group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-brand-accent" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function ParticipationSection() {
  return (
    <section className="border-b border-brand-accent-border bg-brand-accent py-16 sm:py-20 lg:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-end lg:gap-20 lg:px-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-mint-foreground/65">
            Your move
          </p>
          <h2 className="mt-4 max-w-3xl text-4xl font-black leading-tight tracking-tight text-brand-mint-foreground sm:text-5xl lg:text-6xl">
            Bring what you're building into the open.
          </h2>
        </div>

        <div>
          <p className="max-w-xl text-base leading-relaxed text-brand-mint-foreground/75 sm:text-lg">
            Create a profile so collaborators can find you, or start a project and give the network
            a clear way to join.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-foreground px-6 text-background hover:bg-foreground/90"
            >
              <Link to="/builders/add">
                <Users className="size-4" />
                Create builder profile
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-brand-mint-foreground/25 bg-transparent px-6 text-brand-mint-foreground hover:bg-brand-mint-foreground/10 hover:text-brand-mint-foreground"
            >
              <Link to="/projects/new">
                Start a project
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
