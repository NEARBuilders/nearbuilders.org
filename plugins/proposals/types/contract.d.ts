import { z } from "every-plugin/zod";
export declare const ProposalSchema: z.ZodObject<{
    id: z.ZodString;
    pluginId: z.ZodString;
    entityId: z.ZodString;
    operation: z.ZodLiteral<"create">;
    payload: z.ZodUnknown;
    schemaVersion: z.ZodString;
    createdBy: z.ZodString;
    reviewStatus: z.ZodEnum<{
        pending: "pending";
        approved: "approved";
        rejected: "rejected";
        removed: "removed";
    }>;
    applyStatus: z.ZodEnum<{
        not_started: "not_started";
        applied: "applied";
        failed: "failed";
    }>;
    removeStatus: z.ZodEnum<{
        removed: "removed";
        not_started: "not_started";
        failed: "failed";
    }>;
    rejectionReason: z.ZodNullable<z.ZodString>;
    applyError: z.ZodNullable<z.ZodString>;
    removeError: z.ZodNullable<z.ZodString>;
    appliedResourceId: z.ZodNullable<z.ZodString>;
    submissionCount: z.ZodNumber;
    appliedAt: z.ZodNullable<z.ZodISODateTime>;
    removedAt: z.ZodNullable<z.ZodISODateTime>;
    createdAt: z.ZodISODateTime;
    updatedAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const ProposalAuditEntrySchema: z.ZodObject<{
    id: z.ZodString;
    pluginId: z.ZodString;
    entityId: z.ZodString;
    action: z.ZodString;
    actor: z.ZodString;
    actorLabel: z.ZodNullable<z.ZodString>;
    details: z.ZodNullable<z.ZodUnknown>;
    createdAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const ProposalEventSchema: z.ZodObject<{
    action: z.ZodString;
    pluginId: z.ZodString;
    entityId: z.ZodString;
    reviewStatus: z.ZodEnum<{
        pending: "pending";
        approved: "approved";
        rejected: "rejected";
        removed: "removed";
    }>;
    applyStatus: z.ZodEnum<{
        not_started: "not_started";
        applied: "applied";
        failed: "failed";
    }>;
    removeStatus: z.ZodEnum<{
        removed: "removed";
        not_started: "not_started";
        failed: "failed";
    }>;
    submissionCount: z.ZodNumber;
    timestamp: z.ZodISODateTime;
}, z.core.$strip>;
export declare const contract: {
    propose: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
        payload: z.ZodUnknown;
        source: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodUnknown>;
        idempotencyKey: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            pluginId: z.ZodString;
            entityId: z.ZodString;
            operation: z.ZodLiteral<"create">;
            payload: z.ZodUnknown;
            schemaVersion: z.ZodString;
            createdBy: z.ZodString;
            reviewStatus: z.ZodEnum<{
                pending: "pending";
                approved: "approved";
                rejected: "rejected";
                removed: "removed";
            }>;
            applyStatus: z.ZodEnum<{
                not_started: "not_started";
                applied: "applied";
                failed: "failed";
            }>;
            removeStatus: z.ZodEnum<{
                removed: "removed";
                not_started: "not_started";
                failed: "failed";
            }>;
            rejectionReason: z.ZodNullable<z.ZodString>;
            applyError: z.ZodNullable<z.ZodString>;
            removeError: z.ZodNullable<z.ZodString>;
            appliedResourceId: z.ZodNullable<z.ZodString>;
            submissionCount: z.ZodNumber;
            appliedAt: z.ZodNullable<z.ZodISODateTime>;
            removedAt: z.ZodNullable<z.ZodISODateTime>;
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
    approve: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            pluginId: z.ZodString;
            entityId: z.ZodString;
            operation: z.ZodLiteral<"create">;
            payload: z.ZodUnknown;
            schemaVersion: z.ZodString;
            createdBy: z.ZodString;
            reviewStatus: z.ZodEnum<{
                pending: "pending";
                approved: "approved";
                rejected: "rejected";
                removed: "removed";
            }>;
            applyStatus: z.ZodEnum<{
                not_started: "not_started";
                applied: "applied";
                failed: "failed";
            }>;
            removeStatus: z.ZodEnum<{
                removed: "removed";
                not_started: "not_started";
                failed: "failed";
            }>;
            rejectionReason: z.ZodNullable<z.ZodString>;
            applyError: z.ZodNullable<z.ZodString>;
            removeError: z.ZodNullable<z.ZodString>;
            appliedResourceId: z.ZodNullable<z.ZodString>;
            submissionCount: z.ZodNumber;
            appliedAt: z.ZodNullable<z.ZodISODateTime>;
            removedAt: z.ZodNullable<z.ZodISODateTime>;
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
    reject: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            pluginId: z.ZodString;
            entityId: z.ZodString;
            operation: z.ZodLiteral<"create">;
            payload: z.ZodUnknown;
            schemaVersion: z.ZodString;
            createdBy: z.ZodString;
            reviewStatus: z.ZodEnum<{
                pending: "pending";
                approved: "approved";
                rejected: "rejected";
                removed: "removed";
            }>;
            applyStatus: z.ZodEnum<{
                not_started: "not_started";
                applied: "applied";
                failed: "failed";
            }>;
            removeStatus: z.ZodEnum<{
                removed: "removed";
                not_started: "not_started";
                failed: "failed";
            }>;
            rejectionReason: z.ZodNullable<z.ZodString>;
            applyError: z.ZodNullable<z.ZodString>;
            removeError: z.ZodNullable<z.ZodString>;
            appliedResourceId: z.ZodNullable<z.ZodString>;
            submissionCount: z.ZodNumber;
            appliedAt: z.ZodNullable<z.ZodISODateTime>;
            removedAt: z.ZodNullable<z.ZodISODateTime>;
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
    remove: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            pluginId: z.ZodString;
            entityId: z.ZodString;
            operation: z.ZodLiteral<"create">;
            payload: z.ZodUnknown;
            schemaVersion: z.ZodString;
            createdBy: z.ZodString;
            reviewStatus: z.ZodEnum<{
                pending: "pending";
                approved: "approved";
                rejected: "rejected";
                removed: "removed";
            }>;
            applyStatus: z.ZodEnum<{
                not_started: "not_started";
                applied: "applied";
                failed: "failed";
            }>;
            removeStatus: z.ZodEnum<{
                removed: "removed";
                not_started: "not_started";
                failed: "failed";
            }>;
            rejectionReason: z.ZodNullable<z.ZodString>;
            applyError: z.ZodNullable<z.ZodString>;
            removeError: z.ZodNullable<z.ZodString>;
            appliedResourceId: z.ZodNullable<z.ZodString>;
            submissionCount: z.ZodNumber;
            appliedAt: z.ZodNullable<z.ZodISODateTime>;
            removedAt: z.ZodNullable<z.ZodISODateTime>;
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
    markApplied: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
        appliedResourceId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            pluginId: z.ZodString;
            entityId: z.ZodString;
            operation: z.ZodLiteral<"create">;
            payload: z.ZodUnknown;
            schemaVersion: z.ZodString;
            createdBy: z.ZodString;
            reviewStatus: z.ZodEnum<{
                pending: "pending";
                approved: "approved";
                rejected: "rejected";
                removed: "removed";
            }>;
            applyStatus: z.ZodEnum<{
                not_started: "not_started";
                applied: "applied";
                failed: "failed";
            }>;
            removeStatus: z.ZodEnum<{
                removed: "removed";
                not_started: "not_started";
                failed: "failed";
            }>;
            rejectionReason: z.ZodNullable<z.ZodString>;
            applyError: z.ZodNullable<z.ZodString>;
            removeError: z.ZodNullable<z.ZodString>;
            appliedResourceId: z.ZodNullable<z.ZodString>;
            submissionCount: z.ZodNumber;
            appliedAt: z.ZodNullable<z.ZodISODateTime>;
            removedAt: z.ZodNullable<z.ZodISODateTime>;
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
    markApplyFailed: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
        error: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            pluginId: z.ZodString;
            entityId: z.ZodString;
            operation: z.ZodLiteral<"create">;
            payload: z.ZodUnknown;
            schemaVersion: z.ZodString;
            createdBy: z.ZodString;
            reviewStatus: z.ZodEnum<{
                pending: "pending";
                approved: "approved";
                rejected: "rejected";
                removed: "removed";
            }>;
            applyStatus: z.ZodEnum<{
                not_started: "not_started";
                applied: "applied";
                failed: "failed";
            }>;
            removeStatus: z.ZodEnum<{
                removed: "removed";
                not_started: "not_started";
                failed: "failed";
            }>;
            rejectionReason: z.ZodNullable<z.ZodString>;
            applyError: z.ZodNullable<z.ZodString>;
            removeError: z.ZodNullable<z.ZodString>;
            appliedResourceId: z.ZodNullable<z.ZodString>;
            submissionCount: z.ZodNumber;
            appliedAt: z.ZodNullable<z.ZodISODateTime>;
            removedAt: z.ZodNullable<z.ZodISODateTime>;
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
    markRemoved: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            pluginId: z.ZodString;
            entityId: z.ZodString;
            operation: z.ZodLiteral<"create">;
            payload: z.ZodUnknown;
            schemaVersion: z.ZodString;
            createdBy: z.ZodString;
            reviewStatus: z.ZodEnum<{
                pending: "pending";
                approved: "approved";
                rejected: "rejected";
                removed: "removed";
            }>;
            applyStatus: z.ZodEnum<{
                not_started: "not_started";
                applied: "applied";
                failed: "failed";
            }>;
            removeStatus: z.ZodEnum<{
                removed: "removed";
                not_started: "not_started";
                failed: "failed";
            }>;
            rejectionReason: z.ZodNullable<z.ZodString>;
            applyError: z.ZodNullable<z.ZodString>;
            removeError: z.ZodNullable<z.ZodString>;
            appliedResourceId: z.ZodNullable<z.ZodString>;
            submissionCount: z.ZodNumber;
            appliedAt: z.ZodNullable<z.ZodISODateTime>;
            removedAt: z.ZodNullable<z.ZodISODateTime>;
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
    markRemoveFailed: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
        error: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            pluginId: z.ZodString;
            entityId: z.ZodString;
            operation: z.ZodLiteral<"create">;
            payload: z.ZodUnknown;
            schemaVersion: z.ZodString;
            createdBy: z.ZodString;
            reviewStatus: z.ZodEnum<{
                pending: "pending";
                approved: "approved";
                rejected: "rejected";
                removed: "removed";
            }>;
            applyStatus: z.ZodEnum<{
                not_started: "not_started";
                applied: "applied";
                failed: "failed";
            }>;
            removeStatus: z.ZodEnum<{
                removed: "removed";
                not_started: "not_started";
                failed: "failed";
            }>;
            rejectionReason: z.ZodNullable<z.ZodString>;
            applyError: z.ZodNullable<z.ZodString>;
            removeError: z.ZodNullable<z.ZodString>;
            appliedResourceId: z.ZodNullable<z.ZodString>;
            submissionCount: z.ZodNumber;
            appliedAt: z.ZodNullable<z.ZodISODateTime>;
            removedAt: z.ZodNullable<z.ZodISODateTime>;
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
    getProposals: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        pluginId: z.ZodOptional<z.ZodString>;
        entityId: z.ZodOptional<z.ZodString>;
        reviewStatus: z.ZodOptional<z.ZodEnum<{
            pending: "pending";
            approved: "approved";
            rejected: "rejected";
            removed: "removed";
        }>>;
        limit: z.ZodOptional<z.ZodNumber>;
        cursor: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            pluginId: z.ZodString;
            entityId: z.ZodString;
            operation: z.ZodLiteral<"create">;
            payload: z.ZodUnknown;
            schemaVersion: z.ZodString;
            createdBy: z.ZodString;
            reviewStatus: z.ZodEnum<{
                pending: "pending";
                approved: "approved";
                rejected: "rejected";
                removed: "removed";
            }>;
            applyStatus: z.ZodEnum<{
                not_started: "not_started";
                applied: "applied";
                failed: "failed";
            }>;
            removeStatus: z.ZodEnum<{
                removed: "removed";
                not_started: "not_started";
                failed: "failed";
            }>;
            rejectionReason: z.ZodNullable<z.ZodString>;
            applyError: z.ZodNullable<z.ZodString>;
            removeError: z.ZodNullable<z.ZodString>;
            appliedResourceId: z.ZodNullable<z.ZodString>;
            submissionCount: z.ZodNumber;
            appliedAt: z.ZodNullable<z.ZodISODateTime>;
            removedAt: z.ZodNullable<z.ZodISODateTime>;
            createdAt: z.ZodISODateTime;
            updatedAt: z.ZodISODateTime;
        }, z.core.$strip>>;
        meta: z.ZodObject<{
            total: z.ZodNumber;
            hasMore: z.ZodBoolean;
            nextCursor: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
    getProposalCount: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
        totalCount: z.ZodNumber;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
    getAuditLog: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
        limit: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            pluginId: z.ZodString;
            entityId: z.ZodString;
            action: z.ZodString;
            actor: z.ZodString;
            actorLabel: z.ZodNullable<z.ZodString>;
            details: z.ZodNullable<z.ZodUnknown>;
            createdAt: z.ZodISODateTime;
        }, z.core.$strip>>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
    subscribe: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        pluginId: z.ZodOptional<z.ZodString>;
        entityId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, import("@orpc/contract").Schema<AsyncIteratorObject<{
        action: string;
        pluginId: string;
        entityId: string;
        reviewStatus: "pending" | "approved" | "rejected" | "removed";
        applyStatus: "not_started" | "applied" | "failed";
        removeStatus: "removed" | "not_started" | "failed";
        submissionCount: number;
        timestamp: string;
    }, unknown, void>, import("@orpc/shared").AsyncIteratorClass<{
        action: string;
        pluginId: string;
        entityId: string;
        reviewStatus: "pending" | "approved" | "rejected" | "removed";
        applyStatus: "not_started" | "applied" | "failed";
        removeStatus: "removed" | "not_started" | "failed";
        submissionCount: number;
        timestamp: string;
    }, unknown, void>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
};
export type ContractType = typeof contract;
