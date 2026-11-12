import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, ExternalLink } from "lucide-react";
import { ProjectVisual } from "@/components/project-visual";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  isInternalProgramUrl,
  PROGRAM_TYPE_LABELS,
  type Program,
  programDateLabel,
} from "@/lib/queries/programs";

export function ProgramCta({ program }: { program: Pick<Program, "ctaLabel" | "ctaUrl"> }) {
  const internal = isInternalProgramUrl(program.ctaUrl);
  return (
    <Button asChild className="rounded-full bg-brand-accent text-brand-on-accent hover:opacity-90">
      <a
        href={program.ctaUrl}
        {...(internal ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      >
        {program.ctaLabel}
        {internal ? <ArrowRight className="size-4" /> : <ExternalLink className="size-4" />}
      </a>
    </Button>
  );
}

export function ProgramCard({
  id,
  program,
  showProject = true,
}: {
  id?: string;
  program: Program;
  showProject?: boolean;
}) {
  const closed = program.state === "closed";

  return (
    <article
      id={id}
      className="flex min-w-0 scroll-mt-24 flex-col rounded-xl border border-border bg-card p-6"
    >
      {showProject && (
        <div className="flex items-center gap-3">
          <ProjectVisual
            project={{
              ownerId: program.project.ownerId,
              imageUrl: program.project.logoUrl,
              title: program.project.title,
            }}
            className="size-10 rounded-lg"
          />
          <Link
            to="/projects/$kind/$slug"
            params={{ kind: program.project.kind, slug: program.project.slug }}
            className="min-w-0 truncate text-sm font-bold text-foreground transition-colors hover:text-brand-accent"
          >
            {program.project.title}
          </Link>
        </div>
      )}
      <div className={showProject ? "mt-4" : undefined}>
        <Badge variant="secondary">{PROGRAM_TYPE_LABELS[program.type]}</Badge>
      </div>
      <h3 className="mt-3 text-lg font-black tracking-tight text-foreground">{program.title}</h3>
      {program.summary && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{program.summary}</p>
      )}
      <dl className="mt-3 space-y-1 text-sm">
        {program.rewards && (
          <div className="flex gap-2">
            <dt className="sr-only">Rewards</dt>
            <dd className="font-semibold text-foreground">{program.rewards}</dd>
          </div>
        )}
        {program.eligibility && (
          <div className="flex gap-2">
            <dt className="text-muted-foreground">For</dt>
            <dd className="text-muted-foreground">{program.eligibility}</dd>
          </div>
        )}
      </dl>
      <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <CalendarClock className="size-3.5" />
        {closed ? "Closed" : programDateLabel(program)}
      </p>
      <div className="mt-auto flex flex-wrap gap-2 pt-6">
        {!closed && <ProgramCta program={program} />}
        {showProject && (
          <Button asChild variant="outline" className="rounded-full">
            <Link
              to="/projects/$kind/$slug"
              params={{ kind: program.project.kind, slug: program.project.slug }}
            >
              View project
            </Link>
          </Button>
        )}
      </div>
    </article>
  );
}

export function ProgramCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-lg" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="mt-4 h-5 w-16 rounded-full" />
      <Skeleton className="mt-3 h-5 w-2/3" />
      <Skeleton className="mt-3 h-3 w-full" />
      <Skeleton className="mt-6 h-9 w-32 rounded-full" />
    </div>
  );
}
