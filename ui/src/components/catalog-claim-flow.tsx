import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, RefreshCw, Search } from "lucide-react";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { ApiClient } from "@/app";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { canResubmitCatalogClaim } from "@/lib/catalog-claims";
import {
  catalogClaimProposalsQueryOptions,
  catalogProjectQueryOptions,
} from "@/lib/queries/catalog";

const CATALOG_CLAIM_ROLES = [
  "Founder",
  "Developer",
  "Designer",
  "Product",
  "Content",
  "Marketing",
  "Community",
  "Contributor",
] as const;

type CatalogProject = Awaited<ReturnType<ApiClient["getCatalogProject"]>>["data"];
type CatalogClaimProposal = Awaited<
  ReturnType<ApiClient["getMyCatalogClaimProposals"]>
>["data"][number];
type CatalogClaimApiClient = Pick<
  ApiClient,
  | "getCatalogProject"
  | "getMyCatalogClaimProposals"
  | "searchCatalogProjects"
  | "submitCatalogClaimProposal"
>;

function normalizeClaimRoles(predefinedRoles: string[], customRoles: string) {
  const custom = customRoles.split(",").map((role) => role.trim());
  if (custom.some((role) => role.length > 50)) {
    return { roles: [], error: "Each role must be 50 characters or fewer." };
  }

  const normalized = new Map<string, string>();
  for (const role of [...predefinedRoles, ...custom]) {
    const value = role.trim();
    const key = value.toLowerCase();
    if (value && !normalized.has(key)) normalized.set(key, value);
  }
  const roles = Array.from(normalized.values());
  if (roles.length === 0) return { roles, error: "Select or add at least one role." };
  if (roles.length > 16) return { roles, error: "Choose no more than 16 roles." };
  return { roles, error: null };
}

function fallbackProject(slug: string): CatalogProject {
  return {
    slug,
    projectRef: `nearcatalog:${slug}`,
    name: slug,
    tagline: null,
    description: null,
    imageUrl: null,
    repositoryUrl: null,
    catalogUrl: `https://nearcatalog.xyz/project/${slug}`,
    tags: [],
    phase: null,
    status: null,
  };
}

function createIdempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : nanoid();
}

