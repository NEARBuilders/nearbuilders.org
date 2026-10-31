import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import type { z } from "zod";
import {
  CatalogExportPersonSchema,
  CatalogExportProjectSchema,
  type CatalogListingKindSchema,
  type CatalogListingSchema,
} from "../contract";
import type { Database } from "../db";
import { DatabaseTag } from "../db/layer";
import { nearcatalogListings } from "../db/schema";
import { type CatalogSubmitClient, catalogExternalId, catalogPageUrl } from "./catalog-submit";

export type CatalogListing = z.infer<typeof CatalogListingSchema>;
export type CatalogListingKind = z.infer<typeof CatalogListingKindSchema>;
type ListingRow = typeof nearcatalogListings.$inferSelect;
type ListingTarget = { kind: CatalogListingKind; entityId: string };
type ExportedProject = z.infer<typeof CatalogExportProjectSchema>;
type ExportedPerson = z.infer<typeof CatalogExportPersonSchema>;

const LISTED_STATUSES = ["approved", "published", "pending"] as const;
const REMOVED_STATUSES = ["none", "rejected"] as const;
const SEND_LIST_LIMIT = 100;

function readText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function toIsoOrNull(value: Date | string | null): string | null {
  return value ? toIso(value) : null;
}

export function catalogListingId(kind: CatalogListingKind, entityId: string) {
  return `${kind}:${entityId}`;
}

