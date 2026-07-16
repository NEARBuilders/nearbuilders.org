import { z } from "every-plugin/zod";
export declare const contract: {
    listLumaCalendars: import("@orpc/contract").ContractProcedure<import("@orpc/contract").Schema<unknown, unknown>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            slug: z.ZodNullable<z.ZodString>;
            url: z.ZodString;
            avatarUrl: z.ZodNullable<z.ZodString>;
            coverImageUrl: z.ZodNullable<z.ZodString>;
            description: z.ZodNullable<z.ZodString>;
            timezone: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>>;
        unavailableCount: z.ZodNumber;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, Record<never, never>>, Record<never, never>>;
    listLumaEvents: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        after: z.ZodOptional<z.ZodISODateTime>;
        before: z.ZodOptional<z.ZodISODateTime>;
        cursor: z.ZodOptional<z.ZodString>;
        limitPerCalendar: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            calendarId: z.ZodString;
            platform: z.ZodEnum<{
                luma: "luma";
                external: "external";
            }>;
            title: z.ZodString;
            url: z.ZodString;
            coverUrl: z.ZodNullable<z.ZodString>;
            startAt: z.ZodISODateTime;
            endAt: z.ZodNullable<z.ZodISODateTime>;
            timezone: z.ZodString;
            location: z.ZodNullable<z.ZodString>;
            locationType: z.ZodNullable<z.ZodString>;
            visibility: z.ZodEnum<{
                private: "private";
                public: "public";
                "members-only": "members-only";
            }>;
            access: z.ZodNullable<z.ZodEnum<{
                manage: "manage";
                view: "view";
            }>>;
        }, z.core.$strip>>;
        meta: z.ZodObject<{
            hasMore: z.ZodBoolean;
            nextCursor: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
        unavailableCalendarIds: z.ZodArray<z.ZodString>;
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
    getLumaEvent: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        calendarId: z.ZodString;
        eventId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            calendarId: z.ZodString;
            platform: z.ZodEnum<{
                luma: "luma";
                external: "external";
            }>;
            title: z.ZodString;
            url: z.ZodString;
            coverUrl: z.ZodNullable<z.ZodString>;
            startAt: z.ZodISODateTime;
            endAt: z.ZodNullable<z.ZodISODateTime>;
            timezone: z.ZodString;
            location: z.ZodNullable<z.ZodString>;
            locationType: z.ZodNullable<z.ZodString>;
            visibility: z.ZodEnum<{
                private: "private";
                public: "public";
                "members-only": "members-only";
            }>;
            access: z.ZodNullable<z.ZodEnum<{
                manage: "manage";
                view: "view";
            }>>;
            description: z.ZodNullable<z.ZodString>;
            descriptionMarkdown: z.ZodNullable<z.ZodString>;
            hosts: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                name: z.ZodString;
                avatarUrl: z.ZodNullable<z.ZodString>;
            }, z.core.$strip>>;
            guestCount: z.ZodNumber;
            registrationOpen: z.ZodBoolean;
            spotsRemaining: z.ZodNullable<z.ZodNumber>;
            requireApproval: z.ZodBoolean;
            waitlistEnabled: z.ZodBoolean;
            displayPrice: z.ZodNullable<z.ZodObject<{
                amount: z.ZodNumber;
                currency: z.ZodString;
                isFlexible: z.ZodBoolean;
            }, z.core.$strip>>;
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
    listEvents: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        ownerId: z.ZodOptional<z.ZodString>;
        visibility: z.ZodOptional<z.ZodEnum<{
            private: "private";
            unlisted: "unlisted";
            public: "public";
        }>>;
        status: z.ZodOptional<z.ZodEnum<{
            active: "active";
            cancelled: "cancelled";
        }>>;
        limit: z.ZodOptional<z.ZodNumber>;
        cursor: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            ownerId: z.ZodString;
            slug: z.ZodString;
            title: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            content: z.ZodNullable<z.ZodString>;
            status: z.ZodEnum<{
                active: "active";
                cancelled: "cancelled";
            }>;
            visibility: z.ZodEnum<{
                private: "private";
                unlisted: "unlisted";
                public: "public";
            }>;
            lumaUrl: z.ZodNullable<z.ZodString>;
            startAt: z.ZodISODateTime;
            endAt: z.ZodNullable<z.ZodISODateTime>;
            location: z.ZodNullable<z.ZodString>;
            participantCount: z.ZodNumber;
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
    getEvent: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            ownerId: z.ZodString;
            slug: z.ZodString;
            title: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            content: z.ZodNullable<z.ZodString>;
            status: z.ZodEnum<{
                active: "active";
                cancelled: "cancelled";
            }>;
            visibility: z.ZodEnum<{
                private: "private";
                unlisted: "unlisted";
                public: "public";
            }>;
            lumaUrl: z.ZodNullable<z.ZodString>;
            startAt: z.ZodISODateTime;
            endAt: z.ZodNullable<z.ZodISODateTime>;
            location: z.ZodNullable<z.ZodString>;
            participantCount: z.ZodNumber;
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
    getEventBySlug: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        slug: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            ownerId: z.ZodString;
            slug: z.ZodString;
            title: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            content: z.ZodNullable<z.ZodString>;
            status: z.ZodEnum<{
                active: "active";
                cancelled: "cancelled";
            }>;
            visibility: z.ZodEnum<{
                private: "private";
                unlisted: "unlisted";
                public: "public";
            }>;
            lumaUrl: z.ZodNullable<z.ZodString>;
            startAt: z.ZodISODateTime;
            endAt: z.ZodNullable<z.ZodISODateTime>;
            location: z.ZodNullable<z.ZodString>;
            participantCount: z.ZodNumber;
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
    listEventParticipants: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        eventId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            eventId: z.ZodString;
            userId: z.ZodString;
            walletAddress: z.ZodNullable<z.ZodString>;
            displayName: z.ZodNullable<z.ZodString>;
            role: z.ZodEnum<{
                participant: "participant";
                organizer: "organizer";
            }>;
            createdAt: z.ZodISODateTime;
            updatedAt: z.ZodISODateTime;
        }, z.core.$strip>>;
    }, z.core.$strip>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    joinEvent: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        eventId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            eventId: z.ZodString;
            userId: z.ZodString;
            walletAddress: z.ZodNullable<z.ZodString>;
            displayName: z.ZodNullable<z.ZodString>;
            role: z.ZodEnum<{
                participant: "participant";
                organizer: "organizer";
            }>;
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
    leaveEvent: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        eventId: z.ZodString;
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
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>>, Record<never, never>>;
    createEvent: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        title: z.ZodString;
        slug: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        content: z.ZodOptional<z.ZodString>;
        visibility: z.ZodOptional<z.ZodEnum<{
            private: "private";
            unlisted: "unlisted";
            public: "public";
        }>>;
        status: z.ZodOptional<z.ZodEnum<{
            active: "active";
            cancelled: "cancelled";
        }>>;
        lumaUrl: z.ZodOptional<z.ZodString>;
        startAt: z.ZodISODateTime;
        endAt: z.ZodOptional<z.ZodISODateTime>;
        location: z.ZodOptional<z.ZodString>;
        ownerId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        ownerId: z.ZodString;
        slug: z.ZodString;
        title: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        content: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            active: "active";
            cancelled: "cancelled";
        }>;
        visibility: z.ZodEnum<{
            private: "private";
            unlisted: "unlisted";
            public: "public";
        }>;
        lumaUrl: z.ZodNullable<z.ZodString>;
        startAt: z.ZodISODateTime;
        endAt: z.ZodNullable<z.ZodISODateTime>;
        location: z.ZodNullable<z.ZodString>;
        participantCount: z.ZodNumber;
        createdAt: z.ZodISODateTime;
        updatedAt: z.ZodISODateTime;
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
    updateEvent: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        content: z.ZodOptional<z.ZodString>;
        visibility: z.ZodOptional<z.ZodEnum<{
            private: "private";
            unlisted: "unlisted";
            public: "public";
        }>>;
        status: z.ZodOptional<z.ZodEnum<{
            active: "active";
            cancelled: "cancelled";
        }>>;
        lumaUrl: z.ZodOptional<z.ZodString>;
        startAt: z.ZodOptional<z.ZodISODateTime>;
        endAt: z.ZodOptional<z.ZodISODateTime>;
        location: z.ZodOptional<z.ZodString>;
        ownerId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        ownerId: z.ZodString;
        slug: z.ZodString;
        title: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        content: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            active: "active";
            cancelled: "cancelled";
        }>;
        visibility: z.ZodEnum<{
            private: "private";
            unlisted: "unlisted";
            public: "public";
        }>;
        lumaUrl: z.ZodNullable<z.ZodString>;
        startAt: z.ZodISODateTime;
        endAt: z.ZodNullable<z.ZodISODateTime>;
        location: z.ZodNullable<z.ZodString>;
        participantCount: z.ZodNumber;
        createdAt: z.ZodISODateTime;
        updatedAt: z.ZodISODateTime;
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
    deleteEvent: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
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
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
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
};
export type ContractType = typeof contract;
