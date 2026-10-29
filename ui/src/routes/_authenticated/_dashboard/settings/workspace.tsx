import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Check,
  Loader2,
  LogOut,
  Mail,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
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
  organizationsQueryKey,
  organizationsQueryOptions,
  pendingUserInvitations,
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

type ActiveMemberResult = Awaited<ReturnType<ApiClient["auth"]["getActiveMember"]>>;

const activeMemberQueryKey = (organizationId: string) => ["active-member", organizationId] as const;
const orgMembersQueryKey = (organizationId: string) => ["org-members", organizationId] as const;

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
  const { data: organizations } = useQuery(organizationsQueryOptions(auth));
  const { data: invitationsState } = useQuery(userInvitationsQueryOptions(auth));
  const userInvitations = invitationsState?.invitations ?? [];
  const emailVerificationRequired = invitationsState?.emailVerificationRequired === true;

  const pendingInvitations = pendingUserInvitations(userInvitations);
  const activeOrgId = session?.session?.activeOrganizationId;
  const activeOrg = organizations?.find((o) => o.id === activeOrgId);
  const orgs = organizations || [];

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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Org</span>
          <OrgSwitcher
            organizations={orgs}
            activeOrgId={activeOrgId}
            isSwitching={switchOrgMutation.isPending}
            onSwitch={(orgId) => switchOrgMutation.mutate(orgId)}
          />
          {activeOrg?.slug && (
            <Button asChild variant="ghost" size="icon" className="size-8 shrink-0">
              <Link to="/organizations/$slug" params={{ slug: activeOrg.slug }}>
                <ArrowUpRight className="size-4" />
                <span className="sr-only">open organization</span>
              </Link>
            </Button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Team</span>
          <TeamSwitcher
            teams={workspace?.teams ?? []}
            activeTeamId={workspace?.activeTeam?.id ?? null}
            onSwitch={async () => {
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["session"] }),
                queryClient.invalidateQueries({ queryKey: teamWorkspaceQueryKey }),
              ]);
            }}
          />
        </div>
      </div>

      {activeOrg && (
        <OrgSettingsCard
          apiClient={apiClient}
          activeOrg={activeOrg}
          canManage={workspace?.canManageOrganization === true}
          teams={workspace?.teams ?? []}
        />
      )}

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

      <TeamsSection
        apiClient={apiClient}
        auth={auth}
        workspace={workspace}
        activeOrgId={activeOrgId}
      />
    </div>
  );
}

function OrgSettingsCard({
  apiClient,
  activeOrg,
  canManage,
  teams,
}: {
  apiClient: ApiClient;
  activeOrg: Organization;
  canManage: boolean;
  teams: WorkspaceTeam[];
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [name, setName] = useState(activeOrg.name);
  const [slug, setSlug] = useState(activeOrg.slug ?? "");
  const [logo, setLogo] = useState(activeOrg.logo ?? "");

  const { data: activeMember } = useQuery<ActiveMemberResult | null>({
    queryKey: activeMemberQueryKey(activeOrg.id),
    queryFn: async () => {
      const result = await apiClient.auth.getActiveMember({ organizationId: activeOrg.id });
      return result ?? null;
    },
    enabled: !!activeOrg.id,
    staleTime: 60 * 1000,
  });

  const isOwner = activeMember?.role === "owner";

  const updateMutation = useMutation({
    mutationFn: async () => {
      return apiClient.auth.updateOrganization({
        organizationId: activeOrg.id,
        data: {
          name: name.trim(),
          slug: slug.trim(),
          logo: logo.trim() || null,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Organization updated");
      await queryClient.invalidateQueries({ queryKey: organizationsQueryKey });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update organization"),
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      return apiClient.auth.leaveOrganization({ organizationId: activeOrg.id });
    },
    onSuccess: async () => {
      toast.success("Left organization");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: organizationsQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["session"] }),
      ]);
      await router.navigate({ to: "/settings/workspace" });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to leave organization"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiClient.auth.deleteOrganization({ organizationId: activeOrg.id });
    },
    onSuccess: async () => {
      toast.success("Organization deleted");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: organizationsQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["session"] }),
      ]);
      await router.navigate({ to: "/settings/workspace" });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete organization"),
  });

  const hasChanges =
    name.trim() !== activeOrg.name ||
    slug.trim() !== (activeOrg.slug ?? "") ||
    (logo.trim() || null) !== (activeOrg.logo ?? null);

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Organization
        </h2>
      </div>

      {canManage ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="organization name"
            />
            <Input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="slug"
            />
          </div>
          <Input
            value={logo}
            onChange={(event) => setLogo(event.target.value)}
            placeholder="logo url"
          />
          <div className="flex justify-end">
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={!hasChanges || updateMutation.isPending}
              size="sm"
            >
              {updateMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              save
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="text-base font-semibold text-foreground">{activeOrg.name}</div>
          <div className="font-mono text-sm text-muted-foreground">@{activeOrg.slug}</div>
        </div>
      )}

      {canManage && (
        <InviteMemberForm apiClient={apiClient} activeOrgId={activeOrg.id} teams={teams} />
      )}

      <div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
        <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>
        <div className="flex flex-wrap gap-2">
          {!isOwner && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (window.confirm("Leave this organization?")) leaveMutation.mutate();
              }}
              disabled={leaveMutation.isPending}
            >
              <LogOut className="size-3.5" />
              leave organization
            </Button>
          )}
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                if (
                  window.confirm("Delete this organization permanently? This cannot be undone.")
                ) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="size-3.5" />
              delete organization
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function InviteMemberForm({
  apiClient,
  activeOrgId,
  teams,
}: {
  apiClient: ApiClient;
  activeOrgId: string;
  teams: WorkspaceTeam[];
}) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [teamId, setTeamId] = useState<string>("");

  const inviteMutation = useMutation({
    mutationFn: async () => {
      return apiClient.auth.inviteMember({
        organizationId: activeOrgId,
        email: email.trim(),
        role,
        teamId: teamId || undefined,
      });
    },
    onSuccess: async () => {
      toast.success("Invitation sent");
      setEmail("");
      setRole("member");
      setTeamId("");
      await queryClient.invalidateQueries({ queryKey: organizationsQueryKey });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to send invitation"),
  });

  const canSubmit = email.trim() !== "" && !inviteMutation.isPending;

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background p-4">
      <h3 className="text-sm font-semibold text-foreground">Invite member</h3>
      <div className="flex flex-wrap items-end gap-2">
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="email"
          className="max-w-64"
          onKeyDown={(event) => event.key === "Enter" && canSubmit && inviteMutation.mutate()}
        />
        <Select
          value={role as string}
          onValueChange={(value) => setRole(value as "admin" | "member")}
        >
          <SelectTrigger className="h-9 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">member</SelectItem>
            <SelectItem value="admin">admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={teamId} onValueChange={setTeamId}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="team (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">no team</SelectItem>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => inviteMutation.mutate()} disabled={!canSubmit} size="sm">
          <Mail className="size-3.5" />
          {inviteMutation.isPending ? "sending..." : "invite"}
        </Button>
      </div>
    </div>
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

  const createTeamMutation = useMutation({
    mutationFn: async () => {
      return apiClient.auth.createTeam({
        name,
        organizationId: activeOrgId,
      });
    },
    onSuccess: async () => {
      toast.success("Team created");
      setName("");
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
        data: { name },
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
        </div>
        {canManage && (
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setName(team.name);
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
