import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CatalogClaimActivityPayload } from "@/lib/catalog-activity";

export function CatalogClaimActivity({ payload }: { payload: CatalogClaimActivityPayload }) {
  return (
    <div className="mt-3 rounded-xl border border-border bg-background/40 p-4">
      <div className="flex items-start gap-3">
        {payload.projectImageUrl ? (
          <img
            src={payload.projectImageUrl}
            alt=""
            className="size-14 shrink-0 rounded-lg border border-border object-cover"
          />
        ) : (
          <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-secondary font-semibold text-secondary-foreground">
            {payload.projectName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-foreground">{payload.projectName}</h3>
          {payload.projectTagline && (
            <p className="mt-1 text-sm text-muted-foreground">{payload.projectTagline}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {payload.roles.map((role) => (
              <Badge key={role} variant="secondary">
                {role}
              </Badge>
            ))}
          </div>
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
            Repository
            <ExternalLink className="size-3" />
          </a>
        )}
        <a
          href={payload.catalogUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-foreground hover:text-brand-accent"
        >
          NEAR Catalog
          <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  );
}
