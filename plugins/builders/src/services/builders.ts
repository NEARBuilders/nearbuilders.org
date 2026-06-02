import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { Context, Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { DatabaseTag } from "../db/layer";
import { builders } from "../db/schema";

function toIsoString(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString();
  return typeof value === "string" ? value : value.toISOString();
}

function parseSkills(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseLinks(raw: string | null): Record<string, string> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function serializeSkills(skills?: string[]): string {
  return JSON.stringify(skills ?? []);
}

function serializeLinks(links?: Record<string, string>): string | null {
  if (!links || Object.keys(links).length === 0) return null;
  return JSON.stringify(links);
}

export interface Builder {
  id: string;
  nearAccount: string;
  userId: string | null;
  name: string | null;
  bio: string | null;
  skills: string[];
  location: string | null;
  links: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
}

function rowToBuilder(row: any): Builder {
  return {
    id: row.id,
    nearAccount: row.nearAccount,
    userId: row.userId ?? null,
    name: row.name ?? null,
    bio: row.bio ?? null,
    skills: parseSkills(row.skills),
    location: row.location ?? null,
    links: parseLinks(row.links),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function generateId(): string {
  return `bld_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export class BuilderService extends Context.Tag("builders/BuilderService")<
  BuilderService,
  {
    listBuilders: (input: {
      search?: string;
      skill?: string;
      limit?: number;
      cursor?: string;
    }) => Effect.Effect<
      {
        data: Builder[];
        meta: { total: number; hasMore: boolean; nextCursor: string | null };
      },
      ORPCError<string, unknown>
    >;

    getBuilder: (nearAccount: string) => Effect.Effect<Builder | null, ORPCError<string, unknown>>;

    getBuilderByUserId: (
      userId: string,
      walletAddress?: string,
    ) => Effect.Effect<Builder | null, ORPCError<string, unknown>>;

    createBuilder: (input: {
      nearAccount: string;
      userId?: string;
      name?: string;
      bio?: string;
      skills?: string[];
      location?: string;
      links?: Record<string, string>;
    }) => Effect.Effect<Builder, ORPCError<string, unknown>>;

    updateBuilderProfile: (
      nearAccount: string,
      input: {
        name?: string;
        bio?: string;
        skills?: string[];
        location?: string;
        links?: Record<string, string>;
      },
      userId: string,
      walletAddress?: string,
      userRole?: string,
    ) => Effect.Effect<Builder, ORPCError<string, unknown>>;

    deleteBuilder: (
      nearAccount: string,
    ) => Effect.Effect<{ deleted: boolean }, ORPCError<string, unknown>>;
  }
>() {}

export const BuilderServiceLive = Layer.effect(
  BuilderService,
  Effect.gen(function* () {
    const db = yield* DatabaseTag;

    return {
      listBuilders: (input) =>
        Effect.gen(function* () {
          const limit = Math.min(input.limit ?? 24, 100);
          const offset = input.cursor ? parseInt(input.cursor, 10) : 0;
          const conditions: any[] = [];

          if (input.search) {
            const pattern = `%${input.search}%`;
            conditions.push(
              or(
                ilike(builders.nearAccount, pattern),
                ilike(builders.name, pattern),
                ilike(builders.bio, pattern),
                ilike(builders.location, pattern),
                ilike(builders.skills, pattern),
              ),
            );
          }

          if (input.skill) {
            conditions.push(ilike(builders.skills, `%${input.skill}%`));
          }

          const whereClause = and(...conditions);

          const [totalResult] = yield* Effect.promise(() =>
            db.select({ count: count() }).from(builders).where(whereClause),
          );

          const total = totalResult?.count ?? 0;

          const records = yield* Effect.promise(() =>
            db
              .select()
              .from(builders)
              .where(whereClause)
              .orderBy(desc(builders.createdAt))
              .limit(limit)
              .offset(offset),
          );

          const nextOffset = offset + limit;
          const hasMore = nextOffset < total;

          return {
            data: records.map(rowToBuilder),
            meta: {
              total,
              hasMore,
              nextCursor: hasMore ? String(nextOffset) : null,
            },
          };
        }),

      getBuilder: (nearAccount) =>
        Effect.gen(function* () {
          const [row] = yield* Effect.promise(() =>
            db.select().from(builders).where(eq(builders.nearAccount, nearAccount)).limit(1),
          );
          return row ? rowToBuilder(row) : null;
        }),

      getBuilderByUserId: (userId, walletAddress) =>
        Effect.gen(function* () {
          const conditions: any[] = [];
          if (walletAddress) conditions.push(eq(builders.nearAccount, walletAddress));
          conditions.push(eq(builders.userId, userId));

          const [row] = yield* Effect.promise(() =>
            db
              .select()
              .from(builders)
              .where(and(or(...conditions)))
              .limit(1),
          );
          return row ? rowToBuilder(row) : null;
        }),

      createBuilder: (input) =>
        Effect.gen(function* () {
          const [existing] = yield* Effect.promise(() =>
            db.select().from(builders).where(eq(builders.nearAccount, input.nearAccount)).limit(1),
          );

          if (existing) {
            const now = new Date();
            yield* Effect.promise(() =>
              db
                .update(builders)
                .set({
                  userId: input.userId ?? existing.userId,
                  name: input.name?.trim() ?? existing.name,
                  bio: input.bio?.trim() ?? existing.bio,
                  skills:
                    input.skills !== undefined ? serializeSkills(input.skills) : existing.skills,
                  location: input.location?.trim() ?? existing.location,
                  links: input.links !== undefined ? serializeLinks(input.links) : existing.links,
                  updatedAt: now,
                })
                .where(eq(builders.nearAccount, input.nearAccount)),
            );

            const [updated] = yield* Effect.promise(() =>
              db
                .select()
                .from(builders)
                .where(eq(builders.nearAccount, input.nearAccount))
                .limit(1),
            );

            return rowToBuilder(updated);
          }

          const now = new Date();
          const id = generateId();

          yield* Effect.promise(() =>
            db.insert(builders).values({
              id,
              nearAccount: input.nearAccount,
              userId: input.userId ?? null,
              name: input.name?.trim() ?? null,
              bio: input.bio?.trim() ?? null,
              skills: serializeSkills(input.skills),
              location: input.location?.trim() ?? null,
              links: serializeLinks(input.links),
              createdAt: now,
              updatedAt: now,
            }),
          );

          return {
            id,
            nearAccount: input.nearAccount,
            userId: input.userId ?? null,
            name: input.name?.trim() ?? null,
            bio: input.bio?.trim() ?? null,
            skills: input.skills ?? [],
            location: input.location?.trim() ?? null,
            links: input.links && Object.keys(input.links).length > 0 ? input.links : null,
            createdAt: toIsoString(now),
            updatedAt: toIsoString(now),
          };
        }),

      updateBuilderProfile: (nearAccount, input, userId, walletAddress, userRole) =>
        Effect.gen(function* () {
          const [existing] = yield* Effect.promise(() =>
            db.select().from(builders).where(eq(builders.nearAccount, nearAccount)).limit(1),
          );

          if (!existing) {
            return yield* Effect.fail(
              new ORPCError("NOT_FOUND", { message: "Builder profile not found" }),
            );
          }

          const isOwner =
            existing.nearAccount === walletAddress ||
            existing.nearAccount === userId ||
            existing.userId === userId;

          if (userRole !== "admin" && !isOwner) {
            return yield* Effect.fail(
              new ORPCError("FORBIDDEN", {
                message: "You do not have permission to edit this profile",
              }),
            );
          }

          const now = new Date();
          const updates: any = { updatedAt: now };

          if (input.name !== undefined) updates.name = input.name.trim() || null;
          if (input.bio !== undefined) updates.bio = input.bio.trim() || null;
          if (input.skills !== undefined) updates.skills = serializeSkills(input.skills);
          if (input.location !== undefined) updates.location = input.location.trim() || null;
          if (input.links !== undefined) updates.links = serializeLinks(input.links);

          yield* Effect.promise(() =>
            db.update(builders).set(updates).where(eq(builders.nearAccount, nearAccount)),
          );

          const [updated] = yield* Effect.promise(() =>
            db.select().from(builders).where(eq(builders.nearAccount, nearAccount)).limit(1),
          );

          return rowToBuilder(updated);
        }),

      deleteBuilder: (nearAccount) =>
        Effect.gen(function* () {
          const [existing] = yield* Effect.promise(() =>
            db.select().from(builders).where(eq(builders.nearAccount, nearAccount)).limit(1),
          );

          if (!existing) {
            return yield* Effect.fail(
              new ORPCError("NOT_FOUND", { message: "Builder profile not found" }),
            );
          }

          yield* Effect.promise(() =>
            db.delete(builders).where(eq(builders.nearAccount, nearAccount)),
          );

          return { deleted: true };
        }),
    };
  }),
);
