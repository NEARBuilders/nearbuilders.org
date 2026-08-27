import { z } from "every-plugin/zod";
export declare const contract: {
    createTelegramNomination: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        headers: z.ZodObject<{
            "idempotency-key": z.ZodString;
        }, z.core.$strip>;
        body: z.ZodObject<{
            source: z.ZodLiteral<"telegram">;
            sourceNominationId: z.ZodString;
            nomineeTelegramId: z.ZodNullable<z.ZodNumber>;
            nomineeUsername: z.ZodNullable<z.ZodString>;
            nominatedByTelegramId: z.ZodNumber;
            telegramGroupId: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodUnion<readonly [z.ZodObject<{
        status: z.ZodLiteral<200>;
        headers: z.ZodRecord<z.ZodString, z.ZodString>;
        body: z.ZodObject<{
            nominationId: z.ZodString;
            status: z.ZodEnum<{
                submitted: "submitted";
                awaiting_claim: "awaiting_claim";
                awaiting_profile: "awaiting_profile";
            }>;
            joinUrl: z.ZodOptional<z.ZodString>;
            proposalId: z.ZodNullable<z.ZodString>;
            proposalEntityId: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        status: z.ZodLiteral<201>;
        headers: z.ZodRecord<z.ZodString, z.ZodString>;
        body: z.ZodObject<{
            nominationId: z.ZodString;
            status: z.ZodEnum<{
                submitted: "submitted";
                awaiting_claim: "awaiting_claim";
                awaiting_profile: "awaiting_profile";
            }>;
            joinUrl: z.ZodOptional<z.ZodString>;
            proposalId: z.ZodNullable<z.ZodString>;
            proposalEntityId: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>]>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
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
        IDEMPOTENCY_CONFLICT: {
            readonly status: 409;
            readonly message: "Idempotency key conflicts with an existing nomination";
        };
    }>>, Record<never, never>>;
    createXNomination: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        headers: z.ZodObject<{
            "idempotency-key": z.ZodString;
        }, z.core.$strip>;
        body: z.ZodObject<{
            source: z.ZodLiteral<"x">;
            sourceNominationId: z.ZodString;
            sourcePostUrl: z.ZodString;
            sourcePostText: z.ZodString;
            sourcePostCreatedAt: z.ZodNullable<z.ZodISODateTime>;
            nominatedByXId: z.ZodString;
            nominatedByXUsername: z.ZodString;
            nomineeXId: z.ZodString;
            nomineeXUsername: z.ZodString;
            conversationId: z.ZodNullable<z.ZodString>;
            replyToPostId: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodUnion<readonly [z.ZodObject<{
        status: z.ZodLiteral<200>;
        headers: z.ZodRecord<z.ZodString, z.ZodString>;
        body: z.ZodObject<{
            nominationId: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        status: z.ZodLiteral<201>;
        headers: z.ZodRecord<z.ZodString, z.ZodString>;
        body: z.ZodObject<{
            nominationId: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip>]>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
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
        IDEMPOTENCY_CONFLICT: {
            readonly status: 409;
            readonly message: "Idempotency key conflicts with an existing nomination";
        };
    }>>, Record<never, never>>;
    claimTelegramNomination: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        nominationId: z.ZodOptional<z.ZodString>;
        nomineeTelegramId: z.ZodNumber;
        nomineeUsername: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        nominationId: z.ZodString;
        status: z.ZodEnum<{
            submitted: "submitted";
            awaiting_claim: "awaiting_claim";
            awaiting_profile: "awaiting_profile";
        }>;
        joinUrl: z.ZodOptional<z.ZodString>;
        proposalId: z.ZodNullable<z.ZodString>;
        proposalEntityId: z.ZodNullable<z.ZodString>;
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
        NOMINATION_NOT_FOUND: {
            readonly status: 404;
            readonly message: "Nomination not found";
        };
    }>>, Record<never, never>>;
    resolveTelegramNomination: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        token: z.ZodString;
    }, z.core.$strip>, z.ZodDiscriminatedUnion<[z.ZodObject<{
        nominationId: z.ZodString;
        source: z.ZodLiteral<"telegram">;
        status: z.ZodLiteral<"ready">;
    }, z.core.$strip>, z.ZodObject<{
        nominationId: z.ZodString;
        source: z.ZodLiteral<"telegram">;
        status: z.ZodLiteral<"submitted">;
    }, z.core.$strip>, z.ZodObject<{
        status: z.ZodLiteral<"invalid">;
    }, z.core.$strip>], "status">, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
    resolveNomination: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        token: z.ZodString;
        recordOpen: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodDiscriminatedUnion<[z.ZodObject<{
        status: z.ZodLiteral<"ready">;
        nominationId: z.ZodString;
        referralNominationId: z.ZodString;
        source: z.ZodEnum<{
            telegram: "telegram";
            x: "x";
        }>;
        referralContext: z.ZodOptional<z.ZodObject<{
            sourcePostId: z.ZodString;
            sourcePostUrl: z.ZodString;
            sourcePostText: z.ZodString;
            sourcePostCreatedAt: z.ZodNullable<z.ZodISODateTime>;
            conversationId: z.ZodNullable<z.ZodString>;
            replyToPostId: z.ZodNullable<z.ZodString>;
            nominatorXId: z.ZodString;
            nominatorXUsername: z.ZodString;
            nomineeXId: z.ZodString;
            nomineeXUsername: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        status: z.ZodLiteral<"submitted">;
        nominationId: z.ZodString;
        referralNominationId: z.ZodString;
        source: z.ZodEnum<{
            telegram: "telegram";
            x: "x";
        }>;
        referralContext: z.ZodOptional<z.ZodObject<{
            sourcePostId: z.ZodString;
            sourcePostUrl: z.ZodString;
            sourcePostText: z.ZodString;
            sourcePostCreatedAt: z.ZodNullable<z.ZodISODateTime>;
            conversationId: z.ZodNullable<z.ZodString>;
            replyToPostId: z.ZodNullable<z.ZodString>;
            nominatorXId: z.ZodString;
            nominatorXUsername: z.ZodString;
            nomineeXId: z.ZodString;
            nomineeXUsername: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        status: z.ZodLiteral<"invalid">;
    }, z.core.$strip>], "status">, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
    finalizeTelegramNomination: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        token: z.ZodString;
        proposalId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        nominationId: z.ZodString;
        source: z.ZodLiteral<"telegram">;
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
        INVALID_NOMINATION: {
            readonly status: 404;
            readonly message: "Nomination link is invalid";
        };
        NOMINATION_CONFLICT: {
            readonly status: 409;
            readonly message: "Nomination was submitted by another builder";
        };
    }>>, Record<never, never>>;
    finalizeNomination: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        token: z.ZodString;
        proposalId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        nominationId: z.ZodString;
        referralNominationId: z.ZodString;
        source: z.ZodEnum<{
            telegram: "telegram";
            x: "x";
        }>;
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
        INVALID_NOMINATION: {
            readonly status: 404;
            readonly message: "Nomination link is invalid";
        };
        NOMINATION_CONFLICT: {
            readonly status: 409;
            readonly message: "Nomination was submitted by another builder";
        };
    }>>, Record<never, never>>;
    listXNominationQueue: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        status: z.ZodOptional<z.ZodEnum<{
            pending_contact: "pending_contact";
            contacted: "contacted";
            rejected: "rejected";
            completed: "completed";
        }>>;
        search: z.ZodOptional<z.ZodString>;
        limit: z.ZodOptional<z.ZodNumber>;
        cursor: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            canonicalNominationId: z.ZodString;
            isCanonical: z.ZodBoolean;
            sourcePostId: z.ZodString;
            sourcePostUrl: z.ZodString;
            sourcePostText: z.ZodString;
            sourcePostCreatedAt: z.ZodNullable<z.ZodISODateTime>;
            conversationId: z.ZodNullable<z.ZodString>;
            replyToPostId: z.ZodNullable<z.ZodString>;
            nominatorXId: z.ZodString;
            nominatorXUsername: z.ZodString;
            nomineeXId: z.ZodString;
            nomineeXUsername: z.ZodString;
            linkedNomineeBuilderId: z.ZodNullable<z.ZodString>;
            linkedNomineeNearAccount: z.ZodNullable<z.ZodString>;
            linkedNominatorBuilderId: z.ZodNullable<z.ZodString>;
            linkedNominatorNearAccount: z.ZodNullable<z.ZodString>;
            canonicalSourcePostId: z.ZodString;
            sourceReferralCount: z.ZodNumber;
            joinUrl: z.ZodNullable<z.ZodString>;
            engagementStatus: z.ZodEnum<{
                pending_contact: "pending_contact";
                contacted: "contacted";
                rejected: "rejected";
                completed: "completed";
            }>;
            replyUrl: z.ZodNullable<z.ZodString>;
            contactedAt: z.ZodNullable<z.ZodISODateTime>;
            rejectedAt: z.ZodNullable<z.ZodISODateTime>;
            completedAt: z.ZodNullable<z.ZodISODateTime>;
            engagementUpdatedAt: z.ZodISODateTime;
            updatedBy: z.ZodNullable<z.ZodString>;
            firstOpenedAt: z.ZodNullable<z.ZodISODateTime>;
            lastOpenedAt: z.ZodNullable<z.ZodISODateTime>;
            openCount: z.ZodNumber;
            proposalId: z.ZodNullable<z.ZodString>;
            submittedNearAccount: z.ZodNullable<z.ZodString>;
            submittedAt: z.ZodNullable<z.ZodISODateTime>;
            profileStatus: z.ZodEnum<{
                submitted: "submitted";
                not_started: "not_started";
            }>;
            createdAt: z.ZodISODateTime;
        }, z.core.$strip>>;
        meta: z.ZodObject<{
            total: z.ZodNumber;
            hasMore: z.ZodBoolean;
            nextCursor: z.ZodNullable<z.ZodString>;
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
    }>>, Record<never, never>>;
    updateXNomination: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        nominationId: z.ZodString;
        expectedEngagementUpdatedAt: z.ZodISODateTime;
        action: z.ZodEnum<{
            mark_contacted: "mark_contacted";
            reject: "reject";
            reopen: "reopen";
        }>;
        replyUrl: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        canonicalNominationId: z.ZodString;
        isCanonical: z.ZodBoolean;
        sourcePostId: z.ZodString;
        sourcePostUrl: z.ZodString;
        sourcePostText: z.ZodString;
        sourcePostCreatedAt: z.ZodNullable<z.ZodISODateTime>;
        conversationId: z.ZodNullable<z.ZodString>;
        replyToPostId: z.ZodNullable<z.ZodString>;
        nominatorXId: z.ZodString;
        nominatorXUsername: z.ZodString;
        nomineeXId: z.ZodString;
        nomineeXUsername: z.ZodString;
        linkedNomineeBuilderId: z.ZodNullable<z.ZodString>;
        linkedNomineeNearAccount: z.ZodNullable<z.ZodString>;
        linkedNominatorBuilderId: z.ZodNullable<z.ZodString>;
        linkedNominatorNearAccount: z.ZodNullable<z.ZodString>;
        canonicalSourcePostId: z.ZodString;
        sourceReferralCount: z.ZodNumber;
        joinUrl: z.ZodNullable<z.ZodString>;
        engagementStatus: z.ZodEnum<{
            pending_contact: "pending_contact";
            contacted: "contacted";
            rejected: "rejected";
            completed: "completed";
        }>;
        replyUrl: z.ZodNullable<z.ZodString>;
        contactedAt: z.ZodNullable<z.ZodISODateTime>;
        rejectedAt: z.ZodNullable<z.ZodISODateTime>;
        completedAt: z.ZodNullable<z.ZodISODateTime>;
        engagementUpdatedAt: z.ZodISODateTime;
        updatedBy: z.ZodNullable<z.ZodString>;
        firstOpenedAt: z.ZodNullable<z.ZodISODateTime>;
        lastOpenedAt: z.ZodNullable<z.ZodISODateTime>;
        openCount: z.ZodNumber;
        proposalId: z.ZodNullable<z.ZodString>;
        submittedNearAccount: z.ZodNullable<z.ZodString>;
        submittedAt: z.ZodNullable<z.ZodISODateTime>;
        profileStatus: z.ZodEnum<{
            submitted: "submitted";
            not_started: "not_started";
        }>;
        createdAt: z.ZodISODateTime;
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
        NOMINATION_CONFLICT: {
            readonly status: 409;
            readonly message: "Nomination was submitted by another builder";
        };
    }>>, Record<never, never>>;
    getXNominationMetrics: import("@orpc/contract").ContractProcedure<z.ZodObject<{}, z.core.$strip>, z.ZodObject<{
        totalNominations: z.ZodNumber;
        uniqueNominees: z.ZodNumber;
        pendingReviewCount: z.ZodNumber;
        humanReviewedContacts: z.ZodNumber;
        qualifiedEngagementReplies: z.ZodNumber;
        secureLinkOpens: z.ZodNumber;
        profilesSubmitted: z.ZodNumber;
        registrationConversionRate: z.ZodNumber;
        byNominator: z.ZodArray<z.ZodObject<{
            xId: z.ZodString;
            username: z.ZodString;
            nominations: z.ZodNumber;
            qualifiedReplies: z.ZodNumber;
            profilesSubmitted: z.ZodNumber;
        }, z.core.$strip>>;
        bySourcePost: z.ZodArray<z.ZodObject<{
            postId: z.ZodString;
            postUrl: z.ZodString;
            opens: z.ZodNumber;
            profileSubmitted: z.ZodBoolean;
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
    }>>, Record<never, never>>;
    listBuilders: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        search: z.ZodOptional<z.ZodString>;
        skill: z.ZodOptional<z.ZodString>;
        limit: z.ZodOptional<z.ZodNumber>;
        cursor: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            nearAccount: z.ZodString;
            userId: z.ZodNullable<z.ZodString>;
            name: z.ZodNullable<z.ZodString>;
            bio: z.ZodNullable<z.ZodString>;
            skills: z.ZodArray<z.ZodString>;
            location: z.ZodNullable<z.ZodString>;
            links: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>;
            hiddenAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            purgeRequestedAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
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
    getBuilder: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        nearAccount: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            nearAccount: z.ZodString;
            userId: z.ZodNullable<z.ZodString>;
            name: z.ZodNullable<z.ZodString>;
            bio: z.ZodNullable<z.ZodString>;
            skills: z.ZodArray<z.ZodString>;
            location: z.ZodNullable<z.ZodString>;
            links: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>;
            hiddenAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            purgeRequestedAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            createdAt: z.ZodISODateTime;
            updatedAt: z.ZodISODateTime;
        }, z.core.$strip>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    getMyBuilderProfile: import("@orpc/contract").ContractProcedure<z.ZodObject<{}, z.core.$strip>, z.ZodObject<{
        data: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            nearAccount: z.ZodString;
            userId: z.ZodNullable<z.ZodString>;
            name: z.ZodNullable<z.ZodString>;
            bio: z.ZodNullable<z.ZodString>;
            skills: z.ZodArray<z.ZodString>;
            location: z.ZodNullable<z.ZodString>;
            links: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>;
            hiddenAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            purgeRequestedAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            createdAt: z.ZodISODateTime;
            updatedAt: z.ZodISODateTime;
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
    }>>, Record<never, never>>;
    createBuilder: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        nearAccount: z.ZodString;
        userId: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
        bio: z.ZodOptional<z.ZodString>;
        skills: z.ZodOptional<z.ZodArray<z.ZodString>>;
        location: z.ZodOptional<z.ZodString>;
        links: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            nearAccount: z.ZodString;
            userId: z.ZodNullable<z.ZodString>;
            name: z.ZodNullable<z.ZodString>;
            bio: z.ZodNullable<z.ZodString>;
            skills: z.ZodArray<z.ZodString>;
            location: z.ZodNullable<z.ZodString>;
            links: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>;
            hiddenAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            purgeRequestedAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
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
    updateBuilderProfile: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        nearAccount: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        bio: z.ZodOptional<z.ZodString>;
        skills: z.ZodOptional<z.ZodArray<z.ZodString>>;
        location: z.ZodOptional<z.ZodString>;
        links: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            nearAccount: z.ZodString;
            userId: z.ZodNullable<z.ZodString>;
            name: z.ZodNullable<z.ZodString>;
            bio: z.ZodNullable<z.ZodString>;
            skills: z.ZodArray<z.ZodString>;
            location: z.ZodNullable<z.ZodString>;
            links: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>;
            hiddenAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            purgeRequestedAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
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
    deleteBuilder: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        nearAccount: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        deleted: z.ZodBoolean;
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
    withdrawNomination: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        nearAccount: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        withdrawn: z.ZodBoolean;
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
    }>>, Record<never, never>>;
    hideMyBuilderProfile: import("@orpc/contract").ContractProcedure<z.ZodObject<{}, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            nearAccount: z.ZodString;
            userId: z.ZodNullable<z.ZodString>;
            name: z.ZodNullable<z.ZodString>;
            bio: z.ZodNullable<z.ZodString>;
            skills: z.ZodArray<z.ZodString>;
            location: z.ZodNullable<z.ZodString>;
            links: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>;
            hiddenAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            purgeRequestedAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
            createdAt: z.ZodISODateTime;
            updatedAt: z.ZodISODateTime;
        }, z.core.$strip>;
        purgeRequested: z.ZodBoolean;
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
