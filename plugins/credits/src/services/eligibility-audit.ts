export type NearLink = {
  userId: string;
  accountId: string;
  isPrimary: boolean;
};

export type ProfileRow = {
  nearAccount: string;
  userId: string | null;
  withdrawnAt: Date | string | null;
};

export type ClaimRow = {
  nearAccountId: string;
  status: string;
};

export type AuditVerdict =
  | "eligible"
  | "mismatch_fixable"
  | "needs_approved_profile"
  | "needs_approved_profile_withdrawn";

export type UserAudit = {
  userId: string;
  primaryAccountId: string | null;
  hasPrimaryMarker: boolean;
  linkedProfileAccounts: string[];
  runtimeEligible: boolean;
  fixable: boolean;
  verdict: AuditVerdict;
};

export type OrphanedClaim = {
  nearAccountId: string;
  statuses: string[];
};

export type EligibilityAuditReport = {
  users: UserAudit[];
  orphanedClaims: OrphanedClaim[];
  counts: {
    users: number;
    fixable: number;
    withdrawn: number;
    missingProfile: number;
    orphanedClaims: number;
  };
};

type Profile = { nearAccount: string; userId: string | null; withdrawn: boolean };

function isApproved(profile: Profile) {
  return !profile.withdrawn;
}

export function buildAuditReport(input: {
  links: NearLink[];
  profiles: ProfileRow[];
  claims?: ClaimRow[];
}): EligibilityAuditReport {
  const profiles = input.profiles.map((row) => ({
    nearAccount: row.nearAccount.trim().toLowerCase(),
    userId: row.userId?.trim().toLowerCase() ?? null,
    withdrawn: Boolean(row.withdrawnAt),
  }));

  const linksByUser = new Map<string, NearLink[]>();
  for (const link of input.links) {
    const userId = link.userId.trim().toLowerCase();
    const list = linksByUser.get(userId) ?? [];
    list.push({
      ...link,
      accountId: link.accountId.trim().toLowerCase(),
      isPrimary: Boolean(link.isPrimary),
    });
    linksByUser.set(userId, list);
  }

  const claims = input.claims ?? [];
  const claimsByAccount = new Map<string, string[]>();
  for (const claim of claims) {
    const accountId = claim.nearAccountId.trim().toLowerCase();
    const statuses = claimsByAccount.get(accountId) ?? [];
    if (!statuses.includes(claim.status)) statuses.push(claim.status);
    claimsByAccount.set(accountId, statuses);
  }
  const allLinkedAccounts = new Set(input.links.map((link) => link.accountId.trim().toLowerCase()));

  const users: UserAudit[] = [];
  for (const [userId, links] of linksByUser) {
    const primaries = links.filter((link) => link.isPrimary);
    const primaryAccountId = primaries[0]?.accountId ?? null;
    const hasPrimaryMarker = primaries.length === 1;
    const primaryProfiles = primaryAccountId
      ? profiles.filter((profile) => profile.nearAccount === primaryAccountId)
      : [];
    const userIdProfiles = profiles.filter((profile) => profile.userId === userId);
    const runtimeCandidates = [...new Set([...primaryProfiles, ...userIdProfiles])];
    const runtimeEligible = runtimeCandidates.some(isApproved);
    const linkedProfileAccounts = links
      .filter((link) => {
        const profile = profiles.find((candidate) => candidate.nearAccount === link.accountId);
        return link.accountId !== primaryAccountId && profile && isApproved(profile);
      })
      .map((link) => link.accountId);
    const profileForUserMissing = profiles.every(
      (profile) => profile.userId !== userId && profile.nearAccount !== primaryAccountId,
    );
    const fixable = !runtimeEligible && linkedProfileAccounts.length > 0;
    const withdrawnCandidates = runtimeCandidates.length > 0 && !runtimeEligible;

    const verdict: AuditVerdict = runtimeEligible
      ? "eligible"
      : fixable
        ? "mismatch_fixable"
        : withdrawnCandidates
          ? "needs_approved_profile_withdrawn"
          : profileForUserMissing || runtimeCandidates.length === 0
            ? "needs_approved_profile"
            : "needs_approved_profile_withdrawn";

    users.push({
      userId,
      primaryAccountId,
      hasPrimaryMarker,
      linkedProfileAccounts,
      runtimeEligible,
      fixable,
      verdict,
    });
  }

  const orphanedClaims = [...claimsByAccount]
    .filter(([accountId]) => !allLinkedAccounts.has(accountId))
    .map(([nearAccountId, statuses]) => ({ nearAccountId, statuses: statuses.sort() }));

  return {
    users,
    orphanedClaims,
    counts: {
      users: users.length,
      fixable: users.filter((user) => user.fixable).length,
      withdrawn: users.filter((user) => user.verdict === "needs_approved_profile_withdrawn").length,
      missingProfile: users.filter((user) => user.verdict === "needs_approved_profile").length,
      orphanedClaims: orphanedClaims.length,
    },
  };
}
