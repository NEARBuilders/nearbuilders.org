import { ORPCError } from "@orpc/server";
import type { z } from "zod";
import {
  CATALOG_LISTING_SYNC,
  type CatalogExportPersonSchema,
  type CatalogExportProjectSchema,
} from "../../../plugins/nearcatalog/src/contract";
import type { ProposalSchema } from "../../../plugins/proposals/src/contract";
import type { Context } from "../lib/context";
import type { PluginsClient } from "../lib/plugin-clients";
import { readString, requireObjectPayload } from "../lib/utils";
import { AUTO_APPROVAL_ACTOR_ID } from "./approval-settings";
import { evaluatorContext } from "./review-context";

export const CATALOG_LISTING_PLUGIN_ID = "nearcatalog-listing";
export const SITE_URL = "https://nearbuilders.org";
const NEAR_SOCIAL_API = "https://api.near.social/get";
const IPFS_GATEWAY = "https://ipfs.near.social/ipfs";

export type CatalogListingKind = "project" | "person";
export type CatalogProjectRecord = z.infer<typeof CatalogExportProjectSchema>;
export type CatalogPersonRecord = z.infer<typeof CatalogExportPersonSchema>;
type CatalogRecord = CatalogProjectRecord | CatalogPersonRecord;
type ProposalRecord = z.infer<typeof ProposalSchema>;
type Plugins = Omit<PluginsClient, "auth">;
type Project = Awaited<ReturnType<ReturnType<Plugins["projects"]>["getProject"]>>["data"];
type Builder = NonNullable<
  Awaited<ReturnType<ReturnType<Plugins["builders"]>["getBuilder"]>>["data"]
>;
type Listing = NonNullable<
  Awaited<ReturnType<ReturnType<Plugins["nearcatalog"]>["getCatalogListing"]>>["data"]
>;

export const catalogSyncContext = { [CATALOG_LISTING_SYNC]: true } as unknown as Context;

const PROJECT_MAJOR_FIELDS = [
  "title",
  "oneliner",
  "logo",
  "categories",
  "website",
  "twitter",
  "medium",
  "telegram",
  "github",
  "discord",
  "whitepaper",
  "token-address",
  "coingecko-address",
  "nearsocial-address",
  "dapp",
] as const;

const PERSON_MAJOR_FIELDS = [
  "name",
  "avatar",
  "email",
  "telegram",
  "twitter",
  "discord",
  "website",
] as const;

export function catalogListingEntityId(kind: CatalogListingKind, id: string) {
  return `${kind}:${id}`;
}

export function slugifyCatalogTitle(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "project"
  );
}

function absoluteUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function missingFields(checks: Array<[string, boolean]>) {
  return checks.filter(([, present]) => !present).map(([label]) => label);
}

export function buildProjectCatalogRecord(project: Project, slug: string) {
  const catalog = project.catalog ?? null;
  const links = catalog?.links ?? {};
  const website = absoluteUrl(project.domain);
  const record = {
    slug,
    title: project.title.trim(),
    oneliner: catalog?.tagline?.trim() ?? "",
    description: (project.description ?? "").trim().slice(0, 2000),
    logo: absoluteUrl(project.logoUrl),
    categories: catalog?.categories ?? [],
    website,
    twitter: absoluteUrl(links.twitter),
    medium: absoluteUrl(links.medium),
    telegram: absoluteUrl(links.telegram),
    github: absoluteUrl(links.github ?? project.repository),
    discord: absoluteUrl(links.discord),
    whitepaper: absoluteUrl(links.whitepaper),
    "token-address": catalog?.tokenContract ?? "",
    "coingecko-address": catalog?.coingeckoId ?? "",
    "nearsocial-address": absoluteUrl(links.nearsocial),
    dapp: website,
    phase: catalog?.phase ?? "",
    source: {
      site: "nearbuilders.org",
      url: `${SITE_URL}/projects/project/${project.slug}`,
      nearAccount: project.ownerId,
      updatedAt: new Date(project.updatedAt).toISOString(),
    },
  } satisfies CatalogProjectRecord;
  const missing = missingFields([
    ["Title", Boolean(record.title)],
    ["One-line tagline", Boolean(record.oneliner)],
    ["Short description", Boolean(record.description)],
    ["Logo", Boolean(record.logo)],
    ["At least one category", record.categories.length > 0],
  ]);
  return { record, missing };
}

