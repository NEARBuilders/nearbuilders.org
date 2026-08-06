import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText, MessageSquare } from "lucide-react";
import { useApiClient } from "@/app";
import { Skeleton } from "@/components/ui/skeleton";

interface FiledIssue {
  url: string;
  title: string | null;
  filedAt: string;
}

interface FeedbackApplication {
  id: string;
  requestId: string;
  applicantNearAccount: string;
  note: string | null;
  status: "pending" | "selected" | "rejected" | "withdrawn";
  requestTitle: string;
  requestProjectTitle: string;
  requestTargetRepo: string;
  appliedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  filedIssues: FiledIssue[];
  submittedAt: string | null;
}

export function BuilderFeedbackContributions({ nearAccount }: { nearAccount: string }) {
  const apiClient = useApiClient();
  const query = useQuery({
    queryKey: ["feedback", "profile-contributions", nearAccount],
    queryFn: async () => {
      const result = (await apiClient.feedback.listFeedbackApplications({
        applicantNearAccount: nearAccount,
        limit: 50,
      })) as { data: FeedbackApplication[] };
      return result.data;
    },
    staleTime: 60_000,
  });

  const applications = query.data ?? [];
  const contributions = applications.filter(
    (a) => a.status === "selected" && a.filedIssues.length > 0,
  );

  if (query.isLoading) {
    return (
      <section className="mt-8">
        <h3 className="mb-3 text-sm font-bold text-foreground">Feedback rounds</h3>
        <Skeleton className="h-16 w-full rounded-xl" />
      </section>
    );
  }

  if (contributions.length === 0) return null;

  const issueCount = contributions.reduce((acc, a) => acc + a.filedIssues.length, 0);

  return (
    <section className="mt-8">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
        Feedback rounds
        <span className="rounded-full bg-brand-accent-light px-2 py-0.5 text-[11px] font-semibold text-brand-accent">
          {contributions.length}
        </span>
        <span className="ml-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          {issueCount} {issueCount === 1 ? "issue filed" : "issues filed"}
        </span>
      </h3>
      <div className="flex flex-col overflow-hidden rounded-xl border border-border">
        {contributions.map((contribution) => (
          <ContributionRow key={contribution.id} application={contribution} />
        ))}
      </div>
    </section>
  );
}

function ContributionRow({ application }: { application: FeedbackApplication }) {
  return (
    <div className="border-b border-border bg-card px-4 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex size-4 items-center justify-center rounded-full bg-brand-accent-light text-brand-accent">
              <MessageSquare className="size-2.5" />
            </span>
            <span className="font-semibold text-foreground">{application.requestProjectTitle}</span>
            <span>·</span>
            <span className="font-mono">{application.requestTargetRepo}</span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-sm font-semibold text-foreground">
            {application.requestTitle}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-brand-accent-border bg-brand-accent-light px-2 py-0.5 text-[10px] font-bold text-brand-accent">
          {application.filedIssues.length} filed
        </span>
      </div>
      <ul className="mt-2 space-y-1 pl-6">
        {application.filedIssues.map((issue) => (
          <li
            key={issue.url}
            className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
          >
            <FileText className="size-3 shrink-0" />
            <a
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate hover:text-brand-accent hover:underline"
            >
              {issue.title || issue.url.replace(/^https:\/\/github\.com\//, "")}
            </a>
            <ExternalLink className="size-2.5 shrink-0 opacity-50" />
          </li>
        ))}
      </ul>
    </div>
  );
}
