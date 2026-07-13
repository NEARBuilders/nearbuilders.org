import { z } from "every-plugin/zod";
export declare const CatalogProjectSlugSchema: z.ZodString;
export declare const CatalogProjectSchema: z.ZodObject<{
    slug: z.ZodString;
    projectRef: z.ZodString;
    name: z.ZodString;
    tagline: z.ZodNullable<z.ZodString>;
    description: z.ZodNullable<z.ZodString>;
    imageUrl: z.ZodNullable<z.ZodString>;
    repositoryUrl: z.ZodNullable<z.ZodString>;
    catalogUrl: z.ZodString;
    tags: z.ZodArray<z.ZodString>;
    phase: z.ZodNullable<z.ZodString>;
    status: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const CatalogClaimSchema: z.ZodObject<{
    id: z.ZodString;
    nearAccount: z.ZodString;
    projectSlug: z.ZodString;
    roles: z.ZodArray<z.ZodString>;
    activityEventId: z.ZodNullable<z.ZodString>;
    revokedAt: z.ZodNullable<z.ZodISODateTime>;
    createdAt: z.ZodISODateTime;
    updatedAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const CatalogContributorSchema: z.ZodObject<{
    id: z.ZodString;
    nearAccount: z.ZodString;
    roles: z.ZodArray<z.ZodString>;
    createdAt: z.ZodISODateTime;
    updatedAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const CatalogClaimHistorySchema: z.ZodObject<{
    id: z.ZodString;
    claimId: z.ZodString;
    nearAccount: z.ZodString;
    projectSlug: z.ZodString;
    roles: z.ZodArray<z.ZodString>;
    activityEventId: z.ZodNullable<z.ZodString>;
    action: z.ZodEnum<{
        applied: "applied";
        "activity-linked": "activity-linked";
        revoked: "revoked";
    }>;
    occurredAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const ClaimedCatalogProjectSchema: z.ZodObject<{
    project: z.ZodObject<{
        slug: z.ZodString;
        projectRef: z.ZodString;
        name: z.ZodString;
        tagline: z.ZodNullable<z.ZodString>;
        description: z.ZodNullable<z.ZodString>;
        imageUrl: z.ZodNullable<z.ZodString>;
        repositoryUrl: z.ZodNullable<z.ZodString>;
        catalogUrl: z.ZodString;
        tags: z.ZodArray<z.ZodString>;
        phase: z.ZodNullable<z.ZodString>;
        status: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>;
    contributors: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        nearAccount: z.ZodString;
        roles: z.ZodArray<z.ZodString>;
        createdAt: z.ZodISODateTime;
        updatedAt: z.ZodISODateTime;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const contract: {
    searchCatalogProjects: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        query: z.ZodString;
        limit: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            slug: z.ZodString;
            projectRef: z.ZodString;
            name: z.ZodString;
            tagline: z.ZodNullable<z.ZodString>;
            description: z.ZodNullable<z.ZodString>;
            imageUrl: z.ZodNullable<z.ZodString>;
            repositoryUrl: z.ZodNullable<z.ZodString>;
            catalogUrl: z.ZodString;
            tags: z.ZodArray<z.ZodString>;
            phase: z.ZodNullable<z.ZodString>;
            status: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        CONNECTION_ERROR: {
            readonly status: 502;
            readonly data: z.ZodObject<{
                errorCode: z.ZodOptional<z.ZodString>;
                host: z.ZodOptional<z.ZodString>;
                port: z.ZodOptional<z.ZodNumber>;
                suggestion: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        RATE_LIMITED: {
            readonly status: 429;
            readonly data: z.ZodObject<{
                retryAfter: z.ZodNumber;
                remainingRequests: z.ZodOptional<z.ZodNumber>;
                resetTime: z.ZodOptional<z.ZodString>;
                limitType: z.ZodOptional<z.ZodEnum<{
                    requests: "requests";
                    tokens: "tokens";
                    bandwidth: "bandwidth";
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
        TIMEOUT: {
            readonly status: 504;
            readonly data: z.ZodObject<{
                timeoutMs: z.ZodOptional<z.ZodNumber>;
                operation: z.ZodOptional<z.ZodString>;
                retryable: z.ZodDefault<z.ZodBoolean>;
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
    getCatalogProject: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        slug: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            slug: z.ZodString;
            projectRef: z.ZodString;
            name: z.ZodString;
            tagline: z.ZodNullable<z.ZodString>;
            description: z.ZodNullable<z.ZodString>;
            imageUrl: z.ZodNullable<z.ZodString>;
            repositoryUrl: z.ZodNullable<z.ZodString>;
            catalogUrl: z.ZodString;
            tags: z.ZodArray<z.ZodString>;
            phase: z.ZodNullable<z.ZodString>;
            status: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        CONNECTION_ERROR: {
            readonly status: 502;
            readonly data: z.ZodObject<{
                errorCode: z.ZodOptional<z.ZodString>;
                host: z.ZodOptional<z.ZodString>;
                port: z.ZodOptional<z.ZodNumber>;
                suggestion: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        RATE_LIMITED: {
            readonly status: 429;
            readonly data: z.ZodObject<{
                retryAfter: z.ZodNumber;
                remainingRequests: z.ZodOptional<z.ZodNumber>;
                resetTime: z.ZodOptional<z.ZodString>;
                limitType: z.ZodOptional<z.ZodEnum<{
                    requests: "requests";
                    tokens: "tokens";
                    bandwidth: "bandwidth";
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
        TIMEOUT: {
            readonly status: 504;
            readonly data: z.ZodObject<{
                timeoutMs: z.ZodOptional<z.ZodNumber>;
                operation: z.ZodOptional<z.ZodString>;
                retryable: z.ZodDefault<z.ZodBoolean>;
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
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    listCatalogClaims: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        nearAccount: z.ZodOptional<z.ZodString>;
        projectSlug: z.ZodOptional<z.ZodString>;
        limit: z.ZodOptional<z.ZodNumber>;
        cursor: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            nearAccount: z.ZodString;
            projectSlug: z.ZodString;
            roles: z.ZodArray<z.ZodString>;
            activityEventId: z.ZodNullable<z.ZodString>;
            revokedAt: z.ZodNullable<z.ZodISODateTime>;
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
    listClaimedCatalogProjects: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        nearAccount: z.ZodOptional<z.ZodString>;
        limit: z.ZodOptional<z.ZodNumber>;
        cursor: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            project: z.ZodObject<{
                slug: z.ZodString;
                projectRef: z.ZodString;
                name: z.ZodString;
                tagline: z.ZodNullable<z.ZodString>;
                description: z.ZodNullable<z.ZodString>;
                imageUrl: z.ZodNullable<z.ZodString>;
                repositoryUrl: z.ZodNullable<z.ZodString>;
                catalogUrl: z.ZodString;
                tags: z.ZodArray<z.ZodString>;
                phase: z.ZodNullable<z.ZodString>;
                status: z.ZodNullable<z.ZodString>;
            }, z.core.$strip>;
            contributors: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                nearAccount: z.ZodString;
                roles: z.ZodArray<z.ZodString>;
                createdAt: z.ZodISODateTime;
                updatedAt: z.ZodISODateTime;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        meta: z.ZodObject<{
            total: z.ZodNumber;
            hasMore: z.ZodBoolean;
            nextCursor: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        CONNECTION_ERROR: {
            readonly status: 502;
            readonly data: z.ZodObject<{
                errorCode: z.ZodOptional<z.ZodString>;
                host: z.ZodOptional<z.ZodString>;
                port: z.ZodOptional<z.ZodNumber>;
                suggestion: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        RATE_LIMITED: {
            readonly status: 429;
            readonly data: z.ZodObject<{
                retryAfter: z.ZodNumber;
                remainingRequests: z.ZodOptional<z.ZodNumber>;
                resetTime: z.ZodOptional<z.ZodString>;
                limitType: z.ZodOptional<z.ZodEnum<{
                    requests: "requests";
                    tokens: "tokens";
                    bandwidth: "bandwidth";
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
        TIMEOUT: {
            readonly status: 504;
            readonly data: z.ZodObject<{
                timeoutMs: z.ZodOptional<z.ZodNumber>;
                operation: z.ZodOptional<z.ZodString>;
                retryable: z.ZodDefault<z.ZodBoolean>;
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
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    getCatalogClaimHistory: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            claimId: z.ZodString;
            nearAccount: z.ZodString;
            projectSlug: z.ZodString;
            roles: z.ZodArray<z.ZodString>;
            activityEventId: z.ZodNullable<z.ZodString>;
            action: z.ZodEnum<{
                applied: "applied";
                "activity-linked": "activity-linked";
                revoked: "revoked";
            }>;
            occurredAt: z.ZodISODateTime;
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
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    applyCatalogClaim: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        nearAccount: z.ZodString;
        projectSlug: z.ZodString;
        roles: z.ZodArray<z.ZodString>;
        activityEventId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            nearAccount: z.ZodString;
            projectSlug: z.ZodString;
            roles: z.ZodArray<z.ZodString>;
            activityEventId: z.ZodNullable<z.ZodString>;
            revokedAt: z.ZodNullable<z.ZodISODateTime>;
            createdAt: z.ZodISODateTime;
            updatedAt: z.ZodISODateTime;
        }, z.core.$strip>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        CONNECTION_ERROR: {
            readonly status: 502;
            readonly data: z.ZodObject<{
                errorCode: z.ZodOptional<z.ZodString>;
                host: z.ZodOptional<z.ZodString>;
                port: z.ZodOptional<z.ZodNumber>;
                suggestion: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        RATE_LIMITED: {
            readonly status: 429;
            readonly data: z.ZodObject<{
                retryAfter: z.ZodNumber;
                remainingRequests: z.ZodOptional<z.ZodNumber>;
                resetTime: z.ZodOptional<z.ZodString>;
                limitType: z.ZodOptional<z.ZodEnum<{
                    requests: "requests";
                    tokens: "tokens";
                    bandwidth: "bandwidth";
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
        TIMEOUT: {
            readonly status: 504;
            readonly data: z.ZodObject<{
                timeoutMs: z.ZodOptional<z.ZodNumber>;
                operation: z.ZodOptional<z.ZodString>;
                retryable: z.ZodDefault<z.ZodBoolean>;
            }, z.core.$strip>;
        };
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
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    setCatalogClaimActivity: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
        activityEventId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            nearAccount: z.ZodString;
            projectSlug: z.ZodString;
            roles: z.ZodArray<z.ZodString>;
            activityEventId: z.ZodNullable<z.ZodString>;
            revokedAt: z.ZodNullable<z.ZodISODateTime>;
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
    revokeCatalogClaim: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            nearAccount: z.ZodString;
            projectSlug: z.ZodString;
            roles: z.ZodArray<z.ZodString>;
            activityEventId: z.ZodNullable<z.ZodString>;
            revokedAt: z.ZodNullable<z.ZodISODateTime>;
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
};
export type ContractType = typeof contract;
