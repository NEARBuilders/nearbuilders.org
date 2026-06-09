import { z } from "every-plugin/zod";
export declare const contract: {
    listProjects: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        organizationId: z.ZodOptional<z.ZodString>;
        ownerId: z.ZodOptional<z.ZodString>;
        kind: z.ZodOptional<z.ZodEnum<{
            project: "project";
            idea: "idea";
        }>>;
        visibility: z.ZodOptional<z.ZodEnum<{
            private: "private";
            unlisted: "unlisted";
            public: "public";
        }>>;
        status: z.ZodOptional<z.ZodEnum<{
            active: "active";
            paused: "paused";
            archived: "archived";
        }>>;
        limit: z.ZodOptional<z.ZodNumber>;
        cursor: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            ownerId: z.ZodString;
            organizationId: z.ZodNullable<z.ZodString>;
            kind: z.ZodEnum<{
                project: "project";
                idea: "idea";
            }>;
            slug: z.ZodString;
            title: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            content: z.ZodNullable<z.ZodString>;
            status: z.ZodEnum<{
                active: "active";
                paused: "paused";
                archived: "archived";
            }>;
            visibility: z.ZodEnum<{
                private: "private";
                unlisted: "unlisted";
                public: "public";
            }>;
            repository: z.ZodNullable<z.ZodString>;
            domain: z.ZodNullable<z.ZodString>;
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
    getProject: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodObject<{
            id: z.ZodString;
            ownerId: z.ZodString;
            organizationId: z.ZodNullable<z.ZodString>;
            kind: z.ZodEnum<{
                project: "project";
                idea: "idea";
            }>;
            slug: z.ZodString;
            title: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            content: z.ZodNullable<z.ZodString>;
            status: z.ZodEnum<{
                active: "active";
                paused: "paused";
                archived: "archived";
            }>;
            visibility: z.ZodEnum<{
                private: "private";
                unlisted: "unlisted";
                public: "public";
            }>;
            repository: z.ZodNullable<z.ZodString>;
            domain: z.ZodNullable<z.ZodString>;
            createdAt: z.ZodISODateTime;
            updatedAt: z.ZodISODateTime;
            apps: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                projectId: z.ZodString;
                accountId: z.ZodString;
                domain: z.ZodString;
                createdByUserId: z.ZodString;
                createdAt: z.ZodISODateTime;
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
    createProject: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        kind: z.ZodEnum<{
            project: "project";
            idea: "idea";
        }>;
        title: z.ZodString;
        slug: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        content: z.ZodOptional<z.ZodString>;
        visibility: z.ZodOptional<z.ZodEnum<{
            private: "private";
            unlisted: "unlisted";
            public: "public";
        }>>;
        repository: z.ZodOptional<z.ZodString>;
        organizationId: z.ZodOptional<z.ZodString>;
        ownerId: z.ZodOptional<z.ZodString>;
        domain: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        ownerId: z.ZodString;
        organizationId: z.ZodNullable<z.ZodString>;
        kind: z.ZodEnum<{
            project: "project";
            idea: "idea";
        }>;
        slug: z.ZodString;
        title: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        content: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            active: "active";
            paused: "paused";
            archived: "archived";
        }>;
        visibility: z.ZodEnum<{
            private: "private";
            unlisted: "unlisted";
            public: "public";
        }>;
        repository: z.ZodNullable<z.ZodString>;
        domain: z.ZodNullable<z.ZodString>;
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
    updateProject: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodOptional<z.ZodEnum<{
            project: "project";
            idea: "idea";
        }>>;
        title: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        content: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodEnum<{
            active: "active";
            paused: "paused";
            archived: "archived";
        }>>;
        visibility: z.ZodOptional<z.ZodEnum<{
            private: "private";
            unlisted: "unlisted";
            public: "public";
        }>>;
        repository: z.ZodOptional<z.ZodString>;
        ownerId: z.ZodOptional<z.ZodString>;
        domain: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        ownerId: z.ZodString;
        organizationId: z.ZodNullable<z.ZodString>;
        kind: z.ZodEnum<{
            project: "project";
            idea: "idea";
        }>;
        slug: z.ZodString;
        title: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        content: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            active: "active";
            paused: "paused";
            archived: "archived";
        }>;
        visibility: z.ZodEnum<{
            private: "private";
            unlisted: "unlisted";
            public: "public";
        }>;
        repository: z.ZodNullable<z.ZodString>;
        domain: z.ZodNullable<z.ZodString>;
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
    deleteProject: import("@orpc/contract").ContractProcedure<z.ZodObject<{
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
    listProjectApps: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        projectId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            projectId: z.ZodString;
            accountId: z.ZodString;
            domain: z.ZodString;
            createdByUserId: z.ZodString;
            createdAt: z.ZodISODateTime;
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
    linkAppToProject: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        projectId: z.ZodString;
        accountId: z.ZodString;
        domain: z.ZodString;
    }, z.core.$strip>, import("@orpc/contract").Schema<unknown, unknown>, import("@orpc/contract").MergedErrorMap<Record<never, never>, import("@orpc/contract").MergedErrorMap<Record<never, never>, {
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
    unlinkAppFromProject: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        projectId: z.ZodString;
        accountId: z.ZodString;
        domain: z.ZodString;
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
    listProjectsForApp: import("@orpc/contract").ContractProcedure<z.ZodObject<{
        accountId: z.ZodString;
        domain: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        data: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            ownerId: z.ZodString;
            organizationId: z.ZodNullable<z.ZodString>;
            kind: z.ZodEnum<{
                project: "project";
                idea: "idea";
            }>;
            slug: z.ZodString;
            title: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            content: z.ZodNullable<z.ZodString>;
            status: z.ZodEnum<{
                active: "active";
                paused: "paused";
                archived: "archived";
            }>;
            visibility: z.ZodEnum<{
                private: "private";
                unlisted: "unlisted";
                public: "public";
            }>;
            repository: z.ZodNullable<z.ZodString>;
            domain: z.ZodNullable<z.ZodString>;
            createdAt: z.ZodISODateTime;
            updatedAt: z.ZodISODateTime;
        }, z.core.$strip>>;
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
