import { z } from "every-plugin/zod";
export declare const ActivityEventSchema: z.ZodObject<{
    id: z.ZodString;
    source: z.ZodString;
    type: z.ZodString;
    actor: z.ZodString;
    payload: z.ZodUnknown;
    verified: z.ZodBoolean;
    hiddenAt: z.ZodNullable<z.ZodISODateTime>;
    createdAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const ActivityFeedSchema: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        source: z.ZodString;
        type: z.ZodString;
        actor: z.ZodString;
        payload: z.ZodUnknown;
        verified: z.ZodBoolean;
        hiddenAt: z.ZodNullable<z.ZodISODateTime>;
        createdAt: z.ZodISODateTime;
    }, z.core.$strip>>;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        hasMore: z.ZodBoolean;
        nextCursor: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const LeaderboardEntrySchema: z.ZodObject<{
    actor: z.ZodString;
    eventCount: z.ZodNumber;
    endorsementScore: z.ZodNumber;
    topSources: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const ActivityFiltersSchema: z.ZodObject<{
    source: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodString>;
    actor: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const EmitActivityInputSchema: z.ZodObject<{
    source: z.ZodString;
    type: z.ZodString;
    payload: z.ZodUnknown;
}, z.core.$strip>;
export declare const EmitTrustedActivityInputSchema: z.ZodObject<{
    source: z.ZodString;
    type: z.ZodString;
    payload: z.ZodUnknown;
    actor: z.ZodString;
    idempotencyKey: z.ZodString;
}, z.core.$strip>;
export declare const ActivityFeedInputSchema: z.ZodObject<{
    source: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodString>;
    actor: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodNumber>;
    cursor: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ActivityLeaderboardInputSchema: z.ZodObject<{
    period: z.ZodEnum<{
        week: "week";
        month: "month";
        "all-time": "all-time";
    }>;
    limit: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const contract: {
    emitActivity: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        source: z.ZodString;
        type: z.ZodString;
        payload: z.ZodUnknown;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        source: z.ZodString;
        type: z.ZodString;
        actor: z.ZodString;
        payload: z.ZodUnknown;
        verified: z.ZodBoolean;
        hiddenAt: z.ZodNullable<z.ZodISODateTime>;
        createdAt: z.ZodISODateTime;
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
    emitTrustedActivity: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        source: z.ZodString;
        type: z.ZodString;
        payload: z.ZodUnknown;
        actor: z.ZodString;
        idempotencyKey: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        source: z.ZodString;
        type: z.ZodString;
        actor: z.ZodString;
        payload: z.ZodUnknown;
        verified: z.ZodBoolean;
        hiddenAt: z.ZodNullable<z.ZodISODateTime>;
        createdAt: z.ZodISODateTime;
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
    }>>, Record<never, never>>;
    hideActivity: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        source: z.ZodString;
        type: z.ZodString;
        actor: z.ZodString;
        payload: z.ZodUnknown;
        verified: z.ZodBoolean;
        hiddenAt: z.ZodNullable<z.ZodISODateTime>;
        createdAt: z.ZodISODateTime;
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
    getActivityFeed: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        source: z.ZodOptional<z.ZodString>;
        type: z.ZodOptional<z.ZodString>;
        actor: z.ZodOptional<z.ZodString>;
        limit: z.ZodOptional<z.ZodNumber>;
        cursor: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            source: z.ZodString;
            type: z.ZodString;
            actor: z.ZodString;
            payload: z.ZodUnknown;
            verified: z.ZodBoolean;
            hiddenAt: z.ZodNullable<z.ZodISODateTime>;
            createdAt: z.ZodISODateTime;
        }, z.core.$strip>>;
        meta: z.ZodObject<{
            total: z.ZodNumber;
            hasMore: z.ZodBoolean;
            nextCursor: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
    subscribeActivity: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        source: z.ZodOptional<z.ZodString>;
        type: z.ZodOptional<z.ZodString>;
        actor: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, import("@orpc/contract").Schema<AsyncIteratorObject<{
        id: string;
        source: string;
        type: string;
        actor: string;
        payload: unknown;
        verified: boolean;
        hiddenAt: string | null;
        createdAt: string;
    }, unknown, void>, import("@orpc/shared").AsyncIteratorClass<{
        id: string;
        source: string;
        type: string;
        actor: string;
        payload: unknown;
        verified: boolean;
        hiddenAt: string | null;
        createdAt: string;
    }, unknown, void>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
    getLeaderboard: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        period: z.ZodEnum<{
            week: "week";
            month: "month";
            "all-time": "all-time";
        }>;
        limit: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodArray<z.ZodObject<{
        actor: z.ZodString;
        eventCount: z.ZodNumber;
        endorsementScore: z.ZodNumber;
        topSources: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
};
export type ContractType = typeof contract;