function rowToListing(row: ListingRow): CatalogListing {
  return {
    id: row.id,
    kind: row.kind,
    entityId: row.entityId,
    ownerId: row.ownerId,
    slug: row.slug,
    status: row.status,
    record: row.record ?? null,
    approvedBy: row.approvedBy,
    approvedAt: toIsoOrNull(row.approvedAt),
    publishedAt: toIsoOrNull(row.publishedAt),
    removedAt: toIsoOrNull(row.removedAt),
    catalogUrl: row.catalogUrl ?? null,
    sendStatus: row.sendStatus ?? null,
    sendAction: row.sendAction ?? null,
    sendError: row.sendError ?? null,
    sendAttemptedAt: toIsoOrNull(row.sendAttemptedAt),
    sentAt: toIsoOrNull(row.sentAt),
    changedAt: toIso(row.changedAt),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

export function parseCatalogRecord(kind: CatalogListingKind, record: unknown) {
  const schema = kind === "project" ? CatalogExportProjectSchema : CatalogExportPersonSchema;
  const parsed = schema.safeParse(record);
  if (!parsed.success) {
    return Effect.fail(
      new ORPCError("BAD_REQUEST", {
        message: `Invalid NEAR Catalog ${kind} record: ${parsed.error.issues
          .map((issue) => issue.path.join(".") || issue.message)
          .join(", ")}`,
      }),
    );
  }
  return Effect.succeed(parsed.data as Record<string, unknown>);
}

function isListedRow(row: ListingRow) {
  return Boolean(row.record) && (row.status === "approved" || row.status === "published");
}

const NO_REMOVE_ROUTE =
  "NEAR Catalog has no partner remove route. Ask the NEAR Catalog team to hide this listing.";

function sendActionFor(row: ListingRow): "upsert" | "remove" | null {
  if (row.kind !== "project") return null;
  if (row.status === "pending") return null;
  if (isListedRow(row)) return "upsert";
  if (!row.sendStatus) return null;
  if (row.sendAction === "remove" && row.sendStatus === "sent") return null;
  return "remove";
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500) || "NEAR Catalog request failed";
}

export function createListingMethods(db: Database, submitter: CatalogSubmitClient | null = null) {
  const load = (target: ListingTarget) =>
    Effect.promise(() =>
      db
        .select()
        .from(nearcatalogListings)
        .where(
          and(
            eq(nearcatalogListings.kind, target.kind),
            eq(nearcatalogListings.entityId, target.entityId),
          ),
        )
        .limit(1),
    ).pipe(Effect.map((rows) => rows[0] ?? null));

  const uniqueSlug = (target: ListingTarget, slug: string) =>
    Effect.gen(function* () {
      const rows = yield* Effect.promise(() =>
        db
          .select({ entityId: nearcatalogListings.entityId, status: nearcatalogListings.status })
          .from(nearcatalogListings)
          .where(
            and(eq(nearcatalogListings.kind, target.kind), eq(nearcatalogListings.slug, slug)),
          ),
      );
      const taken = rows.some((row) => row.entityId !== target.entityId && row.status !== "none");
      if (!taken) return slug;
      const suffix = target.entityId
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 6);
      return `${slug.slice(0, 113)}-${suffix || "2"}`;
    });

  const update = (
    target: ListingTarget,
    values: Partial<typeof nearcatalogListings.$inferInsert>,
  ) =>
    Effect.promise(() =>
      db
        .update(nearcatalogListings)
        .set(values)
        .where(
          and(
            eq(nearcatalogListings.kind, target.kind),
            eq(nearcatalogListings.entityId, target.entityId),
          ),
        )
        .returning(),
    ).pipe(Effect.map((rows) => (rows[0] ? rowToListing(rows[0]) : null)));

  const request = (row: ListingRow, action: "upsert" | "remove") =>
    Effect.promise(async () => {
      if (!submitter) return { ok: false as const, error: "Sending to NEAR Catalog is off" };
      if (action === "remove") return { ok: false as const, error: NO_REMOVE_ROUTE };
      try {
        const result = await submitter.upsertProject({
          externalId: catalogExternalId(row.kind, row.entityId),
          record: { ...row.record, slug: row.slug },
        });
        return { ok: true as const, fallbackContact: result.fallbackContact };
      } catch (error) {
        return { ok: false as const, error: errorMessage(error) };
      }
    });

  const deliver = (target: ListingTarget) =>
    Effect.gen(function* () {
      const row = yield* load(target);
      if (!row) return null;
      const action = submitter ? sendActionFor(row) : null;
      if (!action) return rowToListing(row);
      const outcome = yield* request(row, action);
      const now = new Date();
      if (!outcome.ok) {
        return yield* update(target, {
          sendStatus: "failed",
          sendAction: action,
          sendError: outcome.error,
          sendAttemptedAt: now,
          updatedAt: now,
        });
      }
      if (outcome.fallbackContact) {
        yield* Effect.logWarning(
          `NEAR Catalog: ${row.kind} ${row.entityId} has no public team contact, sent with NEARCATALOG_CONTACT`,
        );
      }
      return yield* update(target, {
        sendStatus: "sent",
        sendAction: "upsert",
        sendError: null,
        sendAttemptedAt: now,
        sentAt: now,
        updatedAt: now,
      });
    });

  return {
    sendingEnabled: () => submitter !== null,

    getListing: (target: ListingTarget) =>
      load(target).pipe(Effect.map((row) => (row ? rowToListing(row) : null))),

    markPending: (input: ListingTarget & { ownerId: string; slug: string }) =>
      Effect.gen(function* () {
        const existing = yield* load(input);
        const now = new Date();
        const keepsApproved =
          existing?.record && existing.status !== "none" && existing.status !== "rejected";
        const slug = keepsApproved ? existing.slug : yield* uniqueSlug(input, input.slug);
        const [row] = yield* Effect.promise(() =>
          db
            .insert(nearcatalogListings)
            .values({
              id: catalogListingId(input.kind, input.entityId),
              kind: input.kind,
              entityId: input.entityId,
              ownerId: input.ownerId,
              slug,
              status: "pending",
              record: null,
              changedAt: now,
              createdAt: now,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: [nearcatalogListings.kind, nearcatalogListings.entityId],
              set: {
                ownerId: input.ownerId,
                slug,
                status: "pending",
                record: keepsApproved ? existing.record : null,
                publishedAt: keepsApproved ? existing.publishedAt : null,
                updatedAt: now,
              },
            })
            .returning(),
        );
        if (!row) {
          return yield* Effect.fail(
            new ORPCError("INTERNAL_SERVER_ERROR", { message: "Could not save catalog listing" }),
          );
        }
        return rowToListing(row);
      }),

    approve: (
      input: ListingTarget & {
        ownerId: string;
        slug: string;
        record: Record<string, unknown>;
        approvedBy: string;
      },
    ) =>
      Effect.gen(function* () {
        const record = yield* parseCatalogRecord(input.kind, input.record);
        const existing = yield* load(input);
        const now = new Date();
        const slug = existing?.slug ?? input.slug;
        const [row] = yield* Effect.promise(() =>
          db
            .insert(nearcatalogListings)
            .values({
              id: catalogListingId(input.kind, input.entityId),
              kind: input.kind,
              entityId: input.entityId,
              ownerId: input.ownerId,
              slug,
              status: "approved",
              record,
              approvedBy: input.approvedBy,
              approvedAt: now,
              removedAt: null,
              changedAt: now,
              createdAt: now,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: [nearcatalogListings.kind, nearcatalogListings.entityId],
              set: {
                ownerId: input.ownerId,
                status: existing?.publishedAt ? "published" : "approved",
                record,
                approvedBy: input.approvedBy,
                approvedAt: now,
                removedAt: null,
                changedAt: now,
                updatedAt: now,
              },
            })
            .returning(),
        );
        if (!row) {
          return yield* Effect.fail(
            new ORPCError("INTERNAL_SERVER_ERROR", { message: "Could not save catalog listing" }),
          );
        }
        return (yield* deliver(input)) ?? rowToListing(row);
      }),

    reject: (target: ListingTarget) =>
      Effect.gen(function* () {
        const existing = yield* load(target);
        if (!existing) return null;
        const now = new Date();
        yield* update(target, {
          status: "rejected",
          publishedAt: null,
          removedAt: existing.record ? now : existing.removedAt,
          changedAt: existing.record ? now : existing.changedAt,
          updatedAt: now,
        });
        return yield* deliver(target);
      }),

    withdraw: (target: ListingTarget) =>
      Effect.gen(function* () {
        const existing = yield* load(target);
        if (!existing) return null;
        if (existing.status === "none") return rowToListing(existing);
        const now = new Date();
        yield* update(target, {
          status: "none",
          publishedAt: null,
          removedAt: existing.record ? now : existing.removedAt,
          changedAt: existing.record ? now : existing.changedAt,
          updatedAt: now,
        });
        return yield* deliver(target);
      }),

    listListed: (kind: CatalogListingKind) =>
      Effect.gen(function* () {
        const rows = yield* Effect.promise(() =>
          db
            .select()
            .from(nearcatalogListings)
            .where(
              and(
                eq(nearcatalogListings.kind, kind),
                isNotNull(nearcatalogListings.record),
                inArray(nearcatalogListings.status, [...LISTED_STATUSES]),
              ),
            )
            .orderBy(asc(nearcatalogListings.entityId)),
        );
        return rows.map((row) => {
          const published = row.status === "published" || Boolean(row.publishedAt);
          return {
            kind: row.kind,
            entityId: row.entityId,
            slug: row.slug,
            status: published ? ("published" as const) : ("approved" as const),
            catalogUrl: published ? (row.catalogUrl ?? catalogPageUrl(row.kind, row.slug)) : null,
          };
        });
      }),

    markPublished: (target: ListingTarget & { slug?: string }) =>
      Effect.gen(function* () {
        const existing = yield* load(target);
        if (!existing) {
          return yield* Effect.fail(
            new ORPCError("NOT_FOUND", { message: "Catalog listing not found" }),
          );
        }
        if (
          !existing.record ||
          (existing.status !== "approved" && existing.status !== "published")
        ) {
          return yield* Effect.fail(
            new ORPCError("BAD_REQUEST", {
              message: "Only approved listings can be marked as published",
            }),
          );
        }
        const now = new Date();
        const slug = target.slug ?? existing.slug;
        const updated = yield* update(target, {
          status: "published",
          slug,
          publishedAt: existing.publishedAt ?? now,
          changedAt: slug !== existing.slug ? now : existing.changedAt,
          updatedAt: now,
        });
        if (!updated) {
          return yield* Effect.fail(
            new ORPCError("NOT_FOUND", { message: "Catalog listing not found" }),
          );
        }
        return updated;
      }),

    refreshRecord: (target: ListingTarget & { record: Record<string, unknown> }) =>
      Effect.gen(function* () {
        const record = yield* parseCatalogRecord(target.kind, target.record);
        const existing = yield* load(target);
        if (!existing || (existing.status !== "approved" && existing.status !== "published")) {
          return existing ? rowToListing(existing) : null;
        }
        const now = new Date();
        yield* update(target, { record, changedAt: now, updatedAt: now });
        return yield* deliver(target);
      }),

    retrySend: (target: ListingTarget) =>
      Effect.gen(function* () {
        if (!submitter) {
          return yield* Effect.fail(
            new ORPCError("BAD_REQUEST", { message: "Sending to NEAR Catalog is not set up" }),
          );
        }
        const existing = yield* load(target);
        if (!existing) {
          return yield* Effect.fail(
            new ORPCError("NOT_FOUND", { message: "Catalog listing not found" }),
          );
        }
        const notSent = isListedRow(existing) && !existing.sendStatus;
        if (existing.sendStatus !== "failed" && !notSent) {
          return yield* Effect.fail(
            new ORPCError("BAD_REQUEST", { message: "Nothing to send for this listing" }),
          );
        }
        const listing = yield* deliver(target);
        if (!listing) {
          return yield* Effect.fail(
            new ORPCError("NOT_FOUND", { message: "Catalog listing not found" }),
          );
        }
        return listing;
      }),

    listSends: () =>
      Effect.gen(function* () {
        const rows = yield* Effect.promise(() =>
          db
            .select()
            .from(nearcatalogListings)
            .where(
              or(
                isNotNull(nearcatalogListings.sendStatus),
                and(
                  isNotNull(nearcatalogListings.record),
                  inArray(nearcatalogListings.status, ["approved", "published"]),
                  isNull(nearcatalogListings.sendStatus),
                ),
              ),
            )
            .orderBy(
              desc(sql`${nearcatalogListings.sendStatus} = 'failed'`),
              desc(nearcatalogListings.updatedAt),
            )
            .limit(SEND_LIST_LIMIT),
        );
        return { enabled: submitter !== null, data: rows.map(rowToListing) };
      }),
  };
}

