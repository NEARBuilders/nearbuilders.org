import { Link } from "@tanstack/react-router";
import { ExternalLink, FolderKanban, Globe } from "lucide-react";
import { GithubIcon, isGithubUrl, KindBadge } from "@/components/project-directory-item";
import type { ProjectApprovalActivityPayload } from "@/lib/project-activity";

export function ProjectApprovalActivity({ payload }: { payload: ProjectApprovalActivityPayload }) {
  return (
    <div className="mt-3 rounded-xl border border-border bg-background/40 p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <FolderKanban className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground">{payload.projectTitle}</h3>
            <KindBadge kind={payload.projectKind} compact />
          </div>
          {payload.projectDescription && (
            <p className="mt-1 text-sm text-muted-foreground">{payload.projectDescription}</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        {payload.repositoryUrl && (
          <a
            href={payload.repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-foreground hover:text-brand-accent"
          >
            {isGithubUrl(payload.repositoryUrl) ? <GithubIcon /> : <Globe className="size-3" />}
            Repository
            <ExternalLink className="size-3" />
          </a>
        )}
        <Link
          to="/projects/$kind/$slug"
          params={{ kind: payload.projectKind, slug: payload.projectSlug }}
          className="inline-flex items-center gap-1 font-medium text-foreground hover:text-brand-accent"
        >
          View project
          <ExternalLink className="size-3" />
        </Link>
      </div>
    </div>
  );
}
