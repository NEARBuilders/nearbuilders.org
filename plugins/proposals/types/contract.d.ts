import "@orpc/openapi/extensions/route";
import { z } from "zod";
export declare const ProposalSchema: z.ZodObject<{
    id: z.ZodString;
    pluginId: z.ZodString;
    entityId: z.ZodString;
    operation: z.ZodLiteral<"create">;
    payload: z.ZodUnknown;
    schemaVersion: z.ZodString;
    createdBy: z.ZodString;
    reviewStatus: z.ZodEnum<{
        approved: "approved";
        pending: "pending";
        rejected: "rejected";
        removed: "removed";
    }>;
    applyStatus: z.ZodEnum<{
        applied: "applied";
        applying: "applying";
        failed: "failed";
        not_started: "not_started";
    }>;
    removeStatus: z.ZodEnum<{
        failed: "failed";
        not_started: "not_started";
        removed: "removed";
        removing: "removing";
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
export declare const ProposalSubmissionSchema: z.ZodObject<{
    id: z.ZodString;
    pluginId: z.ZodString;
    entityId: z.ZodString;
    submittedBy: z.ZodString;
    source: z.ZodNullable<z.ZodString>;
    payload: z.ZodNullable<z.ZodUnknown>;
    metadata: z.ZodNullable<z.ZodUnknown>;
    createdAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const ProposalReviewHistoryEntrySchema: z.ZodObject<{
    id: z.ZodString;
    pluginId: z.ZodString;
    entityId: z.ZodString;
    actor: z.ZodString;
    actorLabel: z.ZodNullable<z.ZodString>;
    details: z.ZodNullable<z.ZodUnknown>;
    createdAt: z.ZodISODateTime;
    action: z.ZodEnum<{
        approved: "approved";
        rejected: "rejected";
    }>;
    proposal: z.ZodObject<{
        id: z.ZodString;
        pluginId: z.ZodString;
        entityId: z.ZodString;
        operation: z.ZodLiteral<"create">;
        payload: z.ZodUnknown;
        schemaVersion: z.ZodString;
        createdBy: z.ZodString;
        reviewStatus: z.ZodEnum<{
            approved: "approved";
            pending: "pending";
            rejected: "rejected";
            removed: "removed";
        }>;
        applyStatus: z.ZodEnum<{
            applied: "applied";
            applying: "applying";
            failed: "failed";
            not_started: "not_started";
        }>;
        removeStatus: z.ZodEnum<{
            failed: "failed";
            not_started: "not_started";
            removed: "removed";
            removing: "removing";
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
}, z.core.$strip>;
export declare const REVIEW_EVALUATOR: unique symbol;
export declare const EvaluationVerdict: z.ZodEnum<{
    ready: "ready";
    review: "review";
    spam: "spam";
}>;
export declare const EvaluationCheckSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    status: z.ZodEnum<{
        fail: "fail";
        pass: "pass";
        skip: "skip";
        warn: "warn";
    }>;
    detail: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const ProposalEvaluationSchema: z.ZodObject<{
    id: z.ZodString;
    proposalId: z.ZodString;
    pluginId: z.ZodString;
    entityId: z.ZodString;
    submissionCount: z.ZodNumber;
    verdict: z.ZodEnum<{
        ready: "ready";
        review: "review";
        spam: "spam";
    }>;
    score: z.ZodNullable<z.ZodNumber>;
    summary: z.ZodString;
    flags: z.ZodArray<z.ZodString>;
    checks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        status: z.ZodEnum<{
            fail: "fail";
            pass: "pass";
            skip: "skip";
            warn: "warn";
        }>;
        detail: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    model: z.ZodNullable<z.ZodString>;
    source: z.ZodNullable<z.ZodString>;
    promptVersion: z.ZodString;
    evaluatedAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const TelegramReviewerSchema: z.ZodObject<{
    telegramId: z.ZodNumber;
    telegramUsername: z.ZodNullable<z.ZodString>;
    telegramName: z.ZodNullable<z.ZodString>;
    userId: z.ZodString;
    userLabel: z.ZodString;
    linkedAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const ProposalEventSchema: z.ZodObject<{
    action: z.ZodString;
    pluginId: z.ZodString;
    entityId: z.ZodString;
    reviewStatus: z.ZodEnum<{
        approved: "approved";
        pending: "pending";
        rejected: "rejected";
        removed: "removed";
    }>;
    applyStatus: z.ZodEnum<{
        applied: "applied";
        applying: "applying";
        failed: "failed";
        not_started: "not_started";
    }>;
    removeStatus: z.ZodEnum<{
        failed: "failed";
        not_started: "not_started";
        removed: "removed";
        removing: "removing";
    }>;
    submissionCount: z.ZodNumber;
    timestamp: z.ZodISODateTime;
}, z.core.$strip>;
export declare const contract: {
    propose: import("@orpc/contract").ProcedureContract<z.ZodObject<{
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
                approved: "approved";
                pending: "pending";
                rejected: "rejected";
                removed: "removed";
            }>;
            applyStatus: z.ZodEnum<{
                applied: "applied";
                applying: "applying";
                failed: "failed";
                not_started: "not_started";
            }>;
            removeStatus: z.ZodEnum<{
                failed: "failed";
                not_started: "not_started";
                removed: "removed";
                removing: "removing";
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
    approve: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
        expectedUpdatedAt: z.ZodISODateTime;
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
                approved: "approved";
                pending: "pending";
                rejected: "rejected";
                removed: "removed";
            }>;
            applyStatus: z.ZodEnum<{
                applied: "applied";
                applying: "applying";
                failed: "failed";
                not_started: "not_started";
            }>;
            removeStatus: z.ZodEnum<{
                failed: "failed";
                not_started: "not_started";
                removed: "removed";
                removing: "removing";
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
    reject: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
        expectedUpdatedAt: z.ZodISODateTime;
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
                approved: "approved";
                pending: "pending";
                rejected: "rejected";
                removed: "removed";
            }>;
            applyStatus: z.ZodEnum<{
                applied: "applied";
                applying: "applying";
                failed: "failed";
                not_started: "not_started";
            }>;
            removeStatus: z.ZodEnum<{
                failed: "failed";
                not_started: "not_started";
                removed: "removed";
                removing: "removing";
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
    dismissFailure: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
        expectedUpdatedAt: z.ZodISODateTime;
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
                approved: "approved";
                pending: "pending";
                rejected: "rejected";
                removed: "removed";
            }>;
            applyStatus: z.ZodEnum<{
                applied: "applied";
                applying: "applying";
                failed: "failed";
                not_started: "not_started";
            }>;
            removeStatus: z.ZodEnum<{
                failed: "failed";
                not_started: "not_started";
                removed: "removed";
                removing: "removing";
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
    withdraw: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
        expectedUpdatedAt: z.ZodISODateTime;
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
                approved: "approved";
                pending: "pending";
                rejected: "rejected";
                removed: "removed";
            }>;
            applyStatus: z.ZodEnum<{
                applied: "applied";
                applying: "applying";
                failed: "failed";
                not_started: "not_started";
            }>;
            removeStatus: z.ZodEnum<{
                failed: "failed";
                not_started: "not_started";
                removed: "removed";
                removing: "removing";
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
    reopen: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
        expectedUpdatedAt: z.ZodISODateTime;
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
                approved: "approved";
                pending: "pending";
                rejected: "rejected";
                removed: "removed";
            }>;
            applyStatus: z.ZodEnum<{
                applied: "applied";
                applying: "applying";
                failed: "failed";
                not_started: "not_started";
            }>;
            removeStatus: z.ZodEnum<{
                failed: "failed";
                not_started: "not_started";
                removed: "removed";
                removing: "removing";
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
    remove: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
        expectedUpdatedAt: z.ZodISODateTime;
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
                approved: "approved";
                pending: "pending";
                rejected: "rejected";
                removed: "removed";
            }>;
            applyStatus: z.ZodEnum<{
                applied: "applied";
                applying: "applying";
                failed: "failed";
                not_started: "not_started";
            }>;
            removeStatus: z.ZodEnum<{
                failed: "failed";
                not_started: "not_started";
                removed: "removed";
                removing: "removing";
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
    markApplied: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
        expectedUpdatedAt: z.ZodISODateTime;
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
                approved: "approved";
                pending: "pending";
                rejected: "rejected";
                removed: "removed";
            }>;
            applyStatus: z.ZodEnum<{
                applied: "applied";
                applying: "applying";
                failed: "failed";
                not_started: "not_started";
            }>;
            removeStatus: z.ZodEnum<{
                failed: "failed";
                not_started: "not_started";
                removed: "removed";
                removing: "removing";
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
    markApplyFailed: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
        expectedUpdatedAt: z.ZodISODateTime;
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
                approved: "approved";
                pending: "pending";
                rejected: "rejected";
                removed: "removed";
            }>;
            applyStatus: z.ZodEnum<{
                applied: "applied";
                applying: "applying";
                failed: "failed";
                not_started: "not_started";
            }>;
            removeStatus: z.ZodEnum<{
                failed: "failed";
                not_started: "not_started";
                removed: "removed";
                removing: "removing";
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
    markRemoved: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
        expectedUpdatedAt: z.ZodISODateTime;
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
                approved: "approved";
                pending: "pending";
                rejected: "rejected";
                removed: "removed";
            }>;
            applyStatus: z.ZodEnum<{
                applied: "applied";
                applying: "applying";
                failed: "failed";
                not_started: "not_started";
            }>;
            removeStatus: z.ZodEnum<{
                failed: "failed";
                not_started: "not_started";
                removed: "removed";
                removing: "removing";
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
    markRemoveFailed: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
        expectedUpdatedAt: z.ZodISODateTime;
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
                approved: "approved";
                pending: "pending";
                rejected: "rejected";
                removed: "removed";
            }>;
            applyStatus: z.ZodEnum<{
                applied: "applied";
                applying: "applying";
                failed: "failed";
                not_started: "not_started";
            }>;
            removeStatus: z.ZodEnum<{
                failed: "failed";
                not_started: "not_started";
                removed: "removed";
                removing: "removing";
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
    getProposals: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        pluginId: z.ZodOptional<z.ZodString>;
        entityId: z.ZodOptional<z.ZodString>;
        reviewStatus: z.ZodOptional<z.ZodEnum<{
            approved: "approved";
            pending: "pending";
            rejected: "rejected";
            removed: "removed";
        }>>;
        lifecycleStatus: z.ZodOptional<z.ZodLiteral<"actionable">>;
        query: z.ZodOptional<z.ZodString>;
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
                approved: "approved";
                pending: "pending";
                rejected: "rejected";
                removed: "removed";
            }>;
            applyStatus: z.ZodEnum<{
                applied: "applied";
                applying: "applying";
                failed: "failed";
                not_started: "not_started";
            }>;
            removeStatus: z.ZodEnum<{
                failed: "failed";
                not_started: "not_started";
                removed: "removed";
                removing: "removing";
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
    }, z.core.$strip>, object>;
    getProposalCount: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
        totalCount: z.ZodNumber;
    }, z.core.$strip>, object>;
    getAuditLog: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
        limit: z.ZodOptional<z.ZodNumber>;
        cursor: z.ZodOptional<z.ZodString>;
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
        meta: z.ZodObject<{
            total: z.ZodNumber;
            hasMore: z.ZodBoolean;
            nextCursor: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>, object>;
    getSubmissions: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
        limit: z.ZodOptional<z.ZodNumber>;
        cursor: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            pluginId: z.ZodString;
            entityId: z.ZodString;
            submittedBy: z.ZodString;
            source: z.ZodNullable<z.ZodString>;
            payload: z.ZodNullable<z.ZodUnknown>;
            metadata: z.ZodNullable<z.ZodUnknown>;
            createdAt: z.ZodISODateTime;
        }, z.core.$strip>>;
        meta: z.ZodObject<{
            total: z.ZodNumber;
            hasMore: z.ZodBoolean;
            nextCursor: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
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
    getMySubmission: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        hasSubmitted: z.ZodBoolean;
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
    getReviewHistory: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        pluginId: z.ZodOptional<z.ZodString>;
        limit: z.ZodOptional<z.ZodNumber>;
        cursor: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            pluginId: z.ZodString;
            entityId: z.ZodString;
            actor: z.ZodString;
            actorLabel: z.ZodNullable<z.ZodString>;
            details: z.ZodNullable<z.ZodUnknown>;
            createdAt: z.ZodISODateTime;
            action: z.ZodEnum<{
                approved: "approved";
                rejected: "rejected";
            }>;
            proposal: z.ZodObject<{
                id: z.ZodString;
                pluginId: z.ZodString;
                entityId: z.ZodString;
                operation: z.ZodLiteral<"create">;
                payload: z.ZodUnknown;
                schemaVersion: z.ZodString;
                createdBy: z.ZodString;
                reviewStatus: z.ZodEnum<{
                    approved: "approved";
                    pending: "pending";
                    rejected: "rejected";
                    removed: "removed";
                }>;
                applyStatus: z.ZodEnum<{
                    applied: "applied";
                    applying: "applying";
                    failed: "failed";
                    not_started: "not_started";
                }>;
                removeStatus: z.ZodEnum<{
                    failed: "failed";
                    not_started: "not_started";
                    removed: "removed";
                    removing: "removing";
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
        }, z.core.$strip>>;
        meta: z.ZodObject<{
            total: z.ZodNumber;
            hasMore: z.ZodBoolean;
            nextCursor: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
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
    recordEvaluation: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        pluginId: z.ZodString;
        entityId: z.ZodString;
        submissionCount: z.ZodNumber;
        verdict: z.ZodEnum<{
            ready: "ready";
            review: "review";
            spam: "spam";
        }>;
        score: z.ZodNullable<z.ZodNumber>;
        summary: z.ZodString;
        flags: z.ZodArray<z.ZodString>;
        checks: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            status: z.ZodEnum<{
                fail: "fail";
                pass: "pass";
                skip: "skip";
                warn: "warn";
            }>;
            detail: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>>;
        model: z.ZodNullable<z.ZodString>;
        source: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        promptVersion: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            proposalId: z.ZodString;
            pluginId: z.ZodString;
            entityId: z.ZodString;
            submissionCount: z.ZodNumber;
            verdict: z.ZodEnum<{
                ready: "ready";
                review: "review";
                spam: "spam";
            }>;
            score: z.ZodNullable<z.ZodNumber>;
            summary: z.ZodString;
            flags: z.ZodArray<z.ZodString>;
            checks: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                label: z.ZodString;
                status: z.ZodEnum<{
                    fail: "fail";
                    pass: "pass";
                    skip: "skip";
                    warn: "warn";
                }>;
                detail: z.ZodNullable<z.ZodString>;
            }, z.core.$strip>>;
            model: z.ZodNullable<z.ZodString>;
            source: z.ZodNullable<z.ZodString>;
            promptVersion: z.ZodString;
            evaluatedAt: z.ZodISODateTime;
        }, z.core.$strip>;
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
    acquireReviewLease: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        name: z.ZodString;
        holder: z.ZodString;
        ttlMs: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        acquired: z.ZodBoolean;
    }, z.core.$strip>, {
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    getEvaluations: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        proposalIds: z.ZodArray<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            proposalId: z.ZodString;
            pluginId: z.ZodString;
            entityId: z.ZodString;
            submissionCount: z.ZodNumber;
            verdict: z.ZodEnum<{
                ready: "ready";
                review: "review";
                spam: "spam";
            }>;
            score: z.ZodNullable<z.ZodNumber>;
            summary: z.ZodString;
            flags: z.ZodArray<z.ZodString>;
            checks: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                label: z.ZodString;
                status: z.ZodEnum<{
                    fail: "fail";
                    pass: "pass";
                    skip: "skip";
                    warn: "warn";
                }>;
                detail: z.ZodNullable<z.ZodString>;
            }, z.core.$strip>>;
            model: z.ZodNullable<z.ZodString>;
            source: z.ZodNullable<z.ZodString>;
            promptVersion: z.ZodString;
            evaluatedAt: z.ZodISODateTime;
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
    getProposalById: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            pluginId: z.ZodString;
            entityId: z.ZodString;
            operation: z.ZodLiteral<"create">;
            payload: z.ZodUnknown;
            schemaVersion: z.ZodString;
            createdBy: z.ZodString;
            reviewStatus: z.ZodEnum<{
                approved: "approved";
                pending: "pending";
                rejected: "rejected";
                removed: "removed";
            }>;
            applyStatus: z.ZodEnum<{
                applied: "applied";
                applying: "applying";
                failed: "failed";
                not_started: "not_started";
            }>;
            removeStatus: z.ZodEnum<{
                failed: "failed";
                not_started: "not_started";
                removed: "removed";
                removing: "removing";
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
    }, z.core.$strip>, {
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    createTelegramLinkCode: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        codeHash: z.ZodString;
        userId: z.ZodString;
        userLabel: z.ZodString;
        ttlMs: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        expiresAt: z.ZodISODateTime;
    }, z.core.$strip>, {
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    linkTelegramReviewer: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        codeHash: z.ZodString;
        telegramId: z.ZodNumber;
        telegramUsername: z.ZodNullable<z.ZodString>;
        telegramName: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            telegramId: z.ZodNumber;
            telegramUsername: z.ZodNullable<z.ZodString>;
            telegramName: z.ZodNullable<z.ZodString>;
            userId: z.ZodString;
            userLabel: z.ZodString;
            linkedAt: z.ZodISODateTime;
        }, z.core.$strip>;
    }, z.core.$strip>, {
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
    getTelegramReviewer: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        telegramId: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodNullable<z.ZodObject<{
            telegramId: z.ZodNumber;
            telegramUsername: z.ZodNullable<z.ZodString>;
            telegramName: z.ZodNullable<z.ZodString>;
            userId: z.ZodString;
            userLabel: z.ZodString;
            linkedAt: z.ZodISODateTime;
        }, z.core.$strip>>;
    }, z.core.$strip>, {
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    listTelegramReviewers: import("@orpc/contract").ProcedureContract<z.ZodObject<{}, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            telegramId: z.ZodNumber;
            telegramUsername: z.ZodNullable<z.ZodString>;
            telegramName: z.ZodNullable<z.ZodString>;
            userId: z.ZodString;
            userLabel: z.ZodString;
            linkedAt: z.ZodISODateTime;
        }, z.core.$strip>>;
    }, z.core.$strip>, {
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    removeTelegramReviewer: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        telegramId: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>, z.ZodObject<{
        removed: z.ZodBoolean;
    }, z.core.$strip>, {
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    subscribe: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        pluginId: z.ZodOptional<z.ZodString>;
        entityId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, import("@orpc/contract").Schema<AsyncIteratorObject<{
        action: string;
        pluginId: string;
        entityId: string;
        reviewStatus: "approved" | "pending" | "rejected" | "removed";
        applyStatus: "applied" | "applying" | "failed" | "not_started";
        removeStatus: "failed" | "not_started" | "removed" | "removing";
        submissionCount: number;
        timestamp: string;
    }, unknown, void>, import("@orpc/server").AsyncIteratorClass<{
        action: string;
        pluginId: string;
        entityId: string;
        reviewStatus: "approved" | "pending" | "rejected" | "removed";
        applyStatus: "applied" | "applying" | "failed" | "not_started";
        removeStatus: "failed" | "not_started" | "removed" | "removing";
        submissionCount: number;
        timestamp: string;
    }, unknown, void>>, object>;
};
export type ContractType = typeof contract;
