import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Building2, Check, Mail, Pencil, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  type ApiClient,
  type Organization,
  type SessionData,
  sessionQueryOptions,
  useApiClient,
  useAuthClient,
} from "@/app";
import { Button, OrgSwitcher, TeamSwitcher } from "@/components";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pageHead } from "@/lib/page-meta";
import {
  type TeamWorkspace,
  teamWorkspaceQueryKey,
  teamWorkspaceQueryOptions,
  type WorkspaceTeam,
} from "@/lib/team-workspace";
import {
  editableTeamAreas,
  findActiveOrganization,
  isPersonalOrganization,
  organizationsQueryKey,
  organizationsQueryOptions,
  pendingUserInvitations,
  teamAreaLabels,
  teamMembersQueryKey,
  type UserInvitationItem,
  userInvitationsQueryKey,
  userInvitationsQueryOptions,
} from "@/lib/workspace";

type AuthClientType = import("@/app").AuthClient;

type OrgMembersResult = Awaited<ReturnType<ApiClient["auth"]["listMembers"]>>;
type OrgMemberItem = OrgMembersResult["members"][number];

type TeamMembersResult = Awaited<ReturnType<ApiClient["auth"]["listTeamMembers"]>>;
type TeamMemberItem = TeamMembersResult[number];

export const Route = createFileRoute("/_authenticated/_dashboard/settings/workspace")({
  head: () => ({
    meta: pageHead({
      title: "Workspace | Settings",
      description: "Manage your organizations and teams.",
    }),
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(sessionQueryOptions(context.authClient));
    await context.queryClient.ensureQueryData(organizationsQueryOptions(context.authClient));
    await context.queryClient.ensureQueryData(userInvitationsQueryOptions(context.authClient));
  },
  component: WorkspaceSettings,
});

function WorkspaceSettings() {
  const auth = useAuthClient();
  const apiClient = useApiClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useQuery<SessionData | null>({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await auth.getSession();
      return data ?? null;
    },
    staleTime: 60 * 1000,
  });
  const { data: workspace } = useQuery(teamWorkspaceQueryOptions(apiClient));
  const { data: organizations, isLoading } = useQuery(organizationsQueryOptions(auth));
  const { data: invitationsState } = useQuery(userInvitationsQueryOptions(auth));
  const userInvitations = invitationsState?.invitations ?? [];
  const emailVerificationRequired = invitationsState?.emailVerificationRequired === true;

  const pendingInvitations = pendingUserInvitations(userInvitations);
  const activeOrgId = session?.session?.activeOrganizationId;
  const activeOrg = findActiveOrganization(organizations, activeOrgId);
  const orgs = organizations || [];

  const acceptInvitationMutation = useMutation({
    mutationFn: async (invitation: UserInvitationItem) => {
      const { error } = await auth.organization.acceptInvitation({
        invitationId: invitation.id,
      });
      if (error) throw new Error(error.message);
      return invitation;
    },
    onSuccess: async (invitation) => {
      toast.success(`Joined ${invitation.organizationName ?? "organization"}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: organizationsQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["session"] }),
        queryClient.invalidateQueries({ queryKey: userInvitationsQueryKey }),
      ]);
      if (invitation.organizationSlug) {
        await router.navigate({
          to: "/organizations/$slug",
          params: { slug: invitation.organizationSlug },
        });
      }
    },
    onError: (error: Error) => toast.error(error.message || "Failed to accept invitation"),
  });

  const rejectInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await auth.organization.rejectInvitation({ invitationId });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Invitation declined");
      await queryClient.invalidateQueries({ queryKey: userInvitationsQueryKey });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to decline invitation"),
  });

  const switchOrgMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const { error } = await auth.organization.setActive({ organizationId: orgId });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Switched organization");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["session"] }),
        queryClient.invalidateQueries({ queryKey: teamWorkspaceQueryKey }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to switch organization"),
  });

  return (
    <div className="space-y-5">
      <ActiveOrganizationCard
        organizations={orgs}
        activeOrg={activeOrg}
        onSwitch={(orgId) => switchOrgMutation.mutate(orgId)}
        isSwitching={switchOrgMutation.isPending}
      />

      <TeamsSection
        apiClient={apiClient}
        auth={auth}
        workspace={workspace}
        activeOrgId={activeOrgId}
      />

      {emailVerificationRequired && (
        <p className="text-xs text-muted-foreground">
          Verify an email in{" "}
          <Link to="/settings/auth-methods" className="underline hover:text-foreground">
            Auth Methods
          </Link>{" "}
          to see organization invitations.
        </p>
      )}

      {pendingInvitations.length > 0 && (
        <InvitationsSection
          invitations={pendingInvitations}
          onAccept={(invitation) => acceptInvitationMutation.mutate(invitation)}
          onReject={(invitationId) => rejectInvitationMutation.mutate(invitationId)}
          isAccepting={acceptInvitationMutation.isPending}
          acceptingId={acceptInvitationMutation.variables?.id}
          isRejecting={rejectInvitationMutation.isPending}
          rejectingId={rejectInvitationMutation.variables}
        />
      )}

      <OrganizationsSection
        organizations={orgs}
        isLoading={isLoading}
        activeOrgId={activeOrgId}
        user={session?.user}
        onSwitch={(orgId) => switchOrgMutation.mutate(orgId)}
        isSwitching={switchOrgMutation.isPending}
      />
    </div>
  );
}

function ActiveOrganizationCard({
  organizations,
  activeOrg,
  onSwitch,
  isSwitching,
}: {
  organizations: Organization[];
  activeOrg: Organization | null;
  onSwitch: (orgId: string) => void;
  isSwitching: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Active organization
        </h2>
        <OrgSwitcher
          organizations={organizations}
          activeOrgId={activeOrg?.id ?? null}
          onSwitch={(orgId) => !isSwitching && onSwitch(orgId)}
        />
      </div>
      {activeOrg ? (
        <div className="flex items-start gap-4">
          {activeOrg.logo ? (
            <img
              src={activeOrg.logo}
              alt={activeOrg.name}
              className="size-12 shrink-0 rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-base font-bold text-foreground">
              {activeOrg.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 space-y-1">
            <div className="truncate text-base font-semibold leading-tight text-foreground">
              {activeOrg.name}
            </div>
            <div className="font-mono text-sm text-muted-foreground">@{activeOrg.slug}</div>
            {activeOrg.slug && (
              <Button asChild variant="outline" size="sm" className="mt-1">
                <Link to="/organizations/$slug" params={{ slug: activeOrg.slug }}>
                  open org
                </Link>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No organization is active.</p>
      )}
    </section>
  );
}

function InvitationsSection({
  invitations,
  onAccept,
  onReject,
  isAccepting,
  acceptingId,
  isRejecting,
  rejectingId,
}: {
  invitations: UserInvitationItem[];
  onAccept: (invitation: UserInvitationItem) => void;
  onReject: (invitationId: string) => void;
  isAccepting: boolean;
  acceptingId?: string;
  isRejecting: boolean;
  rejectingId?: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Pending invitations ({invitations.length})
      </h2>
      <div className="space-y-3">
        {invitations.map((invitation) => (
          <div key={invitation.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                <Mail className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="break-all text-sm font-semibold text-foreground">
                  {invitation.organizationName ?? invitation.organizationSlug}
                </div>
                <div className="font-mono text-sm text-muted-foreground">
                  invited as {invitation.role ?? "member"} · expires{" "}
                  {new Date(invitation.expiresAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  onClick={() => onAccept(invitation)}
                  disabled={isAccepting || isRejecting}
                  size="sm"
                >
                  {isAccepting && acceptingId === invitation.id ? "accepting..." : "accept"}
                </Button>
                <Button
                  onClick={() => onReject(invitation.id)}
                  disabled={isAccepting || isRejecting}
                  variant="outline"
                  size="sm"
                >
                  {isRejecting && rejectingId === invitation.id ? "declining..." : "decline"}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function OrganizationsSection({
  organizations,
  isLoading,
  activeOrgId,
  user,
  onSwitch,
  isSwitching,
}: {
  organizations: Organization[];
  isLoading: boolean;
  activeOrgId?: string | null;
  user?: SessionData["user"] | null;
  onSwitch: (orgId: string) => void;
  isSwitching: boolean;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Organizations ({organizations.length})
        </h2>
        <Button asChild size="sm">
          <Link to="/organizations/new">
            <Plus size={14} />
            new organization
          </Link>
        </Button>
      </div>
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((n) => (
            <div key={n} className="space-y-3 rounded-xl border border-border bg-card p-5">
              <div className="size-10 animate-pulse rounded-lg bg-muted" />
              <div className="h-4 w-2/3 animate-pulse rounded-2xs bg-muted" />
            </div>
          ))}
        </div>
      ) : organizations.length === 0 ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-8 text-center">
          <Building2 className="mx-auto size-8 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">No organizations yet.</p>
          <Button asChild size="sm">
            <Link to="/organizations/new">create your first org</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {organizations.map((org) => {
            const isActive = org.id === activeOrgId;
            const isPersonal = isPersonalOrganization(org, user?.id);

            return (
              <div key={org.id} className="space-y-3 rounded-xl border border-border bg-card p-5">
                <div className="flex items-start gap-3">
                  {org.logo ? (
                    <img
                      src={org.logo}
                      alt={org.name}
                      className="size-10 shrink-0 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-sm font-bold text-foreground">
                      {org.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-all text-sm font-semibold leading-tight text-foreground">
                        {org.name}
                      </span>
                      {isActive && <Chip>active</Chip>}
                      {isPersonal && <Chip>personal</Chip>}
                    </div>
                    <div className="font-mono text-2xs text-muted-foreground">@{org.slug}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {org.slug && (
                    <Button asChild variant="outline" size="sm">
                      <Link to="/organizations/$slug" params={{ slug: org.slug }}>
                        open
                      </Link>
                    </Button>
                  )}
                  {!isActive && (
                    <Button
                      onClick={() => onSwitch(org.id)}
                      disabled={isSwitching}
                      variant="outline"
                      size="sm"
                    >
                      <RefreshCw className="size-3.5" />
                      switch
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded border border-border bg-secondary px-2 py-0.5 text-3xs font-semibold text-foreground">
      {children}
    </span>
  );
}
function refreshWorkspace(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: teamWorkspaceQueryKey }),
    queryClient.invalidateQueries({ queryKey: ["session"] }),
  ]);
}

function memberName(member: OrgMemberItem | undefined): string {
  if (!member) return "unknown";
  return member.user?.name ?? member.user?.email ?? member.userId;
}

const orgMembersQueryKey = (organizationId: string) => ["org-members", organizationId] as const;

function TeamsSection({
  apiClient,
  auth,
  workspace,
  activeOrgId,
}: {
  apiClient: ApiClient;
  auth: AuthClientType;
  workspace: TeamWorkspace | undefined;
  activeOrgId?: string | null;
}) {
  const queryClient = useQueryClient();
  const hasActiveOrg = activeOrgId != null;
  const teams = workspace?.teams ?? [];
  const activeTeamId = workspace?.activeTeam?.id ?? null;
  const canManage = workspace?.canManageOrganization === true;

  const { data: orgMembersData } = useQuery({
    queryKey: orgMembersQueryKey(activeOrgId ?? "none"),
    queryFn: async (): Promise<OrgMembersResult> => {
      const result = await auth.organization.listMembers({ organizationId: activeOrgId ?? "" });
      if (!result.data) throw new Error(result.error?.message ?? "Failed to load members");
      return result.data;
    },
    enabled: hasActiveOrg,
    staleTime: 30 * 1000,
  });
  const orgMembers = orgMembersData?.members ?? [];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Teams ({teams.length})
        </h2>
        <TeamSwitcher
          teams={teams}
          activeTeamId={activeTeamId}
          onSwitch={async () => {
            await refreshWorkspace(queryClient);
          }}
        />
      </div>

      {hasActiveOrg ? (
        <>
          {canManage && <CreateTeamForm apiClient={apiClient} activeOrgId={activeOrgId} />}
          {teams.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-5 text-center">
              <Users className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No teams yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teams.map((team) => (
                <TeamCard
                  key={team.id}
                  apiClient={apiClient}
                  team={team}
                  activeOrgId={activeOrgId}
                  activeTeamId={activeTeamId}
                  canManage={canManage}
                  orgMembers={orgMembers}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Select an organization to manage its teams.
        </div>
      )}
    </section>
  );
}

function CreateTeamForm({ apiClient, activeOrgId }: { apiClient: ApiClient; activeOrgId: string }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [areas, setAreas] = useState<string[]>([]);

  const createTeamMutation = useMutation({
    mutationFn: async () => {
      return apiClient.auth.createTeam({
        name,
        organizationId: activeOrgId,
        areas: areas.length > 0 ? areas : undefined,
      });
    },
    onSuccess: async () => {
      toast.success("Team created");
      setName("");
      setAreas([]);
      await refreshWorkspace(queryClient);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create team"),
  });

  const canSubmit = name.trim() !== "" && !createTeamMutation.isPending;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="team name"
          className="max-w-60"
          onKeyDown={(event) => event.key === "Enter" && canSubmit && createTeamMutation.mutate()}
        />
        <Button onClick={() => createTeamMutation.mutate()} disabled={!canSubmit} size="sm">
          <Plus size={14} />
          {createTeamMutation.isPending ? "creating..." : "create team"}
        </Button>
      </div>
      <AreaChecklist selected={areas} onChange={setAreas} />
    </div>
  );
}

function AreaChecklist({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (areas: string[]) => void;
}) {
  const options = editableTeamAreas(selected);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((area) => {
        const checked = selected.includes(area);
        return (
          <button
            key={area}
            type="button"
            onClick={() => {
              onChange(
                checked ? selected.filter((candidate) => candidate !== area) : [...selected, area],
              );
            }}
            className={
              checked
                ? "inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground"
                : "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
            }
            aria-pressed={checked}
          >
            {checked && <Check size={12} />}
            {teamAreaLabels([area])[0]}
          </button>
        );
      })}
    </div>
  );
}

function TeamCard({
  apiClient,
  team,
  activeOrgId,
  activeTeamId,
  canManage,
  orgMembers,
}: {
  apiClient: ApiClient;
  team: WorkspaceTeam;
  activeOrgId?: string | null;
  activeTeamId: string | null;
  canManage: boolean;
  orgMembers: OrgMemberItem[];
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(team.name);
  const [areas, setAreas] = useState<string[]>(team.areas);
  const [newMemberUserId, setNewMemberUserId] = useState("");

  const { data: teamMembers = [] } = useQuery({
    queryKey: teamMembersQueryKey(team.id),
    queryFn: async (): Promise<TeamMemberItem[]> => {
      const members = await apiClient.auth.listTeamMembers({ teamId: team.id });
      return members ?? [];
    },
    staleTime: 30 * 1000,
  });

  const teamMemberUserIds = teamMembers.map((member) => member.userId);
  const { data: teamBuilders = [] } = useQuery({
    queryKey: ["builders-by-user-ids", teamMemberUserIds],
    queryFn: async () => {
      const result = await apiClient.getBuildersByUserIds({ userIds: teamMemberUserIds });
      return result.data ?? [];
    },
    enabled: teamMemberUserIds.length > 0,
    staleTime: 60 * 1000,
  });

  const updateTeamMutation = useMutation({
    mutationFn: async () => {
      return apiClient.auth.updateTeam({
        teamId: team.id,
        organizationId: activeOrgId ?? undefined,
        data: { name, areas },
      });
    },
    onSuccess: async () => {
      toast.success("Team updated");
      setEditing(false);
      await refreshWorkspace(queryClient);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update team"),
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async () => {
      return apiClient.auth.deleteTeam({
        teamId: team.id,
        organizationId: activeOrgId ?? undefined,
      });
    },
    onSuccess: async () => {
      toast.success("Team deleted");
      await refreshWorkspace(queryClient);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete team"),
  });

  const addMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiClient.auth.addTeamMember({
        teamId: team.id,
        userId,
        organizationId: activeOrgId ?? undefined,
      });
    },
    onSuccess: async () => {
      toast.success("Member added");
      setNewMemberUserId("");
      await Promise.all([
        refreshWorkspace(queryClient),
        queryClient.invalidateQueries({ queryKey: teamMembersQueryKey(team.id) }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to add member"),
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiClient.auth.removeTeamMember({
        teamId: team.id,
        userId,
        organizationId: activeOrgId ?? undefined,
      });
    },
    onSuccess: async () => {
      toast.success("Member removed");
      await Promise.all([
        refreshWorkspace(queryClient),
        queryClient.invalidateQueries({ queryKey: teamMembersQueryKey(team.id) }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to remove member"),
  });

  const teamMemberIds = new Set(teamMembers.map((member) => member.userId));
  const addableMembers = orgMembers.filter((member) => !teamMemberIds.has(member.userId));
  const memberById = new Map(orgMembers.map((member) => [member.userId, member]));
  const builderByUserId = new Map(teamBuilders.map((builder) => [builder.userId, builder]));
  const isActiveTeam = team.id === activeTeamId;

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{team.name}</span>
            {isActiveTeam && <Chip>active</Chip>}
          </div>
          {team.areas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {teamAreaLabels(team.areas).map((label) => (
                <Chip key={label}>{label}</Chip>
              ))}
            </div>
          )}
        </div>
        {canManage && (
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setName(team.name);
                setAreas([...team.areas]);
                setEditing((value) => !value);
              }}
            >
              <Pencil className="size-3.5" />
              {editing ? "cancel" : "edit"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => deleteTeamMutation.mutate()}
              disabled={deleteTeamMutation.isPending}
            >
              <Trash2 className="size-3.5" />
              {deleteTeamMutation.isPending ? "deleting..." : "delete"}
            </Button>
          </div>
        )}
      </div>

      {editing && (
        <div className="space-y-3 rounded-lg border border-border bg-muted p-3">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="team name"
            className="max-w-60"
          />
          <AreaChecklist selected={areas} onChange={setAreas} />
          <Button
            onClick={() => updateTeamMutation.mutate()}
            disabled={name.trim() === "" || updateTeamMutation.isPending}
            size="sm"
          >
            <Check size={14} />
            {updateTeamMutation.isPending ? "saving..." : "save"}
          </Button>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
          members ({teamMembers.length})
        </div>
        {teamMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members on this team yet.</p>
        ) : (
          <ul className="space-y-1">
            {teamMembers.map((member) => {
              const name = memberName(memberById.get(member.userId));
              const builder = builderByUserId.get(member.userId);
              return (
                <li
                  key={member.id}
                  className="flex items-center justify-between gap-3 text-sm text-foreground"
                >
                  <span className="min-w-0 truncate">
                    {builder?.nearAccount ? (
                      <Link
                        to="/builders/$account"
                        params={{ account: builder.nearAccount }}
                        className="hover:underline"
                      >
                        {builder.name ?? name}
                      </Link>
                    ) : (
                      name
                    )}
                  </span>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeMemberMutation.mutate(member.userId)}
                      disabled={removeMemberMutation.isPending}
                    >
                      remove
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {canManage && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Select value={newMemberUserId} onValueChange={setNewMemberUserId}>
              <SelectTrigger className="h-9 w-56">
                <SelectValue placeholder="add member" />
              </SelectTrigger>
              <SelectContent>
                {addableMembers.map((member) => (
                  <SelectItem key={member.userId} value={member.userId}>
                    <span className="truncate">{memberName(member)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              disabled={newMemberUserId === "" || addMemberMutation.isPending}
              onClick={() => addMemberMutation.mutate(newMemberUserId)}
            >
              <Plus size={14} />
              add
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
