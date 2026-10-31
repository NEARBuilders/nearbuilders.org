import "@orpc/openapi/extensions/route";
import { z } from "zod";
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
        "activity-linked": "activity-linked";
        applied: "applied";
        revoked: "revoked";
    }>;
    occurredAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const CatalogCategorySchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
}, z.core.$strip>;
export declare const CATALOG_LISTING_SYNC: unique symbol;
export declare const CatalogListingKindSchema: z.ZodEnum<{
    person: "person";
    project: "project";
}>;
export declare const CatalogListingStatusSchema: z.ZodEnum<{
    approved: "approved";
    none: "none";
    pending: "pending";
    published: "published";
    rejected: "rejected";
}>;
export declare const CatalogPreferredContactSchema: z.ZodEnum<{
    Discord: "Discord";
    Email: "Email";
    Telegram: "Telegram";
    Website: "Website";
    X: "X";
}>;
export declare const CatalogExportProjectSchema: z.ZodObject<{
    slug: z.ZodString;
    title: z.ZodString;
    oneliner: z.ZodString;
    description: z.ZodString;
    logo: z.ZodURL;
    categories: z.ZodArray<z.ZodString>;
    website: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
    twitter: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
    medium: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
    telegram: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
    github: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
    discord: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
    whitepaper: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
    "token-address": z.ZodString;
    "coingecko-address": z.ZodString;
    "nearsocial-address": z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
    dapp: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
    phase: z.ZodString;
    source: z.ZodObject<{
        site: z.ZodString;
        url: z.ZodURL;
        nearAccount: z.ZodString;
        updatedAt: z.ZodISODateTime;
    }, z.core.$strict>;
}, z.core.$strict>;
export declare const CatalogExportPersonSchema: z.ZodObject<{
    name: z.ZodString;
    preferredContact: z.ZodEnum<{
        Discord: "Discord";
        Email: "Email";
        Telegram: "Telegram";
        Website: "Website";
        X: "X";
    }>;
    description: z.ZodString;
    organization: z.ZodString;
    team: z.ZodString;
    jobTitle: z.ZodString;
    email: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodEmail]>;
    telegram: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
    twitter: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
    discord: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
    website: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
    avatar: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
    nearProjects: z.ZodString;
    nearAccount: z.ZodString;
}, z.core.$strict>;
export declare const CatalogListingSchema: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<{
        person: "person";
        project: "project";
    }>;
    entityId: z.ZodString;
    ownerId: z.ZodString;
    slug: z.ZodString;
    status: z.ZodEnum<{
        approved: "approved";
        none: "none";
        pending: "pending";
        published: "published";
        rejected: "rejected";
    }>;
    record: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    approvedBy: z.ZodNullable<z.ZodString>;
    approvedAt: z.ZodNullable<z.ZodISODateTime>;
    publishedAt: z.ZodNullable<z.ZodISODateTime>;
    removedAt: z.ZodNullable<z.ZodISODateTime>;
    changedAt: z.ZodISODateTime;
    createdAt: z.ZodISODateTime;
    updatedAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const CatalogExportProjectRemovalSchema: z.ZodObject<{
    slug: z.ZodString;
    nearAccount: z.ZodString;
    removedAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const CatalogExportPersonRemovalSchema: z.ZodObject<{
    nearAccount: z.ZodString;
    name: z.ZodString;
    removedAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const PublicCatalogListingSchema: z.ZodObject<{
    kind: z.ZodEnum<{
        person: "person";
        project: "project";
    }>;
    entityId: z.ZodString;
    slug: z.ZodString;
    status: z.ZodEnum<{
        approved: "approved";
        published: "published";
    }>;
    catalogUrl: z.ZodNullable<z.ZodString>;
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
    searchCatalogProjects: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        query: z.ZodString;
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
    }, z.core.$strip>, {
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
                    bandwidth: "bandwidth";
                    requests: "requests";
                    tokens: "tokens";
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
    }>;
    listCatalogCategories: import("@orpc/contract").ProcedureContract<z.ZodObject<{}, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>, object>;
    getCatalogProject: import("@orpc/contract").ProcedureContract<z.ZodObject<{
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
    }, z.core.$strip>, {
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
                    bandwidth: "bandwidth";
                    requests: "requests";
                    tokens: "tokens";
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
    }>;
    listCatalogClaims: import("@orpc/contract").ProcedureContract<z.ZodObject<{
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
    }, z.core.$strip>, {
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
    listClaimedCatalogProjects: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        nearAccount: z.ZodOptional<z.ZodString>;
        query: z.ZodOptional<z.ZodString>;
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
    }, z.core.$strip>, {
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
                    bandwidth: "bandwidth";
                    requests: "requests";
                    tokens: "tokens";
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
    }>;
    getCatalogClaimHistory: import("@orpc/contract").ProcedureContract<z.ZodObject<{
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
                "activity-linked": "activity-linked";
                applied: "applied";
                revoked: "revoked";
            }>;
            occurredAt: z.ZodISODateTime;
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
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    applyCatalogClaim: import("@orpc/contract").ProcedureContract<z.ZodObject<{
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
    }, z.core.$strip>, {
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
                    bandwidth: "bandwidth";
                    requests: "requests";
                    tokens: "tokens";
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
    }>;
    setCatalogClaimActivity: import("@orpc/contract").ProcedureContract<z.ZodObject<{
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
    revokeCatalogClaim: import("@orpc/contract").ProcedureContract<z.ZodObject<{
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
    exportCatalogProjects: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        since: z.ZodOptional<z.ZodISODateTime>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            slug: z.ZodString;
            title: z.ZodString;
            oneliner: z.ZodString;
            description: z.ZodString;
            logo: z.ZodURL;
            categories: z.ZodArray<z.ZodString>;
            website: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
            twitter: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
            medium: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
            telegram: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
            github: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
            discord: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
            whitepaper: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
            "token-address": z.ZodString;
            "coingecko-address": z.ZodString;
            "nearsocial-address": z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
            dapp: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
            phase: z.ZodString;
            source: z.ZodObject<{
                site: z.ZodString;
                url: z.ZodURL;
                nearAccount: z.ZodString;
                updatedAt: z.ZodISODateTime;
            }, z.core.$strict>;
        }, z.core.$strict>>;
        removed: z.ZodArray<z.ZodObject<{
            slug: z.ZodString;
            nearAccount: z.ZodString;
            removedAt: z.ZodISODateTime;
        }, z.core.$strip>>;
        meta: z.ZodObject<{
            generatedAt: z.ZodISODateTime;
            since: z.ZodNullable<z.ZodISODateTime>;
            count: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>, {
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
    exportCatalogPeople: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        since: z.ZodOptional<z.ZodISODateTime>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            preferredContact: z.ZodEnum<{
                Discord: "Discord";
                Email: "Email";
                Telegram: "Telegram";
                Website: "Website";
                X: "X";
            }>;
            description: z.ZodString;
            organization: z.ZodString;
            team: z.ZodString;
            jobTitle: z.ZodString;
            email: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodEmail]>;
            telegram: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
            twitter: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
            discord: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
            website: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
            avatar: z.ZodUnion<readonly [z.ZodLiteral<"">, z.ZodURL]>;
            nearProjects: z.ZodString;
            nearAccount: z.ZodString;
        }, z.core.$strict>>;
        removed: z.ZodArray<z.ZodObject<{
            nearAccount: z.ZodString;
            name: z.ZodString;
            removedAt: z.ZodISODateTime;
        }, z.core.$strip>>;
        meta: z.ZodObject<{
            generatedAt: z.ZodISODateTime;
            since: z.ZodNullable<z.ZodISODateTime>;
            count: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>, {
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
    listCatalogListings: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        kind: z.ZodEnum<{
            person: "person";
            project: "project";
        }>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<{
                person: "person";
                project: "project";
            }>;
            entityId: z.ZodString;
            slug: z.ZodString;
            status: z.ZodEnum<{
                approved: "approved";
                published: "published";
            }>;
            catalogUrl: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>, object>;
    markCatalogListingPublished: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        kind: z.ZodEnum<{
            person: "person";
            project: "project";
        }>;
        entityId: z.ZodString;
        slug: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<{
                person: "person";
                project: "project";
            }>;
            entityId: z.ZodString;
            ownerId: z.ZodString;
            slug: z.ZodString;
            status: z.ZodEnum<{
                approved: "approved";
                none: "none";
                pending: "pending";
                published: "published";
                rejected: "rejected";
            }>;
            record: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            approvedBy: z.ZodNullable<z.ZodString>;
            approvedAt: z.ZodNullable<z.ZodISODateTime>;
            publishedAt: z.ZodNullable<z.ZodISODateTime>;
            removedAt: z.ZodNullable<z.ZodISODateTime>;
            changedAt: z.ZodISODateTime;
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
    }>;
    getCatalogListing: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        kind: z.ZodEnum<{
            person: "person";
            project: "project";
        }>;
        entityId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<{
                person: "person";
                project: "project";
            }>;
            entityId: z.ZodString;
            ownerId: z.ZodString;
            slug: z.ZodString;
            status: z.ZodEnum<{
                approved: "approved";
                none: "none";
                pending: "pending";
                published: "published";
                rejected: "rejected";
            }>;
            record: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            approvedBy: z.ZodNullable<z.ZodString>;
            approvedAt: z.ZodNullable<z.ZodISODateTime>;
            publishedAt: z.ZodNullable<z.ZodISODateTime>;
            removedAt: z.ZodNullable<z.ZodISODateTime>;
            changedAt: z.ZodISODateTime;
            createdAt: z.ZodISODateTime;
            updatedAt: z.ZodISODateTime;
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
    markCatalogListingPending: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        kind: z.ZodEnum<{
            person: "person";
            project: "project";
        }>;
        entityId: z.ZodString;
        ownerId: z.ZodString;
        slug: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<{
                person: "person";
                project: "project";
            }>;
            entityId: z.ZodString;
            ownerId: z.ZodString;
            slug: z.ZodString;
            status: z.ZodEnum<{
                approved: "approved";
                none: "none";
                pending: "pending";
                published: "published";
                rejected: "rejected";
            }>;
            record: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            approvedBy: z.ZodNullable<z.ZodString>;
            approvedAt: z.ZodNullable<z.ZodISODateTime>;
            publishedAt: z.ZodNullable<z.ZodISODateTime>;
            removedAt: z.ZodNullable<z.ZodISODateTime>;
            changedAt: z.ZodISODateTime;
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
    approveCatalogListing: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        kind: z.ZodEnum<{
            person: "person";
            project: "project";
        }>;
        entityId: z.ZodString;
        ownerId: z.ZodString;
        slug: z.ZodString;
        record: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        approvedBy: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<{
                person: "person";
                project: "project";
            }>;
            entityId: z.ZodString;
            ownerId: z.ZodString;
            slug: z.ZodString;
            status: z.ZodEnum<{
                approved: "approved";
                none: "none";
                pending: "pending";
                published: "published";
                rejected: "rejected";
            }>;
            record: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            approvedBy: z.ZodNullable<z.ZodString>;
            approvedAt: z.ZodNullable<z.ZodISODateTime>;
            publishedAt: z.ZodNullable<z.ZodISODateTime>;
            removedAt: z.ZodNullable<z.ZodISODateTime>;
            changedAt: z.ZodISODateTime;
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
    rejectCatalogListing: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        kind: z.ZodEnum<{
            person: "person";
            project: "project";
        }>;
        entityId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<{
                person: "person";
                project: "project";
            }>;
            entityId: z.ZodString;
            ownerId: z.ZodString;
            slug: z.ZodString;
            status: z.ZodEnum<{
                approved: "approved";
                none: "none";
                pending: "pending";
                published: "published";
                rejected: "rejected";
            }>;
            record: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            approvedBy: z.ZodNullable<z.ZodString>;
            approvedAt: z.ZodNullable<z.ZodISODateTime>;
            publishedAt: z.ZodNullable<z.ZodISODateTime>;
            removedAt: z.ZodNullable<z.ZodISODateTime>;
            changedAt: z.ZodISODateTime;
            createdAt: z.ZodISODateTime;
            updatedAt: z.ZodISODateTime;
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
    withdrawCatalogListing: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        kind: z.ZodEnum<{
            person: "person";
            project: "project";
        }>;
        entityId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<{
                person: "person";
                project: "project";
            }>;
            entityId: z.ZodString;
            ownerId: z.ZodString;
            slug: z.ZodString;
            status: z.ZodEnum<{
                approved: "approved";
                none: "none";
                pending: "pending";
                published: "published";
                rejected: "rejected";
            }>;
            record: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            approvedBy: z.ZodNullable<z.ZodString>;
            approvedAt: z.ZodNullable<z.ZodISODateTime>;
            publishedAt: z.ZodNullable<z.ZodISODateTime>;
            removedAt: z.ZodNullable<z.ZodISODateTime>;
            changedAt: z.ZodISODateTime;
            createdAt: z.ZodISODateTime;
            updatedAt: z.ZodISODateTime;
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
    refreshCatalogListingRecord: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        kind: z.ZodEnum<{
            person: "person";
            project: "project";
        }>;
        entityId: z.ZodString;
        record: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<{
                person: "person";
                project: "project";
            }>;
            entityId: z.ZodString;
            ownerId: z.ZodString;
            slug: z.ZodString;
            status: z.ZodEnum<{
                approved: "approved";
                none: "none";
                pending: "pending";
                published: "published";
                rejected: "rejected";
            }>;
            record: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            approvedBy: z.ZodNullable<z.ZodString>;
            approvedAt: z.ZodNullable<z.ZodISODateTime>;
            publishedAt: z.ZodNullable<z.ZodISODateTime>;
            removedAt: z.ZodNullable<z.ZodISODateTime>;
            changedAt: z.ZodISODateTime;
            createdAt: z.ZodISODateTime;
            updatedAt: z.ZodISODateTime;
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
};
export type ContractType = typeof contract;
