import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, ExternalLink, FolderPlus, KeyRound, Send } from "lucide-react";
import type { ComponentType } from "react";
import { useApiClient } from "@/app";
import { GetInvolvedCard, GetInvolvedCardSkeleton } from "@/components/get-involved-card";
import { NearAiLogo, NearIntentsLogo, NearProtocolLogo } from "@/components/near-logos";
import { SiteLink } from "@/components/site-link";
import { Button } from "@/components/ui/button";
import { CommandCopy } from "@/components/ui/command-copy";
import {
  type BuildGetInvolvedAction,
  type BuildLink,
  type BuildTool,
  type BuildTopic,
  type BuildTopicLogo,
  buildGetInvolved,
  buildPage,
  buildTopics,
} from "@/lib/build-content";
import { featuredProjectsQueryOptions } from "@/lib/queries/featured-projects";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_layout/build")({
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery(
      featuredProjectsQueryOptions(context.apiClient, buildGetInvolved.featuredProjectSlugs),
    );
  },
  head: () => ({
    meta: [
      { title: buildPage.metaTitle },
      { name: "description", content: buildPage.metaDescription },
    ],
  }),
  component: BuildPage,
});

function BuildPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <header className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
          {buildPage.eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
          {buildPage.title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {buildPage.description}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="rounded-full bg-brand-accent px-7 text-brand-on-accent hover:opacity-90"
          >
            <Link to={buildPage.joinAction.to}>
              {buildPage.joinAction.label}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-full px-7">
            <Link to={buildPage.browseAction.to}>{buildPage.browseAction.label}</Link>
          </Button>
        </div>
      </header>

      <section className="mt-12">
        <SectionHeading title="Topics" />
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {buildTopics.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      </section>

      {buildTopics.flatMap((topic) =>
        topic.tools.map((tool) => <ToolSection key={tool.id} topic={topic} tool={tool} />),
      )}

      <GetInvolvedSection />
    </div>
  );
}

function GetInvolvedSection() {
  const apiClient = useApiClient();
  const { data: projects, isPending } = useQuery(
    featuredProjectsQueryOptions(apiClient, buildGetInvolved.featuredProjectSlugs),
  );

  return (
    <section id="get-involved" className="mt-14 scroll-mt-24">
      <SectionHeading title={buildGetInvolved.title} />
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
        {buildGetInvolved.description}
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isPending
          ? buildGetInvolved.featuredProjectSlugs.map((slug) => (
              <GetInvolvedCardSkeleton key={slug} />
            ))
          : projects?.map((project) => <GetInvolvedCard key={project.id} project={project} />)}
        {buildGetInvolved.actions.map((action) => (
          <GetInvolvedActionCard key={action.id} action={action} />
        ))}
      </div>
    </section>
  );
}

function GetInvolvedActionCard({ action }: { action: BuildGetInvolvedAction }) {
  const Icon = action.kind === "internal" ? FolderPlus : Send;

  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-6">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-accent-light text-brand-accent">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-3 text-lg font-black tracking-tight text-foreground">{action.label}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{action.description}</p>
      <div className="mt-auto pt-6">
        <Button asChild variant="outline" className="rounded-full">
          <SiteLink link={action}>
            {action.label}
            {action.kind === "internal" ? (
              <ArrowRight className="size-4" />
            ) : (
              <ExternalLink className="size-4" />
            )}
          </SiteLink>
        </Button>
      </div>
    </article>
  );
}

function SectionHeading({ title }: { title: string }) {
  return <h2 className="text-xs font-bold uppercase tracking-widest text-brand-accent">{title}</h2>;
}

const topicLogos: Record<
  BuildTopicLogo,
  { Logo: ComponentType<{ className?: string }>; className: string }
> = {
  "near-ai": { Logo: NearAiLogo, className: "h-8" },
  "near-intents": { Logo: NearIntentsLogo, className: "h-8" },
  "near-protocol": { Logo: NearProtocolLogo, className: "h-11" },
};

