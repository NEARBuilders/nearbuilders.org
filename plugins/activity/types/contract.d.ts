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
export declare const ActivityGatewayModeSchema: z.ZodEnum<{
    "legacy-only": "legacy-only";
    "dual-write": "dual-write";
    "standalone-only": "standalone-only";
}>;
export declare const ActivityGatewayStatusSchema: z.ZodObject<{
    mode: z.ZodEnum<{
        "legacy-only": "legacy-only";
        "dual-write": "dual-write";
        "standalone-only": "standalone-only";
    }>;
    configured: z.ZodBoolean;
    counts: z.ZodObject<{
        pending: z.ZodNumber;
        sent: z.ZodNumber;
        failed: z.ZodNumber;
    }, z.core.$strip>;
    oldestPendingAt: z.ZodNullable<z.ZodString>;
    recentFailures: z.ZodArray<z.ZodObject<{
        operation: z.ZodString;
        idempotencyKey: z.ZodString;
        attempts: z.ZodNumber;
        lastError: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const ActivityImportPlanSchema: z.ZodObject<{
    dryRun: z.ZodBoolean;
    scanned: z.ZodNumber;
    eligible: z.ZodNumber;
    alreadyForwarded: z.ZodNumber;
    toImport: z.ZodNumber;
    hidden: z.ZodNumber;
    synthesizedKeys: z.ZodNumber;
    skippedByType: z.ZodArray<z.ZodObject<{
        source: z.ZodString;
        type: z.ZodString;
        count: z.ZodNumber;
    }, z.core.$strip>>;
    oldestOccurredAt: z.ZodNullable<z.ZodString>;
    newestOccurredAt: z.ZodNullable<z.ZodString>;
    timestamps: z.ZodObject<{
        preserved: z.ZodBoolean;
        note: z.ZodString;
        olderThanCurrentWeek: z.ZodNumber;
        olderThanCurrentMonth: z.ZodNumber;
    }, z.core.$strip>;
    enqueued: z.ZodNumber;
    enqueuedRetractions: z.ZodNumber;
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
    getActivityGatewayStatus: import("@orpc/contract").ContractProcedure<import("@orpc/contract").Schema<unknown, unknown>, z.ZodObject<{
        mode: z.ZodEnum<{
            "legacy-only": "legacy-only";
            "dual-write": "dual-write";
            "standalone-only": "standalone-only";
        }>;
        configured: z.ZodBoolean;
        counts: z.ZodObject<{
            pending: z.ZodNumber;
            sent: z.ZodNumber;
            failed: z.ZodNumber;
        }, z.core.$strip>;
        oldestPendingAt: z.ZodNullable<z.ZodString>;
        recentFailures: z.ZodArray<z.ZodObject<{
            operation: z.ZodString;
            idempotencyKey: z.ZodString;
            attempts: z.ZodNumber;
            lastError: z.ZodNullable<z.ZodString>;
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
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    setActivityGatewayMode: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        mode: z.ZodEnum<{
            "legacy-only": "legacy-only";
            "dual-write": "dual-write";
            "standalone-only": "standalone-only";
        }>;
    }, z.core.$strip>, z.ZodObject<{
        mode: z.ZodEnum<{
            "legacy-only": "legacy-only";
            "dual-write": "dual-write";
            "standalone-only": "standalone-only";
        }>;
        configured: z.ZodBoolean;
        counts: z.ZodObject<{
            pending: z.ZodNumber;
            sent: z.ZodNumber;
            failed: z.ZodNumber;
        }, z.core.$strip>;
        oldestPendingAt: z.ZodNullable<z.ZodString>;
        recentFailures: z.ZodArray<z.ZodObject<{
            operation: z.ZodString;
            idempotencyKey: z.ZodString;
            attempts: z.ZodNumber;
            lastError: z.ZodNullable<z.ZodString>;
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
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    retryActivityGateway: import("@orpc/contract").ContractProcedure<import("@orpc/contract").Schema<unknown, unknown>, z.ZodObject<{
        mode: z.ZodEnum<{
            "legacy-only": "legacy-only";
            "dual-write": "dual-write";
            "standalone-only": "standalone-only";
        }>;
        configured: z.ZodBoolean;
        counts: z.ZodObject<{
            pending: z.ZodNumber;
            sent: z.ZodNumber;
            failed: z.ZodNumber;
        }, z.core.$strip>;
        oldestPendingAt: z.ZodNullable<z.ZodString>;
        recentFailures: z.ZodArray<z.ZodObject<{
            operation: z.ZodString;
            idempotencyKey: z.ZodString;
            attempts: z.ZodNumber;
            lastError: z.ZodNullable<z.ZodString>;
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
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    importActivityHistory: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        dryRun: z.ZodDefault<z.ZodBoolean>;
        since: z.ZodOptional<z.ZodISODateTime>;
        limit: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        dryRun: z.ZodBoolean;
        scanned: z.ZodNumber;
        eligible: z.ZodNumber;
        alreadyForwarded: z.ZodNumber;
        toImport: z.ZodNumber;
        hidden: z.ZodNumber;
        synthesizedKeys: z.ZodNumber;
        skippedByType: z.ZodArray<z.ZodObject<{
            source: z.ZodString;
            type: z.ZodString;
            count: z.ZodNumber;
        }, z.core.$strip>>;
        oldestOccurredAt: z.ZodNullable<z.ZodString>;
        newestOccurredAt: z.ZodNullable<z.ZodString>;
        timestamps: z.ZodObject<{
            preserved: z.ZodBoolean;
            note: z.ZodString;
            olderThanCurrentWeek: z.ZodNumber;
            olderThanCurrentMonth: z.ZodNumber;
        }, z.core.$strip>;
        enqueued: z.ZodNumber;
        enqueuedRetractions: z.ZodNumber;
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
};
export type ContractType = typeof contract;
