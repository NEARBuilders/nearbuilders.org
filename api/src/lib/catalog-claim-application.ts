import { ORPCError } from "every-plugin/orpc";
import type { Context } from "./context";
import type { PluginsClient } from "./plugins-types.gen";

export async function applyCatalogClaimApplication({
  plugins,
  context,
  entityId,
  createdBy,
  submissionCount,
  nearAccount,
  projectSlug,
  roles,
}: {
  plugins: Omit<PluginsClient, "auth">;
  context: Context;
  entityId: string;
  createdBy: string;
  submissionCount: number;
  nearAccount: string;
  projectSlug: string;
  roles: string[];
}) {
  if (
    createdBy.toLowerCase() !== nearAccount ||
    entityId !== `claim:${nearAccount}:${projectSlug}`
  ) {
    throw new ORPCError("BAD_REQUEST", { message: "Invalid Catalog claim proposal" });
  }

  await plugins.builders(context).getBuilder({ nearAccount });
  const catalogProject = await plugins.nearcatalog().getCatalogProject({ slug: projectSlug });
  if (catalogProject.data.status?.toLowerCase() !== "active") {
    throw new ORPCError("BAD_REQUEST", { message: "Only active Catalog projects can be claimed" });
  }

  let claimId: string | undefined;
  let activityEventId: string | undefined;
  try {
    const claim = await plugins.nearcatalog(context).applyCatalogClaim({
      nearAccount,
      projectSlug,
      roles,
    });
    claimId = claim.data.id;
    const activity = await plugins.activity(context).emitTrustedActivity({
      source: "nearcatalog",
      type: "claim",
      actor: nearAccount,
      idempotencyKey: `nearcatalog-claim:${entityId}:${submissionCount}`,
      payload: {
        claimId,
        projectSlug,
        catalogUrl: catalogProject.data.catalogUrl,
        projectName: catalogProject.data.name,
        projectTagline: catalogProject.data.tagline,
        projectImageUrl: catalogProject.data.imageUrl,
        repositoryUrl: catalogProject.data.repositoryUrl,
        roles,
      },
    });
    activityEventId = activity.id;
    const linked = await plugins.nearcatalog(context).setCatalogClaimActivity({
      id: claimId,
      activityEventId,
    });
    return linked.data.id;
  } catch (error) {
    const compensation: Promise<unknown>[] = [];
    if (activityEventId)
      compensation.push(plugins.activity(context).hideActivity({ id: activityEventId }));
    if (claimId)
      compensation.push(plugins.nearcatalog(context).revokeCatalogClaim({ id: claimId }));
    await Promise.allSettled(compensation);
    throw error;
  }
}