export function buildPersonCatalogRecord(builder: Builder, avatar: string) {
  const catalog = builder.catalog ?? null;
  const links = builder.links ?? {};
  const preferredContact = catalog?.preferredContact;
  const record = {
    name: (builder.name ?? "").trim(),
    preferredContact: preferredContact ?? "Email",
    description: (builder.bio ?? "").trim().slice(0, 2000),
    organization: catalog?.organization ?? "",
    team: catalog?.team ?? "",
    jobTitle: catalog?.jobTitle ?? "",
    email: catalog?.publicEmail ?? "",
    telegram: absoluteUrl(links.telegram),
    twitter: absoluteUrl(links.twitter),
    discord: absoluteUrl(links.discord),
    website: absoluteUrl(links.website),
    avatar: absoluteUrl(catalog?.avatarUrl) || avatar,
    nearProjects: "",
    nearAccount: builder.nearAccount,
  } satisfies CatalogPersonRecord;
  const missing = missingFields([
    ["Name", Boolean(record.name)],
    ["Bio", Boolean(record.description)],
    ["Preferred contact", Boolean(preferredContact)],
  ]);
  return { record, missing };
}

function comparable(record: Record<string, unknown> | null | undefined) {
  if (!record) return null;
  const { source, ...rest } = record as Record<string, unknown> & { source?: unknown };
  if (source && typeof source === "object") {
    const { updatedAt: _updatedAt, ...sourceRest } = source as Record<string, unknown>;
    return JSON.stringify({ ...rest, source: sourceRest });
  }
  return JSON.stringify(rest);
}

export function sameCatalogRecord(
  a: Record<string, unknown> | null | undefined,
  b: Record<string, unknown> | null | undefined,
) {
  return comparable(a) === comparable(b);
}

export function hasMajorCatalogChange(
  kind: CatalogListingKind,
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown>,
) {
  if (!before) return true;
  const fields = kind === "project" ? PROJECT_MAJOR_FIELDS : PERSON_MAJOR_FIELDS;
  return fields.some((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]));
}

export function isSystemActor(context: Context) {
  const id = context.userId ?? context.user?.id ?? "";
  return id === AUTO_APPROVAL_ACTOR_ID || id.startsWith("system:");
}

function signedInIds(context: Context) {
  return [
    context.userId,
    (context.user as { walletAddress?: string | null } | undefined)?.walletAddress,
    context.near?.primaryAccountId,
    ...(context.near?.linkedAccounts ?? []).map(({ accountId }) => accountId),
  ].filter((value): value is string => Boolean(value));
}

function isAdmin(context: Context) {
  return context.user?.role === "admin";
}

export async function resolveNearSocialAvatar(
  nearAccount: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  try {
    const response = await fetchImpl(NEAR_SOCIAL_API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keys: [`${nearAccount}/profile/image/**`] }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return "";
    const body = (await response.json()) as Record<
      string,
      { profile?: { image?: { ipfs_cid?: string; url?: string } } }
    >;
    const image = body[nearAccount]?.profile?.image;
    if (image?.ipfs_cid && /^[a-zA-Z0-9]+$/.test(image.ipfs_cid)) {
      return `${IPFS_GATEWAY}/${image.ipfs_cid}`;
    }
    return absoluteUrl(image?.url);
  } catch {
    return "";
  }
}

