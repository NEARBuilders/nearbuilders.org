import "@orpc/openapi/extensions/route";
import { z } from "zod";
export declare const contract: {
    listRegistryApps: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        parent: z.ZodOptional<z.ZodString>;
        root: z.ZodOptional<z.ZodString>;
        ancestor: z.ZodOptional<z.ZodString>;
        limit: z.ZodOptional<z.ZodNumber>;
        cursor: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            accountId: z.ZodString;
            gatewayId: z.ZodString;
            canonicalKey: z.ZodString;
            canonicalConfigUrl: z.ZodString;
            startCommand: z.ZodString;
            domain: z.ZodNullable<z.ZodString>;
            openUrl: z.ZodNullable<z.ZodString>;
            hostUrl: z.ZodNullable<z.ZodString>;
            uiUrl: z.ZodNullable<z.ZodString>;
            uiSsrUrl: z.ZodNullable<z.ZodString>;
            apiUrl: z.ZodNullable<z.ZodString>;
            extends: z.ZodNullable<z.ZodString>;
            parent: z.ZodNullable<z.ZodString>;
            root: z.ZodNullable<z.ZodString>;
            depth: z.ZodNumber;
            status: z.ZodEnum<{
                invalid: "invalid";
                ready: "ready";
            }>;
            metadata: z.ZodNullable<z.ZodObject<{
                claimedBy: z.ZodNullable<z.ZodString>;
                title: z.ZodNullable<z.ZodString>;
                description: z.ZodNullable<z.ZodString>;
                repoUrl: z.ZodNullable<z.ZodString>;
                homepageUrl: z.ZodNullable<z.ZodString>;
                imageUrl: z.ZodNullable<z.ZodString>;
                updatedAt: z.ZodNullable<z.ZodISODateTime>;
            }, z.core.$strip>>;
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
    getRegistryAppsByAccount: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        accountId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            accountId: z.ZodString;
            gatewayId: z.ZodString;
            canonicalKey: z.ZodString;
            canonicalConfigUrl: z.ZodString;
            startCommand: z.ZodString;
            domain: z.ZodNullable<z.ZodString>;
            openUrl: z.ZodNullable<z.ZodString>;
            hostUrl: z.ZodNullable<z.ZodString>;
            uiUrl: z.ZodNullable<z.ZodString>;
            uiSsrUrl: z.ZodNullable<z.ZodString>;
            apiUrl: z.ZodNullable<z.ZodString>;
            extends: z.ZodNullable<z.ZodString>;
            parent: z.ZodNullable<z.ZodString>;
            root: z.ZodNullable<z.ZodString>;
            depth: z.ZodNumber;
            status: z.ZodEnum<{
                invalid: "invalid";
                ready: "ready";
            }>;
            metadata: z.ZodNullable<z.ZodObject<{
                claimedBy: z.ZodNullable<z.ZodString>;
                title: z.ZodNullable<z.ZodString>;
                description: z.ZodNullable<z.ZodString>;
                repoUrl: z.ZodNullable<z.ZodString>;
                homepageUrl: z.ZodNullable<z.ZodString>;
                imageUrl: z.ZodNullable<z.ZodString>;
                updatedAt: z.ZodNullable<z.ZodISODateTime>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        meta: z.ZodObject<{
            total: z.ZodNumber;
            hasMore: z.ZodBoolean;
            nextCursor: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>, {
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    getRegistryApp: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        accountId: z.ZodString;
        gatewayId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            accountId: z.ZodString;
            gatewayId: z.ZodString;
            canonicalKey: z.ZodString;
            canonicalConfigUrl: z.ZodString;
            startCommand: z.ZodString;
            domain: z.ZodNullable<z.ZodString>;
            openUrl: z.ZodNullable<z.ZodString>;
            hostUrl: z.ZodNullable<z.ZodString>;
            uiUrl: z.ZodNullable<z.ZodString>;
            uiSsrUrl: z.ZodNullable<z.ZodString>;
            apiUrl: z.ZodNullable<z.ZodString>;
            extends: z.ZodNullable<z.ZodString>;
            parent: z.ZodNullable<z.ZodString>;
            root: z.ZodNullable<z.ZodString>;
            depth: z.ZodNumber;
            status: z.ZodEnum<{
                invalid: "invalid";
                ready: "ready";
            }>;
            metadata: z.ZodNullable<z.ZodObject<{
                claimedBy: z.ZodNullable<z.ZodString>;
                title: z.ZodNullable<z.ZodString>;
                description: z.ZodNullable<z.ZodString>;
                repoUrl: z.ZodNullable<z.ZodString>;
                homepageUrl: z.ZodNullable<z.ZodString>;
                imageUrl: z.ZodNullable<z.ZodString>;
                updatedAt: z.ZodNullable<z.ZodISODateTime>;
            }, z.core.$strip>>;
            metadataKey: z.ZodString;
            metadataContractId: z.ZodString;
            metadataFastKvUrl: z.ZodString;
            extendsChain: z.ZodArray<z.ZodString>;
            resolvedConfig: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>;
    }, z.core.$strip>, {
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    getRegistryAppByHost: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        hostUrl: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            accountId: z.ZodString;
            gatewayId: z.ZodString;
            canonicalKey: z.ZodString;
            canonicalConfigUrl: z.ZodString;
            startCommand: z.ZodString;
            domain: z.ZodNullable<z.ZodString>;
            openUrl: z.ZodNullable<z.ZodString>;
            hostUrl: z.ZodNullable<z.ZodString>;
            uiUrl: z.ZodNullable<z.ZodString>;
            uiSsrUrl: z.ZodNullable<z.ZodString>;
            apiUrl: z.ZodNullable<z.ZodString>;
            extends: z.ZodNullable<z.ZodString>;
            parent: z.ZodNullable<z.ZodString>;
            root: z.ZodNullable<z.ZodString>;
            depth: z.ZodNumber;
            status: z.ZodEnum<{
                invalid: "invalid";
                ready: "ready";
            }>;
            metadata: z.ZodNullable<z.ZodObject<{
                claimedBy: z.ZodNullable<z.ZodString>;
                title: z.ZodNullable<z.ZodString>;
                description: z.ZodNullable<z.ZodString>;
                repoUrl: z.ZodNullable<z.ZodString>;
                homepageUrl: z.ZodNullable<z.ZodString>;
                imageUrl: z.ZodNullable<z.ZodString>;
                updatedAt: z.ZodNullable<z.ZodISODateTime>;
            }, z.core.$strip>>;
            metadataKey: z.ZodString;
            metadataContractId: z.ZodString;
            metadataFastKvUrl: z.ZodString;
            extendsChain: z.ZodArray<z.ZodString>;
            resolvedConfig: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>;
    }, z.core.$strip>, {
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    getRegistryStatus: import("@orpc/contract").ProcedureContract<import("@orpc/contract").InitialInputSchema, z.ZodObject<{
        discoveredApps: z.ZodNumber;
        metadataContractId: z.ZodString;
        metadataFastKvUrl: z.ZodString;
        relayEnabled: z.ZodBoolean;
        relayAccountId: z.ZodNullable<z.ZodString>;
        timestamp: z.ZodISODateTime;
    }, z.core.$strip>, object>;
    prepareRegistryMetadataWrite: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        accountId: z.ZodString;
        gatewayId: z.ZodString;
        claimedBy: z.ZodString;
        title: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        repoUrl: z.ZodOptional<z.ZodString>;
        homepageUrl: z.ZodOptional<z.ZodString>;
        imageUrl: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            contractId: z.ZodString;
            methodName: z.ZodLiteral<"__fastdata_kv">;
            key: z.ZodString;
            manifest: z.ZodObject<{
                claimedBy: z.ZodNullable<z.ZodString>;
                title: z.ZodNullable<z.ZodString>;
                description: z.ZodNullable<z.ZodString>;
                repoUrl: z.ZodNullable<z.ZodString>;
                homepageUrl: z.ZodNullable<z.ZodString>;
                imageUrl: z.ZodNullable<z.ZodString>;
                updatedAt: z.ZodNullable<z.ZodISODateTime>;
            }, z.core.$strip>;
            args: z.ZodRecord<z.ZodString, z.ZodString>;
            gas: z.ZodString;
            attachedDeposit: z.ZodString;
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
    relayRegistryMetadataWrite: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        payload: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            transactionHash: z.ZodNullable<z.ZodString>;
            relayerAccountId: z.ZodString;
            senderId: z.ZodString;
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
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
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
    }>;
    kvGet: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        path: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodNullable<z.ZodUnknown>;
    }, z.core.$strip>, {
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    kvList: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        prefix: z.ZodString;
        limit: z.ZodOptional<z.ZodNumber>;
        cursor: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            value: z.ZodUnknown;
            blockHeight: z.ZodOptional<z.ZodNumber>;
            blockTimestamp: z.ZodOptional<z.ZodNumber>;
            txHash: z.ZodOptional<z.ZodString>;
            signerId: z.ZodOptional<z.ZodString>;
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
    kvPrepareWrite: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        entries: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            value: z.ZodUnknown;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            contractId: z.ZodString;
            methodName: z.ZodLiteral<"__fastdata_kv">;
            args: z.ZodRecord<z.ZodString, z.ZodString>;
            gas: z.ZodString;
            attachedDeposit: z.ZodString;
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
    kvRelayWrite: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        payload: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            transactionHash: z.ZodNullable<z.ZodString>;
            relayerAccountId: z.ZodString;
            senderId: z.ZodString;
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
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
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
    }>;
};
export type ContractType = typeof contract;
