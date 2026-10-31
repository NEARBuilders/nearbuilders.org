import "@orpc/openapi/extensions/route";
import { z } from "zod";
export declare const contract: {
    bookmark: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        entityId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        entityId: z.ZodString;
        userId: z.ZodString;
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
    unbookmark: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        entityId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        entityId: z.ZodString;
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
    getUserBookmark: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        entityId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        entityId: z.ZodString;
        isBookmarked: z.ZodBoolean;
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
};
export type ContractType = typeof contract;
