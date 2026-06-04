import { z } from "every-plugin/zod";
export declare const VoteEventSchema: z.ZodObject<{
    type: z.ZodEnum<{
        upvote: "upvote";
        downvote: "downvote";
    }>;
    entityId: z.ZodString;
    userId: z.ZodString;
    timestamp: z.ZodString;
    totalCount: z.ZodNumber;
}, z.core.$strip>;
export declare const contract: {
    upvote: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        entityId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        entityId: z.ZodString;
        userId: z.ZodString;
        totalCount: z.ZodNumber;
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
    downvote: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        entityId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        entityId: z.ZodString;
        totalCount: z.ZodNumber;
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
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    getUpvoteCount: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        entityId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        entityId: z.ZodString;
        totalCount: z.ZodNumber;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
    getUserVote: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        entityId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        entityId: z.ZodString;
        hasUpvote: z.ZodBoolean;
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
    getUserVotes: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        entityIds: z.ZodArray<z.ZodString>;
    }, z.core.$strip>, z.ZodRecord<z.ZodString, z.ZodObject<{
        entityId: z.ZodString;
        hasUpvote: z.ZodBoolean;
    }, z.core.$strip>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
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
    getUpvoteCounts: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        entityIds: z.ZodArray<z.ZodString>;
    }, z.core.$strip>, z.ZodRecord<z.ZodString, z.ZodObject<{
        entityId: z.ZodString;
        totalCount: z.ZodNumber;
    }, z.core.$strip>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
    getUpvoteFeed: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        limit: z.ZodOptional<z.ZodNumber>;
        cursor: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            entityId: z.ZodString;
            userId: z.ZodString;
            createdAt: z.ZodISODateTime;
        }, z.core.$strip>>;
        meta: z.ZodObject<{
            total: z.ZodNumber;
            hasMore: z.ZodBoolean;
            nextCursor: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
    subscribe: import("@orpc/contract").ContractProcedure<import("@orpc/contract").Schema<unknown, unknown>, import("@orpc/contract").Schema<AsyncIteratorObject<{
        type: "upvote" | "downvote";
        entityId: string;
        userId: string;
        timestamp: string;
        totalCount: number;
    }, unknown, void>, import("@orpc/shared").AsyncIteratorClass<{
        type: "upvote" | "downvote";
        entityId: string;
        userId: string;
        timestamp: string;
        totalCount: number;
    }, unknown, void>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
};
export type ContractType = typeof contract;