export function createExportMethods(db: Database) {
  const loadRows = (
    kind: CatalogListingKind,
    statuses: ReadonlyArray<ListingRow["status"]>,
    since?: string,
  ) =>
    Effect.promise(() =>
      db
        .select()
        .from(nearcatalogListings)
        .where(
          and(
            eq(nearcatalogListings.kind, kind),
            isNotNull(nearcatalogListings.record),
            inArray(nearcatalogListings.status, [...statuses]),
            since ? gt(nearcatalogListings.changedAt, new Date(since)) : undefined,
          ),
        )
        .orderBy(asc(nearcatalogListings.changedAt), asc(nearcatalogListings.id)),
    );

  const meta = (since: string | undefined, count: number) => ({
    generatedAt: new Date().toISOString(),
    since: since ?? null,
    count,
  });

  return {
    exportProjects: (since?: string) =>
      Effect.gen(function* () {
        const [listed, removed] = yield* Effect.all([
          loadRows("project", LISTED_STATUSES, since),
          since ? loadRows("project", REMOVED_STATUSES, since) : Effect.succeed([]),
        ]);
        const data = listed.flatMap((row) => {
          const parsed = CatalogExportProjectSchema.safeParse({ ...row.record, slug: row.slug });
          return parsed.success ? [parsed.data as ExportedProject] : [];
        });
        return {
          data,
          removed: removed.map((row) => {
            const source = (row.record?.source ?? {}) as Record<string, unknown>;
            return {
              slug: row.slug,
              nearAccount: readText(source.nearAccount) || row.ownerId,
              removedAt: toIso(row.removedAt ?? row.changedAt),
            };
          }),
          meta: meta(since, data.length),
        };
      }),

    exportPeople: (since?: string) =>
      Effect.gen(function* () {
        const [listed, removed, projects] = yield* Effect.all([
          loadRows("person", LISTED_STATUSES, since),
          since ? loadRows("person", REMOVED_STATUSES, since) : Effect.succeed([]),
          loadRows("project", LISTED_STATUSES),
        ]);
        const projectsByOwner = new Map<string, string[]>();
        for (const project of projects) {
          const owner = project.ownerId.toLowerCase();
          const titles = projectsByOwner.get(owner) ?? [];
          titles.push(readText(project.record?.title) || project.slug);
          projectsByOwner.set(owner, titles);
        }
        const data = listed.flatMap((row) => {
          const parsed = CatalogExportPersonSchema.safeParse({
            ...row.record,
            nearAccount: row.entityId,
            nearProjects: (projectsByOwner.get(row.entityId.toLowerCase()) ?? []).join(", "),
          });
          return parsed.success ? [parsed.data as ExportedPerson] : [];
        });
        return {
          data,
          removed: removed.map((row) => ({
            nearAccount: row.entityId,
            name: readText(row.record?.name),
            removedAt: toIso(row.removedAt ?? row.changedAt),
          })),
          meta: meta(since, data.length),
        };
      }),
  };
}

type ListingMethods = ReturnType<typeof createListingMethods> &
  ReturnType<typeof createExportMethods>;

export class ListingService extends Context.Service<ListingService, ListingMethods>()(
  "nearcatalog/ListingService",
) {}

export const ListingServiceLive = (submitter: CatalogSubmitClient | null = null) =>
  Layer.effect(
    ListingService,
    Effect.gen(function* () {
      const db = yield* DatabaseTag;
      return { ...createListingMethods(db, submitter), ...createExportMethods(db) };
    }),
  );
