import "@orpc/openapi/extensions/route";
import { z } from "zod";
export declare const contract: {
    listLumaCalendars: import("@orpc/contract").ProcedureContract<import("@orpc/contract").InitialInputSchema, z.ZodObject<{
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
    }, z.core.$strip>, object>;
    listLumaEvents: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        after: z.ZodOptional<z.ZodISODateTime>;
        before: z.ZodOptional<z.ZodISODateTime>;
        cursor: z.ZodOptional<z.ZodString>;
        limitPerCalendar: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            calendarId: z.ZodString;
            platform: z.ZodEnum<{
                external: "external";
                luma: "luma";
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
                "members-only": "members-only";
                private: "private";
                public: "public";
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
    getLumaEvent: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        calendarId: z.ZodString;
        eventId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            calendarId: z.ZodString;
            platform: z.ZodEnum<{
                external: "external";
                luma: "luma";
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
                "members-only": "members-only";
                private: "private";
                public: "public";
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
    }, z.core.$strip>, {
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    listEvents: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        ownerId: z.ZodOptional<z.ZodString>;
        visibility: z.ZodOptional<z.ZodEnum<{
            private: "private";
            public: "public";
            unlisted: "unlisted";
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
                public: "public";
                unlisted: "unlisted";
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
    getEvent: import("@orpc/contract").ProcedureContract<z.ZodObject<{
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
                public: "public";
                unlisted: "unlisted";
            }>;
            lumaUrl: z.ZodNullable<z.ZodString>;
            startAt: z.ZodISODateTime;
            endAt: z.ZodNullable<z.ZodISODateTime>;
            location: z.ZodNullable<z.ZodString>;
            participantCount: z.ZodNumber;
            createdAt: z.ZodISODateTime;
            updatedAt: z.ZodISODateTime;
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
    getEventBySlug: import("@orpc/contract").ProcedureContract<z.ZodObject<{
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
                public: "public";
                unlisted: "unlisted";
            }>;
            lumaUrl: z.ZodNullable<z.ZodString>;
            startAt: z.ZodISODateTime;
            endAt: z.ZodNullable<z.ZodISODateTime>;
            location: z.ZodNullable<z.ZodString>;
            participantCount: z.ZodNumber;
            createdAt: z.ZodISODateTime;
            updatedAt: z.ZodISODateTime;
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
    listEventParticipants: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        eventId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            eventId: z.ZodString;
            userId: z.ZodString;
            walletAddress: z.ZodNullable<z.ZodString>;
            displayName: z.ZodNullable<z.ZodString>;
            role: z.ZodEnum<{
                organizer: "organizer";
                participant: "participant";
            }>;
            createdAt: z.ZodISODateTime;
            updatedAt: z.ZodISODateTime;
        }, z.core.$strip>>;
    }, z.core.$strip>, {
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    joinEvent: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        eventId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            eventId: z.ZodString;
            userId: z.ZodString;
            walletAddress: z.ZodNullable<z.ZodString>;
            displayName: z.ZodNullable<z.ZodString>;
            role: z.ZodEnum<{
                organizer: "organizer";
                participant: "participant";
            }>;
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
    leaveEvent: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        eventId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        deleted: z.ZodBoolean;
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
    createEvent: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        title: z.ZodString;
        slug: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        content: z.ZodOptional<z.ZodString>;
        visibility: z.ZodOptional<z.ZodEnum<{
            private: "private";
            public: "public";
            unlisted: "unlisted";
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
            public: "public";
            unlisted: "unlisted";
        }>;
        lumaUrl: z.ZodNullable<z.ZodString>;
        startAt: z.ZodISODateTime;
        endAt: z.ZodNullable<z.ZodISODateTime>;
        location: z.ZodNullable<z.ZodString>;
        participantCount: z.ZodNumber;
        createdAt: z.ZodISODateTime;
        updatedAt: z.ZodISODateTime;
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
    updateEvent: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        content: z.ZodOptional<z.ZodString>;
        visibility: z.ZodOptional<z.ZodEnum<{
            private: "private";
            public: "public";
            unlisted: "unlisted";
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
            public: "public";
            unlisted: "unlisted";
        }>;
        lumaUrl: z.ZodNullable<z.ZodString>;
        startAt: z.ZodISODateTime;
        endAt: z.ZodNullable<z.ZodISODateTime>;
        location: z.ZodNullable<z.ZodString>;
        participantCount: z.ZodNumber;
        createdAt: z.ZodISODateTime;
        updatedAt: z.ZodISODateTime;
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
    applyReviewedEvent: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        id: z.ZodString;
        ownerId: z.ZodString;
        title: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        content: z.ZodOptional<z.ZodString>;
        visibility: z.ZodOptional<z.ZodEnum<{
            private: "private";
            public: "public";
            unlisted: "unlisted";
        }>>;
        status: z.ZodOptional<z.ZodEnum<{
            active: "active";
            cancelled: "cancelled";
        }>>;
        lumaUrl: z.ZodOptional<z.ZodString>;
        startAt: z.ZodOptional<z.ZodISODateTime>;
        endAt: z.ZodOptional<z.ZodISODateTime>;
        location: z.ZodOptional<z.ZodString>;
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
            public: "public";
            unlisted: "unlisted";
        }>;
        lumaUrl: z.ZodNullable<z.ZodString>;
        startAt: z.ZodISODateTime;
        endAt: z.ZodNullable<z.ZodISODateTime>;
        location: z.ZodNullable<z.ZodString>;
        participantCount: z.ZodNumber;
        createdAt: z.ZodISODateTime;
        updatedAt: z.ZodISODateTime;
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
    deleteEvent: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        deleted: z.ZodBoolean;
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
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
};
export type ContractType = typeof contract;
