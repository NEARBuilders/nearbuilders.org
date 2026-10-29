import "@orpc/openapi/extensions/route";
import { z } from "zod";
export declare const NotificationSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    type: z.ZodString;
    source: z.ZodString;
    subject: z.ZodString;
    body: z.ZodNullable<z.ZodString>;
    link: z.ZodString;
    read: z.ZodBoolean;
    createdAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const contract: {
    createNotification: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        userId: z.ZodString;
        type: z.ZodString;
        source: z.ZodString;
        subject: z.ZodString;
        body: z.ZodOptional<z.ZodString>;
        link: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            userId: z.ZodString;
            type: z.ZodString;
            source: z.ZodString;
            subject: z.ZodString;
            body: z.ZodNullable<z.ZodString>;
            link: z.ZodString;
            read: z.ZodBoolean;
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
    }>;
    getMyNotifications: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        read: z.ZodOptional<z.ZodBoolean>;
        limit: z.ZodOptional<z.ZodNumber>;
        cursor: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            userId: z.ZodString;
            type: z.ZodString;
            source: z.ZodString;
            subject: z.ZodString;
            body: z.ZodNullable<z.ZodString>;
            link: z.ZodString;
            read: z.ZodBoolean;
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
    }>;
    markAsRead: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            userId: z.ZodString;
            type: z.ZodString;
            source: z.ZodString;
            subject: z.ZodString;
            body: z.ZodNullable<z.ZodString>;
            link: z.ZodString;
            read: z.ZodBoolean;
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
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    markAllAsRead: import("@orpc/contract").ProcedureContract<import("@orpc/contract").InitialInputSchema, z.ZodObject<{
        updated: z.ZodNumber;
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
    subscribeNotifications: import("@orpc/contract").ProcedureContract<import("@orpc/contract").InitialInputSchema, import("@orpc/contract").Schema<AsyncIteratorObject<{
        id: string;
        userId: string;
        type: string;
        source: string;
        subject: string;
        body: string | null;
        link: string;
        read: boolean;
        createdAt: string;
    }, unknown, void>, import("@orpc/server").AsyncIteratorClass<{
        id: string;
        userId: string;
        type: string;
        source: string;
        subject: string;
        body: string | null;
        link: string;
        read: boolean;
        createdAt: string;
    }, unknown, void>>, {
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
