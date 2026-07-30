import { z } from "every-plugin/zod";
export declare const contract: {
    createTelegramNomination: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        headers: z.ZodObject<{
            "idempotency-key": z.ZodString;
        }, z.core.$strip>;
        body: z.ZodObject<{
            source: z.ZodLiteral<"telegram">;
            sourceNominationId: z.ZodString;
            nomineeTelegramId: z.ZodNumber;
            nomineeUsername: z.ZodNullable<z.ZodString>;
            nominatedByTelegramId: z.ZodNumber;
            telegramGroupId: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodUnion<readonly [z.ZodObject<{
        status: z.ZodLiteral<200>;
        headers: z.ZodRecord<z.ZodString, z.ZodString>;
        body: z.ZodObject<{
            nominationId: z.ZodString;
            joinUrl: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        status: z.ZodLiteral<201>;
        headers: z.ZodRecord<z.ZodString, z.ZodString>;
        body: z.ZodObject<{
            nominationId: z.ZodString;
            joinUrl: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip>]>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
        IDEMPOTENCY_CONFLICT: {
            readonly status: 409;
            readonly message: "Idempotency key conflicts with an existing nomination";
        };
    }>>, Record<never, never>>;
    resolveTelegramNomination: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        token: z.ZodString;
    }, z.core.$strip>, z.ZodDiscriminatedUnion<[z.ZodObject<{
        nominationId: z.ZodString;
        source: z.ZodLiteral<"telegram">;
        status: z.ZodLiteral<"ready">;
    }, z.core.$strip>, z.ZodObject<{
        nominationId: z.ZodString;
        source: z.ZodLiteral<"telegram">;
        status: z.ZodLiteral<"submitted">;
    }, z.core.$strip>, z.ZodObject<{
        status: z.ZodLiteral<"invalid">;
    }, z.core.$strip>], "status">, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
    finalizeTelegramNomination: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        token: z.ZodString;
        proposalId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        nominationId: z.ZodString;
        source: z.ZodLiteral<"telegram">;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        INVALID_NOMINATION: {
            readonly status: 404;
            readonly message: "Nomination link is invalid";
        };
        NOMINATION_CONFLICT: {
            readonly status: 409;
            readonly message: "Nomination was submitted by another builder";
        };
    }>>, Record<never, never>>;
    listBuilders: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        search: z.ZodOptional<z.ZodString>;
        skill: z.ZodOptional<z.ZodString>;
        limit: z.ZodOptional<z.ZodNumber>;
        cursor: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            nearAccount: z.ZodString;
            userId: z.ZodNullable<z.ZodString>;
            name: z.ZodNullable<z.ZodString>;
            bio: z.ZodNullable<z.ZodString>;
            skills: z.ZodArray<z.ZodString>;
            location: z.ZodNullable<z.ZodString>;
            links: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>;
            createdAt: z.ZodISODateTime;
            updatedAt: z.ZodISODateTime;
        }, z.core.$strip>>;
        meta: z.ZodObject<{
            total: z.ZodNumber;
            hasMore: z.ZodBoolean;
            nextCursor: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    getBuilder: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        nearAccount: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            nearAccount: z.ZodString;
            userId: z.ZodNullable<z.ZodString>;
            name: z.ZodNullable<z.ZodString>;
            bio: z.ZodNullable<z.ZodString>;
            skills: z.ZodArray<z.ZodString>;
            location: z.ZodNullable<z.ZodString>;
            links: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>;
            createdAt: z.ZodISODateTime;
            updatedAt: z.ZodISODateTime;
        }, z.core.$strip>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    getMyBuilderProfile: import("@orpc/contract").ContractProcedure<z.ZodObject<{}, z.core.$strip>, z.ZodObject<{
        data: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            nearAccount: z.ZodString;
            userId: z.ZodNullable<z.ZodString>;
            name: z.ZodNullable<z.ZodString>;
            bio: z.ZodNullable<z.ZodString>;
            skills: z.ZodArray<z.ZodString>;
            location: z.ZodNullable<z.ZodString>;
            links: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>;
            createdAt: z.ZodISODateTime;
            updatedAt: z.ZodISODateTime;
        }, z.core.$strip>>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    createBuilder: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        nearAccount: z.ZodString;
        userId: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
        bio: z.ZodOptional<z.ZodString>;
        skills: z.ZodOptional<z.ZodArray<z.ZodString>>;
        location: z.ZodOptional<z.ZodString>;
        links: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            nearAccount: z.ZodString;
            userId: z.ZodNullable<z.ZodString>;
            name: z.ZodNullable<z.ZodString>;
            bio: z.ZodNullable<z.ZodString>;
            skills: z.ZodArray<z.ZodString>;
            location: z.ZodNullable<z.ZodString>;
            links: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>;
            createdAt: z.ZodISODateTime;
            updatedAt: z.ZodISODateTime;
        }, z.core.$strip>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    updateBuilderProfile: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        nearAccount: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        bio: z.ZodOptional<z.ZodString>;
        skills: z.ZodOptional<z.ZodArray<z.ZodString>>;
        location: z.ZodOptional<z.ZodString>;
        links: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            nearAccount: z.ZodString;
            userId: z.ZodNullable<z.ZodString>;
            name: z.ZodNullable<z.ZodString>;
            bio: z.ZodNullable<z.ZodString>;
            skills: z.ZodArray<z.ZodString>;
            location: z.ZodNullable<z.ZodString>;
            links: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>;
            createdAt: z.ZodISODateTime;
            updatedAt: z.ZodISODateTime;
        }, z.core.$strip>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    deleteBuilder: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        nearAccount: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        deleted: z.ZodBoolean;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
};
export type ContractType = typeof contract;