function TopicCard({ topic }: { topic: BuildTopic }) {
  const { Logo, className } = topicLogos[topic.logo];

  return (
    <article
      id={topic.id}
      className="flex scroll-mt-24 flex-col overflow-hidden rounded-xl border border-border bg-card"
    >
      <a
        href={topic.primaryLink.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={topic.primaryLink.label}
        className="flex h-36 items-center justify-center border-b border-border bg-muted/40 px-10 transition-colors hover:bg-muted"
      >
        <Logo className={cn("w-auto max-w-full text-foreground", className)} />
      </a>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl font-black tracking-tight text-foreground">{topic.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{topic.summary}</p>

        {topic.links.length > 0 && (
          <ul className="mt-4 space-y-2">
            {topic.links.map((link) => (
              <li key={link.href}>
                <ExternalLinkRow link={link} />
              </li>
            ))}
          </ul>
        )}

        {topic.tools.length > 0 && (
          <ul className="mt-4 space-y-2">
            {topic.tools.map((tool) => (
              <li key={tool.id}>
                <a
                  href={`#${tool.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground transition-colors hover:text-brand-accent"
                >
                  {tool.name}
                  <ArrowDown className="size-3.5" />
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto pt-6">
          <Button asChild variant="outline" className="w-full rounded-full">
            <a href={topic.primaryLink.href} target="_blank" rel="noopener noreferrer">
              {topic.primaryLink.label}
              <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>
      </div>
    </article>
  );
}

function ToolSection({ topic, tool }: { topic: BuildTopic; tool: BuildTool }) {
  return (
    <section id={tool.id} className="mt-14 scroll-mt-24">
      <SectionHeading title={topic.title} />
      <h3 className="mt-3 text-2xl font-black tracking-tight text-foreground">{tool.name}</h3>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
        {tool.summary}
      </p>

      <div className={cn("mt-5 grid gap-4", tool.access && "lg:grid-cols-2")}>
        <div
          className={cn(
            "grid content-start gap-3 sm:grid-cols-2",
            !tool.access && "lg:grid-cols-4",
          )}
        >
          {tool.links.map((link) => (
            <ExternalLinkCard key={link.href} link={link} />
          ))}
        </div>

        {tool.access && (
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-brand-accent" />
              <h4 className="text-sm font-bold text-foreground">{tool.access.title}</h4>
            </div>
            <ol className="mt-4 space-y-4">
              <li className="flex gap-3">
                <StepNumber value={1} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{tool.access.apiKeyStep}</p>
                  <Button asChild variant="outline" size="sm" className="mt-2 rounded-full">
                    <a href={tool.access.apiKey.href} target="_blank" rel="noopener noreferrer">
                      {tool.access.apiKey.label}
                      <ExternalLink className="size-3.5" />
                    </a>
                  </Button>
                </div>
              </li>
              <li className="flex gap-3">
                <StepNumber value={2} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{tool.access.baseUrlStep}</p>
                  <div className="mt-2">
                    <CommandCopy command={tool.access.baseUrl} />
                  </div>
                </div>
              </li>
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}

function StepNumber({ value }: { value: number }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-accent-light font-mono text-xs font-bold text-brand-accent">
      {value}
    </span>
  );
}

function displayHref(href: string) {
  const url = new URL(href);
  return `${url.host}${url.pathname}`.replace(/\/$/, "");
}

function ExternalLinkCard({ link }: { link: BuildLink }) {
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-w-0 flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand-accent-border"
    >
      <span className="flex items-center justify-between gap-2 text-sm font-bold text-foreground">
        {link.label}
        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-brand-accent" />
      </span>
      <span className="mt-1 truncate font-mono text-xs text-muted-foreground">
        {displayHref(link.href)}
      </span>
    </a>
  );
}

function ExternalLinkRow({ link }: { link: BuildLink }) {
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground transition-colors hover:text-brand-accent"
    >
      {link.label}
      <ExternalLink className="size-3.5" />
    </a>
  );
}
