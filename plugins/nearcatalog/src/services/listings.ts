import { and, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import type { z } from "every-plugin/zod";
import {
  CatalogExportPersonSchema,
  CatalogExportProjectSchema,
  type CatalogListingKindSchema,
  type CatalogListingSchema,
} from "../contract";
import type { Database } from "../db";
import { DatabaseTag } from "../db/layer";
import { nearcatalogListings } from "../db/schema";

export type CatalogListing = z.infer<typeof CatalogListingSchema>;
export type CatalogListingKind = z.infer<typeof CatalogListingKindSchema>;
type ListingRow = typeof nearcatalogListings.$inferSelect;
type ListingTarget = { kind: CatalogListingKind; entityId: string };

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

export function createListingMethods(db: Database) {
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

  return {
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
        return rowToListing(row);
      }),

    reject: (target: ListingTarget) =>
      Effect.gen(function* () {
        const existing = yield* load(target);
        if (!existing) return null;
        const now = new Date();
        return yield* update(target, {
          status: "rejected",
          publishedAt: null,
          removedAt: existing.record ? now : existing.removedAt,
          changedAt: existing.record ? now : existing.changedAt,
          updatedAt: now,
        });
      }),

    withdraw: (target: ListingTarget) =>
      Effect.gen(function* () {
        const existing = yield* load(target);
        if (!existing) return null;
        if (existing.status === "none") return rowToListing(existing);
        const now = new Date();
        return yield* update(target, {
          status: "none",
          publishedAt: null,
          removedAt: existing.record ? now : existing.removedAt,
          changedAt: existing.record ? now : existing.changedAt,
          updatedAt: now,
        });
      }),

    refreshRecord: (target: ListingTarget & { record: Record<string, unknown> }) =>
      Effect.gen(function* () {
        const record = yield* parseCatalogRecord(target.kind, target.record);
        const existing = yield* load(target);
        if (!existing || (existing.status !== "approved" && existing.status !== "published")) {
          return existing ? rowToListing(existing) : null;
        }
        const now = new Date();
        return yield* update(target, { record, changedAt: now, updatedAt: now });
      }),
  };
}

type ListingMethods = ReturnType<typeof createListingMethods>;

export class ListingService extends Context.Tag("nearcatalog/ListingService")<
  ListingService,
  ListingMethods
>() {}

export const ListingServiceLive = Layer.effect(
  ListingService,
  Effect.gen(function* () {
    const db = yield* DatabaseTag;
    return createListingMethods(db);
  }),
);
