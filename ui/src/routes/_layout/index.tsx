import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ExternalLink } from "lucide-react";
import multiagencyLogo from "@/assets/multiagency-logo.svg";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_layout/")({
  head: () => ({
    meta: [
      { title: "NEAR Builders — The builder's fastest path to market" },
      {
        name: "description",
        content:
          "An open platform for builders on NEAR. Find collaborators, share projects, and build the open web together.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex flex-col">
      <HeroSection />
      <HighlightSection />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-background">
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.07] dark:opacity-[0.12]"
          style={{
            background: "radial-gradient(circle, var(--brand-cyan) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full opacity-[0.05] dark:opacity-[0.08]"
          style={{
            background: "radial-gradient(circle, var(--brand-green) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-24 pb-20 sm:pt-32 sm:pb-28">
        <div className="max-w-4xl">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-none tracking-tight text-foreground mb-6">
            The builder's
            <br />
            <span className="text-brand-green">fastest path</span>
            <br />
            to market.
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed font-medium">
            An open-source platform for builders on NEAR. Find collaborators, discover projects, and
            ship community-owned apps — without asking anyone's permission.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              asChild
              size="lg"
              className="rounded-full text-base font-bold px-8 h-14 bg-brand-green hover:bg-brand-green/90 text-black shadow-lg shadow-brand-green/20 transition-all hover:scale-105 hover:shadow-xl hover:shadow-brand-green/30"
            >
              <Link to="/builders">
                Find Builders
                <ArrowRight size={18} />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full text-base font-bold px-8 h-14 border-border hover:border-foreground transition-all"
            >
              <Link to="/projects">Browse Projects</Link>
            </Button>
          </div>

          <EcosystemStrip />
        </div>
      </div>
    </section>
  );
}

interface EcosystemLink {
  href: string;
  label: string;
  tagline: string;
  domain: string;
  mascot?: true;
  legion?: true;
  multiagency?: true;
  logoSrc?: string;
}

const ecosystemLinks: EcosystemLink[] = [
  {
    href: "https://ironclaw.com",
    label: "IronClaw",
    tagline: "Secure AI agent OS",
    domain: "ironclaw.com",
    mascot: true,
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
    tagline: "Hire Near Builders",
    domain: "multiagency.ai",
    logoSrc: multiagencyLogo,
    multiagency: true,
  },
  {
    href: "https://nearlegion.com",
    label: "Join the Legion",
    tagline: "Prepare for NEARvana",
    domain: "nearlegion.com",
    logoSrc: "https://nearlegion.com/assets/brand/logo.webp",
    legion: true,
  },
];

function EcosystemStrip() {
  return (
    <div className="mt-12">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
        Explore the ecosystem
      </p>
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ecosystemLinks.map((item) => {
          if (item.mascot) {
            return (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex-none w-[152px] snap-start rounded-lg border border-slate-700 bg-slate-900 p-4 pt-3 flex flex-col items-center text-center hover:border-slate-500 hover:shadow-lg transition-all duration-200 overflow-hidden"
              >
                <ExternalLink
                  size={10}
                  className="absolute top-2.5 right-2.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity"
                />
                <img
                  src="https://ironclaw.com/images/iron_claw_guy1.png"
                  alt="IronClaw mascot"
                  className="size-10 object-contain mb-3 group-hover:-translate-y-0.5 transition-transform duration-200"
                />
                <span className="text-sm font-bold text-white leading-tight">{item.label}</span>
                <span className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                  {item.tagline}
                </span>
                <span className="text-[10px] text-slate-600 mt-auto pt-1.5">{item.domain}</span>
              </a>
            );
          }

          if (item.legion) {
            return (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex-none w-[152px] snap-start rounded-lg border border-brand-green/40 bg-brand-green/5 p-4 flex flex-col items-center text-center hover:border-brand-green hover:bg-brand-green/10 hover:shadow-lg hover:shadow-brand-green/10 transition-all duration-200"
              >
                <ExternalLink
                  size={10}
                  className="absolute top-2.5 right-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                />
                {item.logoSrc ? (
                  <img
                    src={item.logoSrc}
                    alt={item.label}
                    className="size-10 object-contain mb-3 group-hover:-translate-y-0.5 transition-transform duration-200"
                  />
                ) : (
                  <div className="size-10 rounded-md bg-brand-green/15 flex items-center justify-center mb-3">
                    <span className="text-brand-green font-bold text-sm">{item.label[0]}</span>
                  </div>
                )}
                <span className="text-sm font-bold text-foreground leading-tight">
                  {item.label}
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                  {item.tagline}
                </span>
                <span className="text-[10px] text-brand-green/60 mt-auto pt-1.5">
                  {item.domain}
                </span>
              </a>
            );
          }

          if (item.multiagency) {
            return (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex-none w-[152px] snap-start rounded-lg border border-yellow-400/40 bg-yellow-400/5 p-4 flex flex-col items-center text-center hover:border-yellow-400 hover:bg-yellow-400/10 hover:shadow-lg hover:shadow-yellow-400/10 transition-all duration-200"
              >
                <ExternalLink
                  size={10}
                  className="absolute top-2.5 right-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                />
                {item.logoSrc ? (
                  <img
                    src={item.logoSrc}
                    alt={item.label}
                    className="size-10 object-contain mb-3 group-hover:-translate-y-0.5 transition-transform duration-200"
                  />
                ) : (
                  <div className="size-10 rounded-md bg-yellow-400/15 flex items-center justify-center mb-3">
                    <span className="text-yellow-400 font-bold text-sm">{item.label[0]}</span>
                  </div>
                )}
                <span className="text-sm font-bold text-foreground leading-tight">
                  {item.label}
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                  {item.tagline}
                </span>
                <span className="text-[10px] text-yellow-400/60 mt-auto pt-1.5">{item.domain}</span>
              </a>
            );
          }

          return (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex-none w-[152px] snap-start rounded-lg border border-border bg-card p-4 flex flex-col items-center text-center hover:border-brand-cyan/40 hover:shadow-md transition-all duration-200"
            >
              <ExternalLink
                size={10}
                className="absolute top-2.5 right-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              />
              {item.logoSrc ? (
                <img
                  src={item.logoSrc}
                  alt={item.label}
                  className="size-10 object-contain mb-3 group-hover:-translate-y-0.5 transition-transform duration-200"
                />
              ) : (
                <div className="size-10 rounded-md bg-secondary flex items-center justify-center mb-3">
                  <span className="text-muted-foreground group-hover:text-brand-cyan transition-colors font-bold text-sm">
                    {item.label[0]}
                  </span>
                </div>
              )}
              <span className="text-sm font-bold text-foreground leading-tight">{item.label}</span>
              <span className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                {item.tagline}
              </span>
              <span className="text-[10px] text-muted-foreground/50 mt-auto pt-1.5">
                {item.domain}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function HighlightSection() {
  return (
    <section className="bg-secondary border-y border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-3xl">
          <p className="text-2xl sm:text-3xl font-bold text-foreground leading-snug">
            The open web is possible when builders work together. This is where that happens — find
            your collaborators, ship your ideas.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <Button asChild size="lg" className="rounded-full px-8 h-12">
              <Link to="/builders">Meet the builders</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full px-8 h-12">
              <Link to="/projects">See what's being built</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
