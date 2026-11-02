import { Markdown } from "@/components/ui/markdown";

export function LegalDocument({
  title,
  updated,
  content,
  seeAlsoLabel,
  seeAlsoHref,
}: {
  title: string;
  updated: string;
  content: string;
  seeAlsoLabel: string;
  seeAlsoHref: string;
}) {
  return (
    <div className="flex min-h-page flex-col">
      <div className="flex-1">
        <article className="mx-auto w-full max-w-3xl px-4 py-10 animate-fade-in sm:px-6 sm:py-14">
          <h1 className="text-3xl font-black tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-xs text-muted-foreground">Last updated: {updated}</p>
          <div className="mt-6 rounded-xl border border-border bg-card p-6 sm:p-8">
            <Markdown content={content} />
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            See also:{" "}
            <a
              href={seeAlsoHref}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {seeAlsoLabel}
            </a>
          </p>
        </article>
      </div>
    </div>
  );
}
