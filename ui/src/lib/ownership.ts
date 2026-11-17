import { isOwnNearAccount } from "./signup-routing";

type ViewerUser = {
  id?: string | null;
  walletAddress?: string | null;
};

/**
 * Every id the viewer's rows may be owned by: the connected NEAR account, every linked NEAR
 * account, the wallet address and the user id. Mirrors the API, which matches ownership
 * against all of them, so a primary switch does not hide the owner's own controls.
 */
export function viewerOwnerIds(
  user: ViewerUser | null | undefined,
  nearAccountId?: string | null,
  linkedNearAccountIds: readonly (string | null | undefined)[] = [],
): string[] {
  const ids = [nearAccountId, ...linkedNearAccountIds, user?.walletAddress, user?.id];
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

/** Owner ids are compared exactly, matching the API's ownership check. */
export function isViewerOwner(ownerId: string | null | undefined, viewerIds: readonly string[]) {
  return Boolean(ownerId) && viewerIds.includes(ownerId as string);
}

/** Collaborator ids are stored lowercased, so compare case-insensitively like the API does. */
export function isViewerCollaboratorId(collaboratorOwnerId: string, viewerIds: readonly string[]) {
  return isOwnNearAccount(collaboratorOwnerId, viewerIds);
}

export function isViewerAcceptedCollaborator(
  collaborators: readonly { collaboratorOwnerId: string; status: string }[] | null | undefined,
  viewerIds: readonly string[],
) {
  return (collaborators ?? []).some(
    (c) => c.status === "accepted" && isViewerCollaboratorId(c.collaboratorOwnerId, viewerIds),
  );
}