function CatalogProjectPreview({ project }: { project: CatalogProject }) {
  return (
    <div className="flex gap-4 rounded-xl border border-border bg-muted/30 p-4">
      {project.imageUrl ? (
        <img
          src={project.imageUrl}
          alt=""
          className="size-16 shrink-0 rounded-lg border border-border object-cover"
        />
      ) : (
        <div className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-xl font-bold text-secondary-foreground">
          {project.name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{project.name}</p>
        {project.tagline && <p className="mt-1 text-sm text-muted-foreground">{project.tagline}</p>}
        {project.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {project.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="rounded-full px-2 py-0.5">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function statusVariant(status: CatalogClaimProposal["status"]) {
  if (status === "approved") return "success" as const;
  if (status === "rejected") return "destructive" as const;
  if (status === "revoked") return "outline" as const;
  return "secondary" as const;
}

function proposalSearchLabel(status: CatalogClaimProposal["status"]) {
  if (status === "pending") return "Already pending";
  if (status === "approved") return "Already approved";
  return "Use resubmit";
}

function proposalConflictMessage(status: CatalogClaimProposal["status"]) {
  if (status === "pending") return "A contribution proposal for this project is already pending.";
  if (status === "approved") return "Your contribution to this project is already approved.";
  if (status === "rejected") return "Use Edit and resubmit on the rejected proposal.";
  return "Use Resubmit on the revoked proposal.";
}

function CatalogClaimProposalCard({
  apiClient,
  proposal,
  onEdit,
}: {
  apiClient: CatalogClaimApiClient;
  proposal: CatalogClaimProposal;
  onEdit: (proposal: CatalogClaimProposal, project: CatalogProject) => void;
}) {
  const projectQuery = useQuery({
    ...catalogProjectQueryOptions(apiClient, proposal.projectSlug),
  });
  const project = projectQuery.data?.data ?? fallbackProject(proposal.projectSlug);

  if (projectQuery.isPending) {
    return (
      <article className="rounded-xl border border-border bg-card p-5" aria-label="Loading project">
        <div className="flex items-center gap-3">
          <Skeleton className="size-11 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {project.imageUrl ? (
            <img
              src={project.imageUrl}
              alt=""
              className="size-11 shrink-0 rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary font-semibold text-secondary-foreground">
              {project.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-foreground">{project.name}</h3>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {proposal.projectSlug}
            </p>
          </div>
        </div>
        <Badge variant={statusVariant(proposal.status)} className="capitalize">
          {proposal.status}
        </Badge>
      </div>

      {projectQuery.isError && (
        <p className="mt-3 text-xs text-muted-foreground">
          Current Catalog details are unavailable; showing the stored project slug.
        </p>
      )}
      <p className="mt-4 text-xs font-semibold text-foreground">Current roles</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {proposal.roles.map((role) => (
          <Badge key={role} variant="secondary" className="rounded-full px-2 py-0.5">
            {role}
          </Badge>
        ))}
      </div>
      {proposal.status === "rejected" && proposal.rejectionReason && (
        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-xs font-semibold text-foreground">Rejection reason</p>
          <p className="mt-1 text-sm text-muted-foreground">{proposal.rejectionReason}</p>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {proposal.submissionCount} revision{proposal.submissionCount === 1 ? "" : "s"} · Updated{" "}
          {new Date(proposal.updatedAt).toLocaleDateString()}
        </span>
        {canResubmitCatalogClaim(proposal.status) && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onEdit(proposal, project)}
          >
            {proposal.status === "rejected" ? "Edit and resubmit" : "Resubmit"}
          </Button>
        )}
      </div>
    </article>
  );
}

export function CatalogClaimFlow({ apiClient }: { apiClient: CatalogClaimApiClient }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedProject, setSelectedProject] = useState<CatalogProject | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [customRoles, setCustomRoles] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    const value = search.trim();
    const timer = window.setTimeout(() => setDebouncedSearch(value), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const roleSignature = selectedRoles.join("\u0000");
  useEffect(() => {
    idempotencyKey.current = null;
  }, [selectedProject?.slug, roleSignature, customRoles]);

  const searchQuery = useQuery({
    queryKey: ["catalog-project-search", debouncedSearch],
    queryFn: () => apiClient.searchCatalogProjects({ query: debouncedSearch, limit: 20 }),
    enabled: debouncedSearch.length > 0,
    retry: false,
  });

  const proposalsQuery = useQuery(catalogClaimProposalsQueryOptions(apiClient, queryClient));

  const normalizedRoles = useMemo(
    () => normalizeClaimRoles(selectedRoles, customRoles),
    [selectedRoles, customRoles],
  );
  const proposalsByProject = useMemo(
    () =>
      new Map(
        (proposalsQuery.data?.data ?? []).map((proposal) => [proposal.projectSlug, proposal]),
      ),
    [proposalsQuery.data?.data],
  );

  const submitMutation = useMutation({
    mutationFn: (input: { projectSlug: string; roles: string[]; idempotencyKey: string }) =>
      apiClient.submitCatalogClaimProposal(input),
    onSuccess: async () => {
      idempotencyKey.current = null;
      setSearch("");
      setDebouncedSearch("");
      setSelectedProject(null);
      setSelectedRoles([]);
      setCustomRoles("");
      setValidationError(null);
      setEditingProposalId(null);
      await queryClient.invalidateQueries({ queryKey: ["catalog-claim-proposals"] });
      toast.success("Contribution submitted for review");
    },
    onError: (error: Error) => toast.error(error.message || "Could not submit contribution"),
  });

  const toggleRole = (role: string) => {
    setValidationError(null);
    setSelectedRoles((current) =>
      current.includes(role) ? current.filter((value) => value !== role) : [...current, role],
    );
  };

  const editProposal = (proposal: CatalogClaimProposal, project: CatalogProject) => {
    const predefinedByKey = new Map(
      CATALOG_CLAIM_ROLES.map((role) => [role.toLowerCase(), role] as const),
    );
    const predefined: string[] = [];
    const custom: string[] = [];
    for (const role of proposal.roles) {
      const known = predefinedByKey.get(role.toLowerCase());
      if (known && !predefined.includes(known)) predefined.push(known);
      else custom.push(role);
    }
    setSelectedProject(project);
    setSearch("");
    setDebouncedSearch("");
    setSelectedRoles(predefined);
    setCustomRoles(custom.join(", "));
    setValidationError(null);
    setEditingProposalId(proposal.id);
  };

  const isDebouncing = search.trim().length > 0 && search.trim() !== debouncedSearch;
  const searchResults = searchQuery.data?.data ?? [];

  return (
    <div className="space-y-10">
      <form
        className="space-y-6 rounded-2xl border border-border bg-card p-6 sm:p-8"
        onSubmit={(event) => {
          event.preventDefault();
          if (!selectedProject) {
            setValidationError("Select a Catalog project.");
            return;
          }
          const existingProposal = proposalsByProject.get(selectedProject.slug);
          if (
            existingProposal &&
            !(
              canResubmitCatalogClaim(existingProposal.status) &&
              editingProposalId === existingProposal.id
            )
          ) {
            setValidationError(proposalConflictMessage(existingProposal.status));
            return;
          }
          if (normalizedRoles.error) {
            setValidationError(normalizedRoles.error);
            return;
          }
          const key = idempotencyKey.current ?? createIdempotencyKey();
          idempotencyKey.current = key;
          submitMutation.mutate({
            projectSlug: selectedProject.slug,
            roles: normalizedRoles.roles,
            idempotencyKey: key,
          });
        }}
      >
        <div>
          <h2 className="text-xl font-bold text-foreground">Add a project contribution</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose an active NEAR Catalog project and describe how you contributed.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="catalog-project-search">Search NEAR Catalog</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="catalog-project-search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelectedProject(null);
                setEditingProposalId(null);
                setValidationError(null);
              }}
              placeholder="Search by project name"
              className="pl-9"
              autoComplete="off"
            />
          </div>

          {!selectedProject && (isDebouncing || searchQuery.isFetching) && (
            <div
              role="status"
              className="flex items-center gap-2 py-3 text-sm text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" />
              Searching Catalog…
            </div>
          )}
          {!selectedProject && !isDebouncing && searchQuery.isError && (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 p-3">
              <p role="alert" className="text-sm text-muted-foreground">
                NEAR Catalog search is unavailable.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => searchQuery.refetch()}
              >
                <RefreshCw className="size-4" />
                Retry
              </Button>
            </div>
          )}
          {!selectedProject &&
            !isDebouncing &&
            searchQuery.isSuccess &&
            searchResults.length === 0 && (
              <p className="py-3 text-sm text-muted-foreground">
                No claimable active Catalog projects match this search.
              </p>
            )}
          {!selectedProject && !isDebouncing && searchResults.length > 0 && (
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-border p-2">
              {searchResults.map((project) => {
                const existingProposal = proposalsByProject.get(project.slug);
                return (
                  <button
                    key={project.slug}
                    type="button"
                    disabled={Boolean(existingProposal)}
                    onClick={() => {
                      setSelectedProject(project);
                      setSearch("");
                      setDebouncedSearch("");
                      setValidationError(null);
                      setEditingProposalId(null);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border border-transparent p-3 text-left transition-colors hover:border-border hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {project.imageUrl ? (
                      <img
                        src={project.imageUrl}
                        alt=""
                        className="size-10 shrink-0 rounded-md border border-border object-cover"
                      />
                    ) : (
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary font-semibold text-secondary-foreground">
                        {project.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {project.name}
                      </span>
                      {project.tagline && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {project.tagline}
                        </span>
                      )}
                    </span>
                    {existingProposal ? (
                      <Badge variant={statusVariant(existingProposal.status)}>
                        {proposalSearchLabel(existingProposal.status)}
                      </Badge>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedProject && <CatalogProjectPreview project={selectedProject} />}

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-foreground">Your roles</legend>
          <div className="flex flex-wrap gap-2">
            {CATALOG_CLAIM_ROLES.map((role) => {
              const selected = selectedRoles.includes(role);
              return (
                <Button
                  key={role}
                  type="button"
                  size="sm"
                  variant={selected ? "secondary" : "outline"}
                  aria-pressed={selected}
                  onClick={() => toggleRole(role)}
                >
                  {selected && <Check className="size-4" />}
                  {role}
                </Button>
              );
            })}
          </div>
          <div className="space-y-2">
            <Label htmlFor="catalog-custom-roles">Custom roles</Label>
            <Input
              id="catalog-custom-roles"
              value={customRoles}
              onChange={(event) => {
                setCustomRoles(event.target.value);
                setValidationError(null);
              }}
              placeholder="Research, Documentation"
            />
            <p className="text-xs text-muted-foreground">
              Separate custom roles with commas. Up to 16 roles total.
            </p>
          </div>
        </fieldset>

        {validationError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {validationError}
          </p>
        )}
        {submitMutation.isError && (
          <p role="alert" className="text-sm text-destructive">
            {submitMutation.error.message || "Could not submit contribution."}
          </p>
        )}
        <Button type="submit" disabled={submitMutation.isPending} className="rounded-full px-6">
          {submitMutation.isPending && <Loader2 className="size-4 animate-spin" />}
          {submitMutation.isPending ? "Submitting…" : "Submit for review"}
        </Button>
      </form>

      <section aria-labelledby="catalog-claim-status-heading" className="space-y-4">
        <div>
          <h2 id="catalog-claim-status-heading" className="text-xl font-bold text-foreground">
            Contribution proposal status
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track reviews and update rejected or revoked submissions.
          </p>
        </div>
        {proposalsQuery.isLoading && (
          <div role="status" className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading contribution proposals…
          </div>
        )}
        {proposalsQuery.isError && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
            <p role="alert" className="text-sm text-muted-foreground">
              Could not load contribution proposals.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => proposalsQuery.refetch()}
            >
              <RefreshCw className="size-4" />
              Retry
            </Button>
          </div>
        )}
        {proposalsQuery.isSuccess && proposalsQuery.data.data.length === 0 && (
          <p className="rounded-xl border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
            No project contribution proposals yet.
          </p>
        )}
        {proposalsQuery.data?.data.map((proposal) => (
          <CatalogClaimProposalCard
            key={proposal.id}
            apiClient={apiClient}
            proposal={proposal}
            onEdit={editProposal}
          />
        ))}
      </section>
    </div>
  );
}