export function toCatalogListingSend(listing: Listing) {
  const record = listing.record ?? {};
  const title = readString(record.title) || readString(record.name) || listing.entityId;
  return {
    kind: listing.kind,
    entityId: listing.entityId,
    title,
    slug: listing.slug,
    status: listing.status,
    catalogUrl: listing.catalogUrl,
    sendStatus: listing.sendStatus,
    sendAction: listing.sendAction,
    sendError: listing.sendError,
    sendAttemptedAt: listing.sendAttemptedAt,
    sentAt: listing.sentAt,
  };
}

export function readCatalogListingPayload(payload: unknown) {
  const data = requireObjectPayload(payload);
  const kind: CatalogListingKind | null =
    data.kind === "project" || data.kind === "person" ? data.kind : null;
  const entityId = readString(data.entityId);
  const ownerId = readString(data.ownerId);
  const slug = readString(data.slug);
  const record =
    data.record && typeof data.record === "object" && !Array.isArray(data.record)
      ? (data.record as Record<string, unknown>)
      : null;
  if (!kind || !entityId || !ownerId || !slug || !record) {
    throw new ORPCError("BAD_REQUEST", { message: "Invalid NEAR Catalog listing proposal" });
  }
  return { kind, entityId, ownerId, slug, record };
}

type Subject = {
  kind: CatalogListingKind;
  entityId: string;
  ownerId: string;
  title: string;
  slug: string;
  link: string;
  eligible: boolean;
  ineligibleReason: string | null;
  record: CatalogRecord;
  missing: string[];
};

