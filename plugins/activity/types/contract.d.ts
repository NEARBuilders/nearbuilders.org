import "@orpc/openapi/extensions/route";
import { z } from "zod";
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
        "all-time": "all-time";
        month: "month";
        week: "week";
    }>;
    limit: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const ActivityGatewayModeSchema: z.ZodEnum<{
    "dual-write": "dual-write";
    "legacy-only": "legacy-only";
    "standalone-only": "standalone-only";
}>;
export declare const ActivityRedatePlanSchema: z.ZodObject<{
    dryRun: z.ZodBoolean;
    misdated: z.ZodNumber;
    hidden: z.ZodNumber;
    enqueued: z.ZodNumber;
    oldestOccurredAt: z.ZodNullable<z.ZodString>;
    newestOccurredAt: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const ActivityGatewayStatusSchema: z.ZodObject<{
    mode: z.ZodEnum<{
        "dual-write": "dual-write";
        "legacy-only": "legacy-only";
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
export declare const ACTIVITY_EVENT_TYPE_NAME_REGEX: RegExp;
export declare const MAX_ACTIVITY_EVENT_TYPE_POINTS = 100;
export declare const ActivityRegistrationEventTypeSchema: z.ZodObject<{
    name: z.ZodString;
    pointValue: z.ZodNumber;
}, z.core.$strip>;
export declare const ActivityRegistrationInputSchema: z.ZodObject<{
    projectId: z.ZodString;
    nearAccountId: z.ZodOptional<z.ZodString>;
    eventTypes: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        pointValue: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const ActivityProjectStatusSchema: z.ZodObject<{
    status: z.ZodEnum<{
        connected: "connected";
        none: "none";
        rejected: "rejected";
        tracked: "tracked";
    }>;
    sourceId: z.ZodNullable<z.ZodString>;
    displayName: z.ZodNullable<z.ZodString>;
    reviewReason: z.ZodNullable<z.ZodString>;
    activityUrl: z.ZodString;
}, z.core.$strip>;
export declare const ActivityProjectEventsSchema: z.ZodObject<{
    events: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodString;
        actor: z.ZodString;
        occurredAt: z.ZodString;
        underReview: z.ZodBoolean;
    }, z.core.$strip>>;
    nextCursor: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const ActivityProjectContributorsSchema: z.ZodArray<z.ZodObject<{
    rank: z.ZodNumber;
    actor: z.ZodString;
    score: z.ZodNumber;
    eventCount: z.ZodNumber;
}, z.core.$strip>>;
export declare const contract: {
    emitActivity: import("@orpc/contract").ProcedureContract<z.ZodObject<{
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
    emitTrustedActivity: import("@orpc/contract").ProcedureContract<z.ZodObject<{
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
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    hideActivity: import("@orpc/contract").ProcedureContract<z.ZodObject<{
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
    }>;
    getActivityFeed: import("@orpc/contract").ProcedureContract<z.ZodObject<{
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
    }, z.core.$strip>, object>;
    subscribeActivity: import("@orpc/contract").ProcedureContract<z.ZodObject<{
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
    }, unknown, void>, import("@orpc/server").AsyncIteratorClass<{
        id: string;
        source: string;
        type: string;
        actor: string;
        payload: unknown;
        verified: boolean;
        hiddenAt: string | null;
        createdAt: string;
    }, unknown, void>>, object>;
    getLeaderboard: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        period: z.ZodEnum<{
            "all-time": "all-time";
            month: "month";
            week: "week";
        }>;
        limit: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodArray<z.ZodObject<{
        actor: z.ZodString;
        eventCount: z.ZodNumber;
        endorsementScore: z.ZodNumber;
        topSources: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>, object>;
    getActivityGatewayStatus: import("@orpc/contract").ProcedureContract<import("@orpc/contract").InitialInputSchema, z.ZodObject<{
        mode: z.ZodEnum<{
            "dual-write": "dual-write";
            "legacy-only": "legacy-only";
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
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    setActivityGatewayMode: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        mode: z.ZodEnum<{
            "dual-write": "dual-write";
            "legacy-only": "legacy-only";
            "standalone-only": "standalone-only";
        }>;
    }, z.core.$strip>, z.ZodObject<{
        mode: z.ZodEnum<{
            "dual-write": "dual-write";
            "legacy-only": "legacy-only";
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
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    retryActivityGateway: import("@orpc/contract").ProcedureContract<import("@orpc/contract").InitialInputSchema, z.ZodObject<{
        mode: z.ZodEnum<{
            "dual-write": "dual-write";
            "legacy-only": "legacy-only";
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
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    redateActivityHistory: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        dryRun: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        dryRun: z.ZodBoolean;
        misdated: z.ZodNumber;
        hidden: z.ZodNumber;
        enqueued: z.ZodNumber;
        oldestOccurredAt: z.ZodNullable<z.ZodString>;
        newestOccurredAt: z.ZodNullable<z.ZodString>;
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
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    startActivityRegistration: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        projectId: z.ZodString;
        nearAccountId: z.ZodOptional<z.ZodString>;
        eventTypes: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            pointValue: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        url: z.ZodString;
        expiresAt: z.ZodString;
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
        SERVICE_UNAVAILABLE: {
            readonly status: 503;
            readonly data: z.ZodObject<{
                retryAfter: z.ZodOptional<z.ZodNumber>;
                maintenanceWindow: z.ZodDefault<z.ZodBoolean>;
                estimatedUptime: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    getProjectActivity: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        projectId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        status: z.ZodEnum<{
            connected: "connected";
            none: "none";
            rejected: "rejected";
            tracked: "tracked";
        }>;
        sourceId: z.ZodNullable<z.ZodString>;
        displayName: z.ZodNullable<z.ZodString>;
        reviewReason: z.ZodNullable<z.ZodString>;
        activityUrl: z.ZodString;
    }, z.core.$strip>, {
        SERVICE_UNAVAILABLE: {
            readonly status: 503;
            readonly data: z.ZodObject<{
                retryAfter: z.ZodOptional<z.ZodNumber>;
                maintenanceWindow: z.ZodDefault<z.ZodBoolean>;
                estimatedUptime: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    getProjectActivityEvents: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        projectId: z.ZodString;
        cursor: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        events: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            type: z.ZodString;
            actor: z.ZodString;
            occurredAt: z.ZodString;
            underReview: z.ZodBoolean;
        }, z.core.$strip>>;
        nextCursor: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>, {
        SERVICE_UNAVAILABLE: {
            readonly status: 503;
            readonly data: z.ZodObject<{
                retryAfter: z.ZodOptional<z.ZodNumber>;
                maintenanceWindow: z.ZodDefault<z.ZodBoolean>;
                estimatedUptime: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    getProjectActivityContributors: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        projectId: z.ZodString;
    }, z.core.$strip>, z.ZodArray<z.ZodObject<{
        rank: z.ZodNumber;
        actor: z.ZodString;
        score: z.ZodNumber;
        eventCount: z.ZodNumber;
    }, z.core.$strip>>, {
        SERVICE_UNAVAILABLE: {
            readonly status: 503;
            readonly data: z.ZodObject<{
                retryAfter: z.ZodOptional<z.ZodNumber>;
                maintenanceWindow: z.ZodDefault<z.ZodBoolean>;
                estimatedUptime: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    importActivityHistory: import("@orpc/contract").ProcedureContract<z.ZodObject<{
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
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
};
export type ContractType = typeof contract;
