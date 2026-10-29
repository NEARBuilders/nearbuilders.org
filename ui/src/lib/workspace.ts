import type { AuthClient, Organization } from "@/app";
import { FEATURE_AREA_LABELS, isFeatureArea } from "./feature-areas";

export const organizationsQueryKey = ["organizations"] as const;
export const userInvitationsQueryKey = ["user-invitations"] as const;
export const teamsQueryKey = ["teams"] as const;

export type UserInvitationsResponse = Awaited<
  ReturnType<AuthClient["organization"]["listUserInvitations"]>
>;

export type UserInvitationItem = NonNullable<UserInvitationsResponse["data"]>[number];

export interface UserInvitationsList {
  pending: UserInvitationItem[];
}

export function pendingUserInvitations(
  invitations: UserInvitationItem[] | null | undefined,
): UserInvitationItem[] {
  return (invitations ?? []).filter((invitation) => invitation.status === "pending");
}

export function findActiveOrganization(
  organizations: Organization[] | null | undefined,
  activeOrganizationId: string | null | undefined,
): Organization | null {
  if (!activeOrganizationId) return null;
  return organizations?.find((org) => org.id === activeOrganizationId) ?? null;
}

export const orgTeamsQueryKey = (organizationId: string) => ["teams", organizationId] as const;
export const teamMembersQueryKey = (teamId: string) => ["team-members", teamId] as const;

export function teamAreaLabels(areas: string[] | null | undefined): string[] {
  return (areas ?? []).map((area) => (isFeatureArea(area) ? FEATURE_AREA_LABELS[area] : area));
}

export function editableTeamAreas(teamAreas: string[] | null | undefined): string[] {
  const ordered = [...new Set(teamAreas ?? [])];
  for (const labelKey of Object.keys(FEATURE_AREA_LABELS)) {
    if (!ordered.includes(labelKey)) ordered.push(labelKey);
  }
  return ordered;
}
