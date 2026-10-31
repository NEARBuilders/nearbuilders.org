import "@orpc/openapi/extensions/route";
import { z } from "zod";
export declare const CreditClaimSchema: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<{
        expired: "expired";
        failed: "failed";
        issued: "issued";
        pending: "pending";
        revoked: "revoked";
    }>;
    keyPrefix: z.ZodNullable<z.ZodString>;
    spendLimitUsd: z.ZodNumber;
    keyExpiresAt: z.ZodISODateTime;
    createdAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const AdminCreditClaimSchema: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<{
        expired: "expired";
        failed: "failed";
        issued: "issued";
        pending: "pending";
        revoked: "revoked";
    }>;
    keyPrefix: z.ZodNullable<z.ZodString>;
    spendLimitUsd: z.ZodNumber;
    keyExpiresAt: z.ZodISODateTime;
    createdAt: z.ZodISODateTime;
    nearAccountId: z.ZodString;
    userId: z.ZodString;
    ip: z.ZodNullable<z.ZodString>;
    ipClaimCount: z.ZodNumber;
    error: z.ZodNullable<z.ZodString>;
    revokedAt: z.ZodNullable<z.ZodISODateTime>;
}, z.core.$strip>;
export declare const CreditSettingsSchema: z.ZodObject<{
    enabled: z.ZodBoolean;
    amountUsd: z.ZodNumber;
    claimsCloseAt: z.ZodNullable<z.ZodISODateTime>;
    keyExpiresAt: z.ZodNullable<z.ZodISODateTime>;
    nearAiWorkspaceId: z.ZodString;
    nearAiLoginAccountId: z.ZodString;
    updatedBy: z.ZodNullable<z.ZodString>;
    updatedAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const CreditSettingsInputSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    amountUsd: z.ZodNumber;
    claimsCloseAt: z.ZodNullable<z.ZodISODateTime>;
    keyExpiresAt: z.ZodNullable<z.ZodISODateTime>;
    nearAiWorkspaceId: z.ZodString;
    nearAiLoginAccountId: z.ZodString;
}, z.core.$strip>;
export declare const NearAiSignedMessageSchema: z.ZodObject<{
    accountId: z.ZodString;
    publicKey: z.ZodString;
    signature: z.ZodString;
    state: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const NearAiLoginPayloadSchema: z.ZodObject<{
    message: z.ZodLiteral<"Sign in to NEAR AI Cloud">;
    nonce: z.ZodArray<z.ZodNumber>;
    recipient: z.ZodLiteral<"cloud.near.ai">;
    callbackUrl: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const NearAiSessionSchema: z.ZodObject<{
    status: z.ZodEnum<{
        absent: "absent";
        expired: "expired";
        valid: "valid";
    }>;
    refreshExpiresAt: z.ZodNullable<z.ZodISODateTime>;
}, z.core.$strip>;
export declare const CreditEligibilitySchema: z.ZodEnum<{
    eligible: "eligible";
    needs_approved_profile: "needs_approved_profile";
    needs_near_account: "needs_near_account";
}>;
export declare const contract: {
    getCreditStatus: import("@orpc/contract").ProcedureContract<z.ZodObject<{}, z.core.$strip>, z.ZodObject<{
        available: z.ZodBoolean;
        amountUsd: z.ZodNumber;
        claimsCloseAt: z.ZodNullable<z.ZodISODateTime>;
        eligibility: z.ZodEnum<{
            eligible: "eligible";
            needs_approved_profile: "needs_approved_profile";
            needs_near_account: "needs_near_account";
        }>;
        claim: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            status: z.ZodEnum<{
                expired: "expired";
                failed: "failed";
                issued: "issued";
                pending: "pending";
                revoked: "revoked";
            }>;
            keyPrefix: z.ZodNullable<z.ZodString>;
            spendLimitUsd: z.ZodNumber;
            keyExpiresAt: z.ZodISODateTime;
            createdAt: z.ZodISODateTime;
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
    }>;
    claimCredits: import("@orpc/contract").ProcedureContract<z.ZodObject<{}, z.core.$strip>, z.ZodObject<{
        key: z.ZodString;
        claim: z.ZodObject<{
            id: z.ZodString;
            status: z.ZodEnum<{
                expired: "expired";
                failed: "failed";
                issued: "issued";
                pending: "pending";
                revoked: "revoked";
            }>;
            keyPrefix: z.ZodNullable<z.ZodString>;
            spendLimitUsd: z.ZodNumber;
            keyExpiresAt: z.ZodISODateTime;
            createdAt: z.ZodISODateTime;
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
        CONFLICT: {
            readonly status: 409;
            readonly message: "The request conflicts with the current state";
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
    listCreditClaims: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        limit: z.ZodDefault<z.ZodNumber>;
        cursor: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            status: z.ZodEnum<{
                expired: "expired";
                failed: "failed";
                issued: "issued";
                pending: "pending";
                revoked: "revoked";
            }>;
            keyPrefix: z.ZodNullable<z.ZodString>;
            spendLimitUsd: z.ZodNumber;
            keyExpiresAt: z.ZodISODateTime;
            createdAt: z.ZodISODateTime;
            nearAccountId: z.ZodString;
            userId: z.ZodString;
            ip: z.ZodNullable<z.ZodString>;
            ipClaimCount: z.ZodNumber;
            error: z.ZodNullable<z.ZodString>;
            revokedAt: z.ZodNullable<z.ZodISODateTime>;
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
    revokeCreditClaim: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            status: z.ZodEnum<{
                expired: "expired";
                failed: "failed";
                issued: "issued";
                pending: "pending";
                revoked: "revoked";
            }>;
            keyPrefix: z.ZodNullable<z.ZodString>;
            spendLimitUsd: z.ZodNumber;
            keyExpiresAt: z.ZodISODateTime;
            createdAt: z.ZodISODateTime;
            nearAccountId: z.ZodString;
            userId: z.ZodString;
            ip: z.ZodNullable<z.ZodString>;
            ipClaimCount: z.ZodNumber;
            error: z.ZodNullable<z.ZodString>;
            revokedAt: z.ZodNullable<z.ZodISODateTime>;
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
        SERVICE_UNAVAILABLE: {
            readonly status: 503;
            readonly data: z.ZodObject<{
                retryAfter: z.ZodOptional<z.ZodNumber>;
                maintenanceWindow: z.ZodDefault<z.ZodBoolean>;
                estimatedUptime: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    getCreditSettings: import("@orpc/contract").ProcedureContract<z.ZodObject<{}, z.core.$strip>, z.ZodObject<{
        settings: z.ZodNullable<z.ZodObject<{
            enabled: z.ZodBoolean;
            amountUsd: z.ZodNumber;
            claimsCloseAt: z.ZodNullable<z.ZodISODateTime>;
            keyExpiresAt: z.ZodNullable<z.ZodISODateTime>;
            nearAiWorkspaceId: z.ZodString;
            nearAiLoginAccountId: z.ZodString;
            updatedBy: z.ZodNullable<z.ZodString>;
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
    updateCreditSettings: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        amountUsd: z.ZodNumber;
        claimsCloseAt: z.ZodNullable<z.ZodISODateTime>;
        keyExpiresAt: z.ZodNullable<z.ZodISODateTime>;
        nearAiWorkspaceId: z.ZodString;
        nearAiLoginAccountId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        settings: z.ZodObject<{
            enabled: z.ZodBoolean;
            amountUsd: z.ZodNumber;
            claimsCloseAt: z.ZodNullable<z.ZodISODateTime>;
            keyExpiresAt: z.ZodNullable<z.ZodISODateTime>;
            nearAiWorkspaceId: z.ZodString;
            nearAiLoginAccountId: z.ZodString;
            updatedBy: z.ZodNullable<z.ZodString>;
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
    nearAiSessionStatus: import("@orpc/contract").ProcedureContract<z.ZodObject<{}, z.core.$strip>, z.ZodObject<{
        status: z.ZodEnum<{
            absent: "absent";
            expired: "expired";
            valid: "valid";
        }>;
        refreshExpiresAt: z.ZodNullable<z.ZodISODateTime>;
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
        SERVICE_UNAVAILABLE: {
            readonly status: 503;
            readonly data: z.ZodObject<{
                retryAfter: z.ZodOptional<z.ZodNumber>;
                maintenanceWindow: z.ZodDefault<z.ZodBoolean>;
                estimatedUptime: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    loginNearAi: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        signedMessage: z.ZodObject<{
            accountId: z.ZodString;
            publicKey: z.ZodString;
            signature: z.ZodString;
            state: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        payload: z.ZodObject<{
            message: z.ZodLiteral<"Sign in to NEAR AI Cloud">;
            nonce: z.ZodArray<z.ZodNumber>;
            recipient: z.ZodLiteral<"cloud.near.ai">;
            callbackUrl: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        status: z.ZodEnum<{
            absent: "absent";
            expired: "expired";
            valid: "valid";
        }>;
        refreshExpiresAt: z.ZodNullable<z.ZodISODateTime>;
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
        SERVICE_UNAVAILABLE: {
            readonly status: 503;
            readonly data: z.ZodObject<{
                retryAfter: z.ZodOptional<z.ZodNumber>;
                maintenanceWindow: z.ZodDefault<z.ZodBoolean>;
                estimatedUptime: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
};
export type ContractType = typeof contract;
