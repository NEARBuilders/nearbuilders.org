import { z } from "every-plugin/zod";
export declare const contract: {
    getBinding: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        nearAccountId: z.ZodString;
    }, z.core.$strip>, z.ZodNullable<z.ZodObject<{
        npub: z.ZodString;
        relay: z.ZodString;
        proof: z.ZodString;
        boundAt: z.ZodNumber;
    }, z.core.$strip>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
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
    getIdentity: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        nearAccountId: z.ZodString;
        enrichProfile: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>, z.ZodNullable<z.ZodObject<{
        nearAccountId: z.ZodString;
        nostrPubkey: z.ZodString;
        relay: z.ZodString;
        proof: z.ZodString;
        boundAt: z.ZodNumber;
        profile: z.ZodNullable<z.ZodOptional<z.ZodObject<{
            name: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            picture: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            about: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            nip05: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            website: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
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
    createChallenge: import("@orpc/contract").ContractProcedure<z.ZodObject<{}, z.core.$strip>, z.ZodObject<{
        challenge: z.ZodString;
        expiresAt: z.ZodNumber;
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
    verifyBinding: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        event: z.ZodObject<{
            id: z.ZodString;
            pubkey: z.ZodString;
            content: z.ZodString;
            tags: z.ZodArray<z.ZodArray<z.ZodString>>;
            created_at: z.ZodNumber;
            sig: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        valid: z.ZodBoolean;
        nearAccountId: z.ZodString;
        nostrPubkey: z.ZodString;
        proof: z.ZodString;
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
    prepareBindingWrite: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        nostrPubkey: z.ZodString;
        relay: z.ZodString;
        proof: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        contractId: z.ZodString;
        methodName: z.ZodLiteral<"__fastdata_kv">;
        key: z.ZodString;
        value: z.ZodString;
        args: z.ZodRecord<z.ZodString, z.ZodString>;
        gas: z.ZodString;
        attachedDeposit: z.ZodString;
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
};
export type ContractType = typeof contract;
