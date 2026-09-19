import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";
import { useApiClient } from "@/app";
import { Input } from "@/components";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type CollaboratorDraft = {
  handle: string;
  status?: "pending" | "accepted" | "declined";
};

export function CollaboratorPicker({
  value,
  onChange,
  excludeOwnerId,
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  excludeOwnerId?: string;
  disabled?: boolean;
}) {
  const apiClient = useApiClient();
  const [search, setSearch] = useState("");

  const searchQuery = useQuery({
    queryKey: ["builders-search", search],
    queryFn: () => apiClient.listBuilders({ search: search.trim() || undefined, limit: 8 }),
    enabled: search.trim().length >= 2 && !disabled,
    staleTime: 15_000,
  });

  const results = searchQuery.data?.data ?? [];
  const normalized = (h: string) => h.trim().toLowerCase();
  const selected = new Set(value.map(normalized));

  const addHandle = (handle: string) => {
    const trimmed = handle.trim();
    if (!trimmed || disabled) return;
    if (excludeOwnerId && normalized(trimmed) === normalized(excludeOwnerId)) return;
    if (selected.has(normalized(trimmed))) return;
    if (value.length >= 20) return;
    onChange([...value, trimmed]);
    setSearch("");
  };

  const removeHandle = (handle: string) => {
    onChange(value.filter((v) => normalized(v) !== normalized(handle)));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {value.length === 0 && (
          <span className="text-xs text-muted-foreground">No collaborators yet.</span>
        )}
        {value.map((handle) => (
          <Badge key={handle} variant="secondary" className="gap-1 py-1 pl-2 pr-1">
            <span className="font-mono">{handle}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeHandle(handle)}
              aria-label={`Remove ${handle}`}
              className="inline-flex size-5 items-center justify-center rounded-full hover:bg-muted-foreground/20 disabled:opacity-50"
            >
              <X size={12} />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={search}
        disabled={disabled}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (search.trim()) addHandle(search);
          }
        }}
        placeholder="Search builder handles, e.g. alice.near"
        className={cn("h-11 font-mono text-sm")}
        aria-label="Search collaborators"
      />
      {search.trim().length >= 2 && (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          {searchQuery.isLoading && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
          )}
          {!searchQuery.isLoading && results.length === 0 && (
            <button
              type="button"
              onClick={() => addHandle(search)}
              className="block w-full px-3 py-2 text-left text-xs hover:bg-muted"
            >
              Invite <span className="font-mono font-semibold">{search.trim()}</span> (not in
              directory yet)
            </button>
          )}
          {results
            .filter((b) => !selected.has(normalized(b.nearAccount)))
            .filter(
              (b) => !excludeOwnerId || normalized(b.nearAccount) !== normalized(excludeOwnerId),
            )
            .map((b) => (
              <button
                key={b.nearAccount}
                type="button"
                onClick={() => addHandle(b.nearAccount)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block truncate font-mono text-xs font-semibold text-foreground">
                    {b.nearAccount}
                  </span>
                  {b.name && (
                    <span className="block truncate text-xs text-muted-foreground">{b.name}</span>
                  )}
                </span>
                <span className="shrink-0 text-xs font-semibold text-brand-accent">Add</span>
              </button>
            ))}
        </div>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Invited builders get a notification and can accept or decline. Accepted projects appear on
        their profile and they can edit.
      </p>
    </div>
  );
}

export function CollaboratorStatusBadge({ status }: { status: string }) {
  const variant =
    status === "accepted" ? "success" : status === "pending" ? "secondary" : "outline";
  return <Badge variant={variant as "success" | "secondary" | "outline"}>{status}</Badge>;
}
