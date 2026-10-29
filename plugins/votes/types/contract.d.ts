import "@orpc/openapi/extensions/route";
import { z } from "zod";
export declare const VoteEventSchema: z.ZodObject<{
    type: z.ZodEnum<{
        downvote: "downvote";
        upvote: "upvote";
    }>;
    entityId: z.ZodString;
    userId: z.ZodString;
    timestamp: z.ZodString;
    totalCount: z.ZodNumber;
}, z.core.$strip>;
export declare const contract: {
    upvote: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        entityId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        entityId: z.ZodString;
        userId: z.ZodString;
        totalCount: z.ZodNumber;
    }, z.core.$strip>, {
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
    }>;
    downvote: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        entityId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        entityId: z.ZodString;
        totalCount: z.ZodNumber;
    }, z.core.$strip>, {
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
    }>;
    getUpvoteCount: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        entityId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        entityId: z.ZodString;
        totalCount: z.ZodNumber;
    }, z.core.$strip>, object>;
    getUserVote: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        entityId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        entityId: z.ZodString;
        hasUpvote: z.ZodBoolean;
    }, z.core.$strip>, {
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
    }>;
    getUserVotes: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        entityIds: z.ZodArray<z.ZodString>;
    }, z.core.$strip>, z.ZodRecord<z.ZodString, z.ZodObject<{
        entityId: z.ZodString;
        hasUpvote: z.ZodBoolean;
    }, z.core.$strip>>, {
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
    }>;
    getUpvoteCounts: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        entityIds: z.ZodArray<z.ZodString>;
    }, z.core.$strip>, z.ZodRecord<z.ZodString, z.ZodObject<{
        entityId: z.ZodString;
        totalCount: z.ZodNumber;
    }, z.core.$strip>>, object>;
    getUpvoteFeed: import("@orpc/contract").ProcedureContract<z.ZodObject<{
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
    }, z.core.$strip>, object>;
    subscribe: import("@orpc/contract").ProcedureContract<import("@orpc/contract").InitialInputSchema, import("@orpc/contract").Schema<AsyncIteratorObject<{
        type: "downvote" | "upvote";
        entityId: string;
        userId: string;
        timestamp: string;
        totalCount: number;
    }, unknown, void>, import("@orpc/server").AsyncIteratorClass<{
        type: "downvote" | "upvote";
        entityId: string;
        userId: string;
        timestamp: string;
        totalCount: number;
    }, unknown, void>>, object>;
};
export type ContractType = typeof contract;