export function createCatalogListings(
  plugins: Plugins,
  options: { resolveAvatar?: (nearAccount: string) => Promise<string> } = {},
) {
  const resolveAvatar = options.resolveAvatar ?? ((account) => resolveNearSocialAvatar(account));
  const listings = () => plugins.nearcatalog(catalogSyncContext);

  const loadListing = async (kind: CatalogListingKind, entityId: string) =>
    (await listings().getCatalogListing({ kind, entityId })).data;

  const latestProposal = async (kind: CatalogListingKind, entityId: string) => {
    const result = await plugins.proposals(evaluatorContext).getProposals({
      pluginId: CATALOG_LISTING_PLUGIN_ID,
      entityId: catalogListingEntityId(kind, entityId),
      limit: 1,
    });
    return (result.data[0] ?? null) as ProposalRecord | null;
  };

  const projectSubject = async (
    projectId: string,
    context: Context,
    listing: Listing | null,
  ): Promise<Subject> => {
    const { data: project } = await plugins.projects(context).getProject({ id: projectId });
    const slug = listing?.slug ?? slugifyCatalogTitle(project.title);
    const { record, missing } = buildProjectCatalogRecord(project, slug);
    const ineligibleReason =
      project.kind !== "project"
        ? "Only projects can be listed on NEAR Catalog"
        : project.visibility !== "public"
          ? "Make the project public to list it on NEAR Catalog"
          : null;
    return {
      kind: "project",
      entityId: project.id,
      ownerId: project.ownerId,
      title: project.title,
      slug,
      link: `/projects/${project.kind}/${project.slug}`,
      eligible: !ineligibleReason,
      ineligibleReason,
      record,
      missing,
    };
  };

  const personSubject = async (
    nearAccount: string,
    context: Context,
    listing: Listing | null,
  ): Promise<Subject> => {
    const { data: builder } = await plugins.builders(context).getBuilder({ nearAccount });
    const avatar = builder.catalog?.avatarUrl ? "" : await resolveAvatar(builder.nearAccount);
    const { record, missing } = buildPersonCatalogRecord(builder, avatar);
    const ineligibleReason = builder.withdrawnAt
      ? "Restore your builder profile to list it on NEAR Catalog"
      : null;
    return {
      kind: "person",
      entityId: builder.nearAccount,
      ownerId: builder.nearAccount,
      title: record.name || builder.nearAccount,
      slug: listing?.slug ?? builder.nearAccount,
      link: `/builders/${builder.nearAccount}`,
      eligible: !ineligibleReason,
      ineligibleReason,
      record,
      missing,
    };
  };

  const loadSubject = (
    kind: CatalogListingKind,
    entityId: string,
    context: Context,
    listing: Listing | null,
  ) =>
    kind === "project"
      ? projectSubject(entityId, context, listing)
      : personSubject(entityId, context, listing);

  const resolveTarget = async (
    input: { kind: CatalogListingKind; projectId?: string },
    context: Context,
  ) => {
    if (input.kind === "project") {
      if (!input.projectId) {
        throw new ORPCError("BAD_REQUEST", { message: "projectId is required" });
      }
      const { data: project } = await plugins.projects(context).getProject({ id: input.projectId });
      if (!signedInIds(context).includes(project.ownerId)) {
        throw new ORPCError("FORBIDDEN", {
          message: "Only the project owner can manage its NEAR Catalog listing",
        });
      }
      return { kind: input.kind, entityId: project.id };
    }
    const { data: builder } = await plugins.builders(context).getMyBuilderProfile({});
    if (!builder) {
      throw new ORPCError("FORBIDDEN", { message: "An approved builder profile is required" });
    }
    return { kind: input.kind, entityId: builder.nearAccount };
  };

  const ownerContext = (context: Context, ownerId: string) =>
    ({
      ...context,
      near: { ...context.near, primaryAccountId: ownerId },
      allowPrivateSubmission: true,
    }) as Context;

  const propose = async (subject: Subject, context: Context) => {
    await listings().markCatalogListingPending({
      kind: subject.kind,
      entityId: subject.entityId,
      ownerId: subject.ownerId,
      slug: subject.slug,
    });
    const listing = await loadListing(subject.kind, subject.entityId);
    const slug = listing?.slug ?? subject.slug;
    const record = subject.kind === "project" ? { ...subject.record, slug } : { ...subject.record };
    const proposal = await plugins.proposals(ownerContext(context, subject.ownerId)).propose({
      pluginId: CATALOG_LISTING_PLUGIN_ID,
      entityId: catalogListingEntityId(subject.kind, subject.entityId),
      payload: {
        kind: subject.kind,
        entityId: subject.entityId,
        ownerId: subject.ownerId,
        slug,
        title: subject.title,
        link: subject.link,
        record,
      },
      source: CATALOG_LISTING_PLUGIN_ID,
    });
    return proposal.data;
  };

  const takeOut = async (kind: CatalogListingKind, entityId: string, context: Context) => {
    const proposal = await latestProposal(kind, entityId);
    if (proposal?.reviewStatus === "pending") {
      const target = {
        pluginId: CATALOG_LISTING_PLUGIN_ID,
        entityId: proposal.entityId,
        expectedUpdatedAt: proposal.updatedAt,
      };
      if (isAdmin(context)) {
        await plugins.proposals(context).reject({
          ...target,
          reason: "No longer eligible for NEAR Catalog",
        });
      } else {
        await plugins.proposals(ownerContext(context, proposal.createdBy)).withdraw(target);
      }
    }
    return (await listings().withdrawCatalogListing({ kind, entityId })).data;
  };

  const status = async (kind: CatalogListingKind, entityId: string, context: Context) => {
    const listing = await loadListing(kind, entityId);
    const [subject, proposal] = await Promise.all([
      loadSubject(kind, entityId, context, listing),
      latestProposal(kind, entityId),
    ]);
    const current = listing?.status ?? "none";
    return {
      kind,
      entityId,
      status: current,
      slug: listing?.slug ?? null,
      listed: Boolean(listing?.record && current !== "none" && current !== "rejected"),
      rejectionReason: current === "rejected" ? (proposal?.rejectionReason ?? null) : null,
      eligible: subject.eligible,
      ineligibleReason: subject.ineligibleReason,
      missing: subject.missing,
      record: subject.record as Record<string, unknown>,
      approvedRecord: listing?.record ?? null,
    };
  };

  return {
    async submit(input: { kind: CatalogListingKind; projectId?: string }, context: Context) {
      const target = await resolveTarget(input, context);
      const listing = await loadListing(target.kind, target.entityId);
      const subject = await loadSubject(target.kind, target.entityId, context, listing);
      if (!subject.eligible) {
        throw new ORPCError("BAD_REQUEST", { message: subject.ineligibleReason ?? "Not eligible" });
      }
      if (subject.missing.length > 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: `Fill in the NEAR Catalog fields first: ${subject.missing.join(", ")}`,
        });
      }
      if (
        listing &&
        (listing.status === "approved" || listing.status === "published") &&
        sameCatalogRecord(listing.record, subject.record as Record<string, unknown>)
      ) {
        throw new ORPCError("BAD_REQUEST", {
          message: "This listing is already approved for NEAR Catalog",
        });
      }
      await propose(subject, context);
      return { data: await status(target.kind, target.entityId, context) };
    },

    async withdraw(input: { kind: CatalogListingKind; projectId?: string }, context: Context) {
      const target = await resolveTarget(input, context);
      await takeOut(target.kind, target.entityId, context);
      return { data: await status(target.kind, target.entityId, context) };
    },

    async getStatus(input: { kind: CatalogListingKind; projectId?: string }, context: Context) {
      const target = await resolveTarget(input, context);
      return { data: await status(target.kind, target.entityId, context) };
    },

    async sync(kind: CatalogListingKind, entityId: string, context: Context) {
      const listing = await loadListing(kind, entityId);
      if (!listing || listing.status === "none" || listing.status === "rejected") return;
      let subject: Subject;
      try {
        subject = await loadSubject(kind, entityId, context, listing);
      } catch (error) {
        if ((error as { code?: unknown } | null)?.code === "NOT_FOUND") {
          await takeOut(kind, entityId, context);
          return;
        }
        throw error;
      }
      if (!subject.eligible || subject.missing.length > 0) {
        await takeOut(kind, entityId, context);
        return;
      }
      const record = subject.record as Record<string, unknown>;
      if (listing.status === "pending") {
        const proposal = await latestProposal(kind, entityId);
        const pendingRecord =
          proposal?.reviewStatus === "pending"
            ? readCatalogListingPayload(proposal.payload).record
            : null;
        if (!sameCatalogRecord(pendingRecord, record)) await propose(subject, context);
        return;
      }
      if (hasMajorCatalogChange(kind, listing.record, record)) {
        await propose(subject, context);
        return;
      }
      if (!sameCatalogRecord(listing.record, record)) {
        await listings().refreshCatalogListingRecord({ kind, entityId, record });
      }
    },

    takeOut,

    async apply(proposal: { payload: unknown; createdBy: string }, context: Context) {
      if (isSystemActor(context) || !isAdmin(context)) {
        throw new ORPCError("FORBIDDEN", {
          message: "NEAR Catalog listings need a human admin to approve them",
        });
      }
      const payload = readCatalogListingPayload(proposal.payload);
      const subject = await loadSubject(payload.kind, payload.entityId, context, null);
      if (!subject.eligible) {
        throw new ORPCError("BAD_REQUEST", {
          message: subject.ineligibleReason ?? "No longer eligible for NEAR Catalog",
        });
      }
      const approvedBy = context.near?.primaryAccountId ?? context.userId ?? context.user?.id;
      const result = await listings().approveCatalogListing({
        kind: payload.kind,
        entityId: payload.entityId,
        ownerId: payload.ownerId,
        slug: payload.slug,
        record: payload.record,
        approvedBy: approvedBy ?? "admin",
      });
      return result.data.id;
    },

    async reject(proposal: { payload: unknown }) {
      const payload = readCatalogListingPayload(proposal.payload);
      await listings().rejectCatalogListing({ kind: payload.kind, entityId: payload.entityId });
    },

    async remove(proposal: { payload: unknown }) {
      const payload = readCatalogListingPayload(proposal.payload);
      await listings().withdrawCatalogListing({ kind: payload.kind, entityId: payload.entityId });
    },
  };
}

export type CatalogListings = ReturnType<typeof createCatalogListings>;
