/**
 * Contract types for feedback.nearbuilders.org's public API, vendored from its
 * deployed plugin manifest (api/dist/types/contract.d.ts).
 * Manifest contract sha256: db2b098d8adba60715b1370ebc0461e943b51832dfa3869525f18a5a155196fc
 * Regenerate from the feedback.nearbuilders.org repo: `pnpm --filter api build:types`,
 * then replace this file. TODO(upstream): bos.app.ts rpc-mode entries generate this
 * automatically from the remote manifest (see NEARBuilders/everything-dev).
 */
import "@orpc/openapi/extensions/route";
import { z } from "zod";
export declare const RoundStatusSchema: z.ZodEnum<{
  closed: "closed";
  open: "open";
  pending: "pending";
  rejected: "rejected";
}>;
export declare const RoundFormatSchema: z.ZodEnum<{
  issues: "issues";
  recorded: "recorded";
  written: "written";
}>;
export declare const ProjectStatusSchema: z.ZodEnum<{
  approved: "approved";
  pending: "pending";
  rejected: "rejected";
}>;
export declare const ProjectSchema: z.ZodObject<
  {
    id: z.ZodString;
    slug: z.ZodString;
    name: z.ZodString;
    ownerOrgId: z.ZodNullable<z.ZodString>;
    managingTeamId: z.ZodNullable<z.ZodString>;
    nearbuildersProjectId: z.ZodNullable<z.ZodString>;
    contact: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
      approved: "approved";
      pending: "pending";
      rejected: "rejected";
    }>;
    approvedAt: z.ZodNullable<z.ZodString>;
    rejectedAt: z.ZodNullable<z.ZodString>;
    rejectionReason: z.ZodNullable<z.ZodString>;
    verifiedAt: z.ZodNullable<z.ZodString>;
    verifiedByAccountId: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
  },
  z.core.$strip
>;
export type Project = z.infer<typeof ProjectSchema>;
/**
 * Identity resolved from the nearbuilders.org registry, which owns it. Null
 * when the registry has no entry for the slug or is unreachable — this app
 * deliberately keeps no mirrored copy to drift out of date.
 */
export declare const ProjectIdentitySchema: z.ZodNullable<
  z.ZodObject<
    {
      title: z.ZodString;
      description: z.ZodNullable<z.ZodString>;
      domain: z.ZodNullable<z.ZodString>;
      repository: z.ZodNullable<z.ZodString>;
      logoUrl: z.ZodNullable<z.ZodString>;
      kind: z.ZodEnum<{
        idea: "idea";
        project: "project";
        result: "result";
        scope: "scope";
      }>;
    },
    z.core.$strip
  >
>;
export type ProjectIdentity = z.infer<typeof ProjectIdentitySchema>;
export declare const ProjectWithRoundsSchema: z.ZodObject<
  {
    id: z.ZodString;
    slug: z.ZodString;
    name: z.ZodString;
    ownerOrgId: z.ZodNullable<z.ZodString>;
    managingTeamId: z.ZodNullable<z.ZodString>;
    nearbuildersProjectId: z.ZodNullable<z.ZodString>;
    contact: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
      approved: "approved";
      pending: "pending";
      rejected: "rejected";
    }>;
    approvedAt: z.ZodNullable<z.ZodString>;
    rejectedAt: z.ZodNullable<z.ZodString>;
    rejectionReason: z.ZodNullable<z.ZodString>;
    verifiedAt: z.ZodNullable<z.ZodString>;
    verifiedByAccountId: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    identity: z.ZodNullable<
      z.ZodObject<
        {
          title: z.ZodString;
          description: z.ZodNullable<z.ZodString>;
          domain: z.ZodNullable<z.ZodString>;
          repository: z.ZodNullable<z.ZodString>;
          logoUrl: z.ZodNullable<z.ZodString>;
          kind: z.ZodEnum<{
            idea: "idea";
            project: "project";
            result: "result";
            scope: "scope";
          }>;
        },
        z.core.$strip
      >
    >;
    rounds: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          ownerAccountId: z.ZodString;
          title: z.ZodString;
          status: z.ZodEnum<{
            closed: "closed";
            open: "open";
            pending: "pending";
            rejected: "rejected";
          }>;
          projectRoundNumber: z.ZodNumber;
          endsAt: z.ZodNullable<z.ZodString>;
        },
        z.core.$strip
      >
    >;
  },
  z.core.$strip
>;
export type ProjectWithRounds = z.infer<typeof ProjectWithRoundsSchema>;
export declare const RoundSchema: z.ZodObject<
  {
    id: z.ZodString;
    ownerAccountId: z.ZodString;
    projectSlug: z.ZodString;
    projectRecordId: z.ZodString;
    projectRoundNumber: z.ZodNumber;
    title: z.ZodString;
    description: z.ZodString;
    readme: z.ZodString;
    bannerUrl: z.ZodNullable<z.ZodString>;
    formats: z.ZodArray<
      z.ZodEnum<{
        issues: "issues";
        recorded: "recorded";
        written: "written";
      }>
    >;
    repoUrl: z.ZodNullable<z.ZodString>;
    isPrivate: z.ZodBoolean;
    legionOnly: z.ZodBoolean;
    endsAt: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
      closed: "closed";
      open: "open";
      pending: "pending";
      rejected: "rejected";
    }>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    closedAt: z.ZodNullable<z.ZodString>;
    rejectedAt: z.ZodNullable<z.ZodString>;
    rejectionReason: z.ZodNullable<z.ZodString>;
  },
  z.core.$strip
>;
export type Round = z.infer<typeof RoundSchema>;
export declare const RoundDetailSchema: z.ZodObject<
  {
    id: z.ZodString;
    ownerAccountId: z.ZodString;
    projectSlug: z.ZodString;
    projectRecordId: z.ZodString;
    projectRoundNumber: z.ZodNumber;
    title: z.ZodString;
    description: z.ZodString;
    readme: z.ZodString;
    bannerUrl: z.ZodNullable<z.ZodString>;
    formats: z.ZodArray<
      z.ZodEnum<{
        issues: "issues";
        recorded: "recorded";
        written: "written";
      }>
    >;
    repoUrl: z.ZodNullable<z.ZodString>;
    isPrivate: z.ZodBoolean;
    legionOnly: z.ZodBoolean;
    endsAt: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
      closed: "closed";
      open: "open";
      pending: "pending";
      rejected: "rejected";
    }>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    closedAt: z.ZodNullable<z.ZodString>;
    rejectedAt: z.ZodNullable<z.ZodString>;
    rejectionReason: z.ZodNullable<z.ZodString>;
    identity: z.ZodNullable<
      z.ZodObject<
        {
          title: z.ZodString;
          description: z.ZodNullable<z.ZodString>;
          domain: z.ZodNullable<z.ZodString>;
          repository: z.ZodNullable<z.ZodString>;
          logoUrl: z.ZodNullable<z.ZodString>;
          kind: z.ZodEnum<{
            idea: "idea";
            project: "project";
            result: "result";
            scope: "scope";
          }>;
        },
        z.core.$strip
      >
    >;
    participantCount: z.ZodNumber;
    participantPreview: z.ZodOptional<z.ZodArray<z.ZodString>>;
    feedbackCount: z.ZodOptional<z.ZodNumber>;
    canManage: z.ZodOptional<z.ZodBoolean>;
    projectVerifiedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
  },
  z.core.$strip
>;
export type RoundDetail = z.infer<typeof RoundDetailSchema>;
export declare const RoundFeedbackFormatSchema: z.ZodEnum<{
  recorded: "recorded";
  written: "written";
}>;
export declare const RoundParticipantSchema: z.ZodObject<
  {
    accountId: z.ZodString;
    joinedAt: z.ZodString;
    feedbackCount: z.ZodNumber;
  },
  z.core.$strip
>;
export type RoundParticipant = z.infer<typeof RoundParticipantSchema>;
export declare const FeedbackAuthorSchema: z.ZodObject<
  {
    accountId: z.ZodString;
    telegramHandle: z.ZodNullable<z.ZodString>;
    feedbackCount: z.ZodNumber;
    unresolvedCount: z.ZodNumber;
    resolvedCount: z.ZodNumber;
    dismissedCount: z.ZodNumber;
    starredCount: z.ZodNumber;
    firstPostedAt: z.ZodString;
    lastPostedAt: z.ZodString;
  },
  z.core.$strip
>;
export type FeedbackAuthor = z.infer<typeof FeedbackAuthorSchema>;
export declare const RoundFeedbackStatusSchema: z.ZodEnum<{
  dismissed: "dismissed";
  resolved: "resolved";
  unresolved: "unresolved";
}>;
export type RoundFeedbackStatus = z.infer<typeof RoundFeedbackStatusSchema>;
export declare const RoundFeedbackSchema: z.ZodObject<
  {
    id: z.ZodString;
    roundId: z.ZodString;
    authorAccountId: z.ZodString;
    format: z.ZodEnum<{
      recorded: "recorded";
      written: "written";
    }>;
    body: z.ZodNullable<z.ZodString>;
    url: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
      dismissed: "dismissed";
      resolved: "resolved";
      unresolved: "unresolved";
    }>;
    starredAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodNullable<z.ZodString>;
    nostrEventId: z.ZodNullable<z.ZodString>;
  },
  z.core.$strip
>;
export type RoundFeedback = z.infer<typeof RoundFeedbackSchema>;
export declare const FeedbackNoteSchema: z.ZodObject<
  {
    id: z.ZodString;
    feedbackId: z.ZodString;
    authorAccountId: z.ZodString;
    role: z.ZodEnum<{
      owner: "owner";
      tester: "tester";
    }>;
    body: z.ZodString;
    createdAt: z.ZodString;
  },
  z.core.$strip
>;
export type FeedbackNote = z.infer<typeof FeedbackNoteSchema>;
export declare const FeedbackDetailSchema: z.ZodObject<
  {
    id: z.ZodString;
    roundId: z.ZodString;
    authorAccountId: z.ZodString;
    format: z.ZodEnum<{
      recorded: "recorded";
      written: "written";
    }>;
    body: z.ZodNullable<z.ZodString>;
    url: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
      dismissed: "dismissed";
      resolved: "resolved";
      unresolved: "unresolved";
    }>;
    starredAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodNullable<z.ZodString>;
    nostrEventId: z.ZodNullable<z.ZodString>;
    notes: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          feedbackId: z.ZodString;
          authorAccountId: z.ZodString;
          role: z.ZodEnum<{
            owner: "owner";
            tester: "tester";
          }>;
          body: z.ZodString;
          createdAt: z.ZodString;
        },
        z.core.$strip
      >
    >;
  },
  z.core.$strip
>;
export type FeedbackDetail = z.infer<typeof FeedbackDetailSchema>;
export declare const MyFeedbackSchema: z.ZodObject<
  {
    id: z.ZodString;
    roundId: z.ZodString;
    authorAccountId: z.ZodString;
    format: z.ZodEnum<{
      recorded: "recorded";
      written: "written";
    }>;
    body: z.ZodNullable<z.ZodString>;
    url: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
      dismissed: "dismissed";
      resolved: "resolved";
      unresolved: "unresolved";
    }>;
    starredAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodNullable<z.ZodString>;
    nostrEventId: z.ZodNullable<z.ZodString>;
    notes: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          feedbackId: z.ZodString;
          authorAccountId: z.ZodString;
          role: z.ZodEnum<{
            owner: "owner";
            tester: "tester";
          }>;
          body: z.ZodString;
          createdAt: z.ZodString;
        },
        z.core.$strip
      >
    >;
  },
  z.core.$strip
>;
export type MyFeedback = z.infer<typeof MyFeedbackSchema>;
export declare const FeedbackPageSchema: z.ZodObject<
  {
    items: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          roundId: z.ZodString;
          authorAccountId: z.ZodString;
          format: z.ZodEnum<{
            recorded: "recorded";
            written: "written";
          }>;
          body: z.ZodNullable<z.ZodString>;
          url: z.ZodNullable<z.ZodString>;
          status: z.ZodEnum<{
            dismissed: "dismissed";
            resolved: "resolved";
            unresolved: "unresolved";
          }>;
          starredAt: z.ZodNullable<z.ZodString>;
          createdAt: z.ZodString;
          updatedAt: z.ZodNullable<z.ZodString>;
          nostrEventId: z.ZodNullable<z.ZodString>;
        },
        z.core.$strip
      >
    >;
    nextCursor: z.ZodNullable<z.ZodString>;
  },
  z.core.$strip
>;
export type FeedbackPage = z.infer<typeof FeedbackPageSchema>;
export declare const RoundCreditSchema: z.ZodObject<
  {
    id: z.ZodString;
    roundId: z.ZodString;
    builderAccountId: z.ZodString;
    projectSlug: z.ZodString;
    roundTitle: z.ZodString;
    contributedMeaningfully: z.ZodBoolean;
    summary: z.ZodNullable<z.ZodString>;
    writtenCount: z.ZodNumber;
    recordedCount: z.ZodNumber;
    createdAt: z.ZodString;
  },
  z.core.$strip
>;
export type RoundCredit = z.infer<typeof RoundCreditSchema>;
export declare const NotificationKindSchema: z.ZodEnum<{
  custom: "custom";
  feedback_dismissed: "feedback_dismissed";
  feedback_resolved: "feedback_resolved";
  round_closed: "round_closed";
  round_closing: "round_closing";
  round_opened: "round_opened";
}>;
export type NotificationKind = z.infer<typeof NotificationKindSchema>;
export declare const NotificationSchema: z.ZodObject<
  {
    id: z.ZodString;
    roundId: z.ZodString;
    roundTitle: z.ZodString;
    projectSlug: z.ZodString;
    projectRoundNumber: z.ZodNumber;
    feedbackId: z.ZodNullable<z.ZodString>;
    kind: z.ZodEnum<{
      custom: "custom";
      feedback_dismissed: "feedback_dismissed";
      feedback_resolved: "feedback_resolved";
      round_closed: "round_closed";
      round_closing: "round_closing";
      round_opened: "round_opened";
    }>;
    title: z.ZodString;
    body: z.ZodString;
    readAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
  },
  z.core.$strip
>;
export type Notification = z.infer<typeof NotificationSchema>;
export declare const NotificationListSchema: z.ZodObject<
  {
    items: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          roundId: z.ZodString;
          roundTitle: z.ZodString;
          projectSlug: z.ZodString;
          projectRoundNumber: z.ZodNumber;
          feedbackId: z.ZodNullable<z.ZodString>;
          kind: z.ZodEnum<{
            custom: "custom";
            feedback_dismissed: "feedback_dismissed";
            feedback_resolved: "feedback_resolved";
            round_closed: "round_closed";
            round_closing: "round_closing";
            round_opened: "round_opened";
          }>;
          title: z.ZodString;
          body: z.ZodString;
          readAt: z.ZodNullable<z.ZodString>;
          createdAt: z.ZodString;
        },
        z.core.$strip
      >
    >;
    unreadCount: z.ZodNumber;
  },
  z.core.$strip
>;
export type NotificationList = z.infer<typeof NotificationListSchema>;
export declare const BroadcastKindSchema: z.ZodEnum<{
  custom: "custom";
  round_closing: "round_closing";
  round_opened: "round_opened";
}>;
export type BroadcastKind = z.infer<typeof BroadcastKindSchema>;
export declare const GithubIssueSchema: z.ZodObject<
  {
    number: z.ZodNumber;
    title: z.ZodString;
    url: z.ZodString;
    createdAt: z.ZodString;
  },
  z.core.$strip
>;
export declare const GithubIssueContributorSchema: z.ZodObject<
  {
    login: z.ZodString;
    issues: z.ZodArray<
      z.ZodObject<
        {
          number: z.ZodNumber;
          title: z.ZodString;
          url: z.ZodString;
          createdAt: z.ZodString;
        },
        z.core.$strip
      >
    >;
  },
  z.core.$strip
>;
export type GithubIssueContributor = z.infer<typeof GithubIssueContributorSchema>;
export declare const RoundGithubIssuesSchema: z.ZodObject<
  {
    repoUrl: z.ZodString;
    windowStart: z.ZodString;
    windowEnd: z.ZodNullable<z.ZodString>;
    contributors: z.ZodArray<
      z.ZodObject<
        {
          login: z.ZodString;
          issues: z.ZodArray<
            z.ZodObject<
              {
                number: z.ZodNumber;
                title: z.ZodString;
                url: z.ZodString;
                createdAt: z.ZodString;
              },
              z.core.$strip
            >
          >;
        },
        z.core.$strip
      >
    >;
  },
  z.core.$strip
>;
export type RoundGithubIssues = z.infer<typeof RoundGithubIssuesSchema>;
export declare const BuilderRoundSchema: z.ZodObject<
  {
    roundId: z.ZodString;
    roundTitle: z.ZodString;
    projectSlug: z.ZodString;
    repoUrl: z.ZodNullable<z.ZodString>;
    issuesUrl: z.ZodNullable<z.ZodString>;
    contributedMeaningfully: z.ZodBoolean;
    summary: z.ZodNullable<z.ZodString>;
    writtenCount: z.ZodNumber;
    recordedCount: z.ZodNumber;
    closedAt: z.ZodString;
    creditedAt: z.ZodString;
  },
  z.core.$strip
>;
export type BuilderRound = z.infer<typeof BuilderRoundSchema>;
export declare const MyJoinedRoundSchema: z.ZodObject<
  {
    roundId: z.ZodString;
    roundTitle: z.ZodString;
    projectSlug: z.ZodString;
    projectRoundNumber: z.ZodNumber;
    status: z.ZodEnum<{
      closed: "closed";
      open: "open";
      pending: "pending";
      rejected: "rejected";
    }>;
    endsAt: z.ZodNullable<z.ZodString>;
    formats: z.ZodArray<
      z.ZodEnum<{
        issues: "issues";
        recorded: "recorded";
        written: "written";
      }>
    >;
    readme: z.ZodString;
    repoUrl: z.ZodNullable<z.ZodString>;
    participantCount: z.ZodNumber;
    myFeedbackCount: z.ZodNumber;
    joinedAt: z.ZodString;
  },
  z.core.$strip
>;
/** Counts for the owner's home-page overview; nothing here is scoped to one round. */
export declare const OwnerSummarySchema: z.ZodObject<
  {
    openRounds: z.ZodNumber;
    unresolvedFeedback: z.ZodNumber;
    pendingProjects: z.ZodNumber;
  },
  z.core.$strip
>;
export type OwnerSummary = z.infer<typeof OwnerSummarySchema>;
export type MyJoinedRound = z.infer<typeof MyJoinedRoundSchema>;
export declare const CreditCandidateSchema: z.ZodObject<
  {
    accountId: z.ZodString;
    writtenCount: z.ZodNumber;
    recordedCount: z.ZodNumber;
  },
  z.core.$strip
>;
export declare const LeaderboardPeriodSchema: z.ZodEnum<{
  "all-time": "all-time";
  monthly: "monthly";
  weekly: "weekly";
}>;
export declare const LeaderboardEntrySchema: z.ZodObject<
  {
    rank: z.ZodNumber;
    actor: z.ZodString;
    score: z.ZodNumber;
    eventCount: z.ZodNumber;
  },
  z.core.$strip
>;
export declare const LeaderboardSchema: z.ZodObject<
  {
    period: z.ZodEnum<{
      "all-time": "all-time";
      monthly: "monthly";
      weekly: "weekly";
    }>;
    configured: z.ZodBoolean;
    available: z.ZodBoolean;
    data: z.ZodArray<
      z.ZodObject<
        {
          rank: z.ZodNumber;
          actor: z.ZodString;
          score: z.ZodNumber;
          eventCount: z.ZodNumber;
        },
        z.core.$strip
      >
    >;
  },
  z.core.$strip
>;
export type Leaderboard = z.infer<typeof LeaderboardSchema>;
/**
 * One builder's all-time standing, read from activity rather than computed here.
 * `null` when the gateway is unreachable or the builder has not scored yet.
 */
export declare const BuilderStandingSchema: z.ZodNullable<
  z.ZodObject<
    {
      accountId: z.ZodString;
      rank: z.ZodNumber;
      score: z.ZodNumber;
      eventCount: z.ZodNumber;
    },
    z.core.$strip
  >
>;
export type BuilderStanding = z.infer<typeof BuilderStandingSchema>;
export declare const RoundEndorsementSchema: z.ZodObject<
  {
    eventId: z.ZodString;
    totalCount: z.ZodNumber;
  },
  z.core.$strip
>;
export type RoundEndorsement = z.infer<typeof RoundEndorsementSchema>;
export declare const BuilderActivityEventSchema: z.ZodObject<
  {
    id: z.ZodString;
    source: z.ZodString;
    sourceDisplayName: z.ZodString;
    type: z.ZodString;
    timestamp: z.ZodString;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
  },
  z.core.$strip
>;
export type BuilderActivityEvent = z.infer<typeof BuilderActivityEventSchema>;
/**
 * One undeliverable row from the activity outbox, for operator inspection.
 * Dates arrive as ISO strings; the local Date objects are serialized by the
 * handler before returning.
 */
export declare const ActivityOutboxRowSchema: z.ZodObject<
  {
    id: z.ZodUUID;
    operation: z.ZodEnum<{
      emit: "emit";
      retract: "retract";
    }>;
    eventType: z.ZodNullable<z.ZodString>;
    actor: z.ZodNullable<z.ZodString>;
    payload: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    targetEventId: z.ZodNullable<z.ZodString>;
    reason: z.ZodNullable<z.ZodString>;
    idempotencyKey: z.ZodString;
    subjectKind: z.ZodNullable<z.ZodString>;
    subjectId: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
      cancelled: "cancelled";
      failed: "failed";
      pending: "pending";
      sent: "sent";
    }>;
    attempts: z.ZodNumber;
    lastError: z.ZodNullable<z.ZodString>;
    nextAttemptAt: z.ZodISODateTime;
    eventId: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodISODateTime;
    sentAt: z.ZodNullable<z.ZodISODateTime>;
  },
  z.core.$strip
>;
export type ActivityOutboxRow = z.infer<typeof ActivityOutboxRowSchema>;
export declare const NearBuildersProjectSchema: z.ZodObject<
  {
    id: z.ZodString;
    slug: z.ZodString;
    title: z.ZodString;
    description: z.ZodPipe<
      z.ZodOptional<z.ZodNullable<z.ZodString>>,
      z.ZodTransform<string | null, string | null | undefined>
    >;
    kind: z.ZodEnum<{
      idea: "idea";
      project: "project";
      result: "result";
      scope: "scope";
    }>;
    status: z.ZodEnum<{
      active: "active";
      archived: "archived";
      paused: "paused";
    }>;
    visibility: z.ZodEnum<{
      private: "private";
      public: "public";
      unlisted: "unlisted";
    }>;
    domain: z.ZodPipe<
      z.ZodOptional<z.ZodNullable<z.ZodString>>,
      z.ZodTransform<string | null, string | null | undefined>
    >;
    repository: z.ZodPipe<
      z.ZodOptional<z.ZodNullable<z.ZodString>>,
      z.ZodTransform<string | null, string | null | undefined>
    >;
    logoUrl: z.ZodPipe<
      z.ZodOptional<z.ZodNullable<z.ZodString>>,
      z.ZodTransform<string | null, string | null | undefined>
    >;
  },
  z.core.$strip
>;
export type NearBuildersProject = z.infer<typeof NearBuildersProjectSchema>;
export declare const ProjectDetailSchema: z.ZodObject<
  {
    id: z.ZodString;
    slug: z.ZodString;
    name: z.ZodString;
    ownerOrgId: z.ZodNullable<z.ZodString>;
    managingTeamId: z.ZodNullable<z.ZodString>;
    nearbuildersProjectId: z.ZodNullable<z.ZodString>;
    contact: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
      approved: "approved";
      pending: "pending";
      rejected: "rejected";
    }>;
    approvedAt: z.ZodNullable<z.ZodString>;
    rejectedAt: z.ZodNullable<z.ZodString>;
    rejectionReason: z.ZodNullable<z.ZodString>;
    verifiedAt: z.ZodNullable<z.ZodString>;
    verifiedByAccountId: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    identity: z.ZodNullable<
      z.ZodObject<
        {
          title: z.ZodString;
          description: z.ZodNullable<z.ZodString>;
          domain: z.ZodNullable<z.ZodString>;
          repository: z.ZodNullable<z.ZodString>;
          logoUrl: z.ZodNullable<z.ZodString>;
          kind: z.ZodEnum<{
            idea: "idea";
            project: "project";
            result: "result";
            scope: "scope";
          }>;
        },
        z.core.$strip
      >
    >;
    rounds: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          ownerAccountId: z.ZodString;
          title: z.ZodString;
          status: z.ZodEnum<{
            closed: "closed";
            open: "open";
            pending: "pending";
            rejected: "rejected";
          }>;
          projectRoundNumber: z.ZodNumber;
          endsAt: z.ZodNullable<z.ZodString>;
        },
        z.core.$strip
      >
    >;
    canManage: z.ZodBoolean;
  },
  z.core.$strip
>;
export type ProjectDetail = z.infer<typeof ProjectDetailSchema>;
export declare const ProjectSearchResultSchema: z.ZodObject<
  {
    available: z.ZodBoolean;
    results: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          slug: z.ZodString;
          title: z.ZodString;
          description: z.ZodPipe<
            z.ZodOptional<z.ZodNullable<z.ZodString>>,
            z.ZodTransform<string | null, string | null | undefined>
          >;
          kind: z.ZodEnum<{
            idea: "idea";
            project: "project";
            result: "result";
            scope: "scope";
          }>;
          status: z.ZodEnum<{
            active: "active";
            archived: "archived";
            paused: "paused";
          }>;
          visibility: z.ZodEnum<{
            private: "private";
            public: "public";
            unlisted: "unlisted";
          }>;
          domain: z.ZodPipe<
            z.ZodOptional<z.ZodNullable<z.ZodString>>,
            z.ZodTransform<string | null, string | null | undefined>
          >;
          repository: z.ZodPipe<
            z.ZodOptional<z.ZodNullable<z.ZodString>>,
            z.ZodTransform<string | null, string | null | undefined>
          >;
          logoUrl: z.ZodPipe<
            z.ZodOptional<z.ZodNullable<z.ZodString>>,
            z.ZodTransform<string | null, string | null | undefined>
          >;
        },
        z.core.$strip
      >
    >;
  },
  z.core.$strip
>;
export type ProjectSearchResult = z.infer<typeof ProjectSearchResultSchema>;
export declare const TelegramTipSchema: z.ZodObject<
  {
    handle: z.ZodNullable<z.ZodString>;
    source: z.ZodNullable<
      z.ZodEnum<{
        "near-social": "near-social";
        nearbuilders: "nearbuilders";
      }>
    >;
    available: z.ZodBoolean;
    message: z.ZodNullable<z.ZodString>;
    shareUrl: z.ZodNullable<z.ZodString>;
  },
  z.core.$strip
>;
export type TelegramTip = z.infer<typeof TelegramTipSchema>;
export declare const contract: {
  ping: import("@orpc/contract").ProcedureContract<
    import("@orpc/contract").InitialInputSchema,
    z.ZodObject<
      {
        status: z.ZodLiteral<"ok">;
        timestamp: z.ZodISODateTime;
      },
      z.core.$strip
    >,
    object
  >;
  authHealth: import("@orpc/contract").ProcedureContract<
    import("@orpc/contract").InitialInputSchema,
    z.ZodObject<
      {
        status: z.ZodString;
        emailConfigured: z.ZodBoolean;
        smsConfigured: z.ZodBoolean;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
    }
  >;
  createRound: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        projectSlug: z.ZodString;
        projectId: z.ZodOptional<z.ZodString>;
        projectName: z.ZodOptional<z.ZodString>;
        contact: z.ZodOptional<z.ZodString>;
        title: z.ZodString;
        description: z.ZodString;
        readme: z.ZodOptional<z.ZodString>;
        bannerUrl: z.ZodOptional<z.ZodString>;
        formats: z.ZodArray<
          z.ZodEnum<{
            issues: "issues";
            recorded: "recorded";
            written: "written";
          }>
        >;
        repoUrl: z.ZodOptional<z.ZodString>;
        isPrivate: z.ZodOptional<z.ZodBoolean>;
        legionOnly: z.ZodOptional<z.ZodBoolean>;
        endsAt: z.ZodOptional<z.ZodISODateTime>;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        id: z.ZodString;
        ownerAccountId: z.ZodString;
        projectSlug: z.ZodString;
        projectRecordId: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        title: z.ZodString;
        description: z.ZodString;
        readme: z.ZodString;
        bannerUrl: z.ZodNullable<z.ZodString>;
        formats: z.ZodArray<
          z.ZodEnum<{
            issues: "issues";
            recorded: "recorded";
            written: "written";
          }>
        >;
        repoUrl: z.ZodNullable<z.ZodString>;
        isPrivate: z.ZodBoolean;
        legionOnly: z.ZodBoolean;
        endsAt: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
          closed: "closed";
          open: "open";
          pending: "pending";
          rejected: "rejected";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        closedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      BAD_REQUEST: {
        readonly status: 400;
        readonly data: z.ZodObject<
          {
            invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            validationErrors: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strip
                >
              >
            >;
          },
          z.core.$strip
        >;
      };
    }
  >;
  updateRound: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
        readme: z.ZodOptional<z.ZodString>;
        bannerUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        formats: z.ZodOptional<
          z.ZodArray<
            z.ZodEnum<{
              issues: "issues";
              recorded: "recorded";
              written: "written";
            }>
          >
        >;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        id: z.ZodString;
        ownerAccountId: z.ZodString;
        projectSlug: z.ZodString;
        projectRecordId: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        title: z.ZodString;
        description: z.ZodString;
        readme: z.ZodString;
        bannerUrl: z.ZodNullable<z.ZodString>;
        formats: z.ZodArray<
          z.ZodEnum<{
            issues: "issues";
            recorded: "recorded";
            written: "written";
          }>
        >;
        repoUrl: z.ZodNullable<z.ZodString>;
        isPrivate: z.ZodBoolean;
        legionOnly: z.ZodBoolean;
        endsAt: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
          closed: "closed";
          open: "open";
          pending: "pending";
          rejected: "rejected";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        closedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      BAD_REQUEST: {
        readonly status: 400;
        readonly data: z.ZodObject<
          {
            invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            validationErrors: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strip
                >
              >
            >;
          },
          z.core.$strip
        >;
      };
    }
  >;
  updateRoundSettings: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
        isPrivate: z.ZodOptional<z.ZodBoolean>;
        legionOnly: z.ZodOptional<z.ZodBoolean>;
        endsAt: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        id: z.ZodString;
        ownerAccountId: z.ZodString;
        projectSlug: z.ZodString;
        projectRecordId: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        title: z.ZodString;
        description: z.ZodString;
        readme: z.ZodString;
        bannerUrl: z.ZodNullable<z.ZodString>;
        formats: z.ZodArray<
          z.ZodEnum<{
            issues: "issues";
            recorded: "recorded";
            written: "written";
          }>
        >;
        repoUrl: z.ZodNullable<z.ZodString>;
        isPrivate: z.ZodBoolean;
        legionOnly: z.ZodBoolean;
        endsAt: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
          closed: "closed";
          open: "open";
          pending: "pending";
          rejected: "rejected";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        closedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  listRounds: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        status: z.ZodOptional<
          z.ZodEnum<{
            closed: "closed";
            open: "open";
            pending: "pending";
            rejected: "rejected";
          }>
        >;
      },
      z.core.$strip
    >,
    z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          ownerAccountId: z.ZodString;
          projectSlug: z.ZodString;
          projectRecordId: z.ZodString;
          projectRoundNumber: z.ZodNumber;
          title: z.ZodString;
          description: z.ZodString;
          readme: z.ZodString;
          bannerUrl: z.ZodNullable<z.ZodString>;
          formats: z.ZodArray<
            z.ZodEnum<{
              issues: "issues";
              recorded: "recorded";
              written: "written";
            }>
          >;
          repoUrl: z.ZodNullable<z.ZodString>;
          isPrivate: z.ZodBoolean;
          legionOnly: z.ZodBoolean;
          endsAt: z.ZodNullable<z.ZodString>;
          status: z.ZodEnum<{
            closed: "closed";
            open: "open";
            pending: "pending";
            rejected: "rejected";
          }>;
          createdAt: z.ZodString;
          updatedAt: z.ZodString;
          closedAt: z.ZodNullable<z.ZodString>;
          rejectedAt: z.ZodNullable<z.ZodString>;
          rejectionReason: z.ZodNullable<z.ZodString>;
          identity: z.ZodNullable<
            z.ZodObject<
              {
                title: z.ZodString;
                description: z.ZodNullable<z.ZodString>;
                domain: z.ZodNullable<z.ZodString>;
                repository: z.ZodNullable<z.ZodString>;
                logoUrl: z.ZodNullable<z.ZodString>;
                kind: z.ZodEnum<{
                  idea: "idea";
                  project: "project";
                  result: "result";
                  scope: "scope";
                }>;
              },
              z.core.$strip
            >
          >;
          participantCount: z.ZodNumber;
          participantPreview: z.ZodOptional<z.ZodArray<z.ZodString>>;
          feedbackCount: z.ZodOptional<z.ZodNumber>;
          canManage: z.ZodOptional<z.ZodBoolean>;
          projectVerifiedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        },
        z.core.$strip
      >
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  listProjects: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        status: z.ZodOptional<
          z.ZodEnum<{
            approved: "approved";
            pending: "pending";
            rejected: "rejected";
          }>
        >;
      },
      z.core.$strip
    >,
    z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          slug: z.ZodString;
          name: z.ZodString;
          ownerOrgId: z.ZodNullable<z.ZodString>;
          managingTeamId: z.ZodNullable<z.ZodString>;
          nearbuildersProjectId: z.ZodNullable<z.ZodString>;
          contact: z.ZodNullable<z.ZodString>;
          status: z.ZodEnum<{
            approved: "approved";
            pending: "pending";
            rejected: "rejected";
          }>;
          approvedAt: z.ZodNullable<z.ZodString>;
          rejectedAt: z.ZodNullable<z.ZodString>;
          rejectionReason: z.ZodNullable<z.ZodString>;
          verifiedAt: z.ZodNullable<z.ZodString>;
          verifiedByAccountId: z.ZodNullable<z.ZodString>;
          createdAt: z.ZodString;
          updatedAt: z.ZodString;
          identity: z.ZodNullable<
            z.ZodObject<
              {
                title: z.ZodString;
                description: z.ZodNullable<z.ZodString>;
                domain: z.ZodNullable<z.ZodString>;
                repository: z.ZodNullable<z.ZodString>;
                logoUrl: z.ZodNullable<z.ZodString>;
                kind: z.ZodEnum<{
                  idea: "idea";
                  project: "project";
                  result: "result";
                  scope: "scope";
                }>;
              },
              z.core.$strip
            >
          >;
          rounds: z.ZodArray<
            z.ZodObject<
              {
                id: z.ZodString;
                ownerAccountId: z.ZodString;
                title: z.ZodString;
                status: z.ZodEnum<{
                  closed: "closed";
                  open: "open";
                  pending: "pending";
                  rejected: "rejected";
                }>;
                projectRoundNumber: z.ZodNumber;
                endsAt: z.ZodNullable<z.ZodString>;
              },
              z.core.$strip
            >
          >;
        },
        z.core.$strip
      >
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  listMyProjects: import("@orpc/contract").ProcedureContract<
    import("@orpc/contract").InitialInputSchema,
    z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          slug: z.ZodString;
          name: z.ZodString;
          ownerOrgId: z.ZodNullable<z.ZodString>;
          managingTeamId: z.ZodNullable<z.ZodString>;
          nearbuildersProjectId: z.ZodNullable<z.ZodString>;
          contact: z.ZodNullable<z.ZodString>;
          status: z.ZodEnum<{
            approved: "approved";
            pending: "pending";
            rejected: "rejected";
          }>;
          approvedAt: z.ZodNullable<z.ZodString>;
          rejectedAt: z.ZodNullable<z.ZodString>;
          rejectionReason: z.ZodNullable<z.ZodString>;
          verifiedAt: z.ZodNullable<z.ZodString>;
          verifiedByAccountId: z.ZodNullable<z.ZodString>;
          createdAt: z.ZodString;
          updatedAt: z.ZodString;
          identity: z.ZodNullable<
            z.ZodObject<
              {
                title: z.ZodString;
                description: z.ZodNullable<z.ZodString>;
                domain: z.ZodNullable<z.ZodString>;
                repository: z.ZodNullable<z.ZodString>;
                logoUrl: z.ZodNullable<z.ZodString>;
                kind: z.ZodEnum<{
                  idea: "idea";
                  project: "project";
                  result: "result";
                  scope: "scope";
                }>;
              },
              z.core.$strip
            >
          >;
          rounds: z.ZodArray<
            z.ZodObject<
              {
                id: z.ZodString;
                ownerAccountId: z.ZodString;
                title: z.ZodString;
                status: z.ZodEnum<{
                  closed: "closed";
                  open: "open";
                  pending: "pending";
                  rejected: "rejected";
                }>;
                projectRoundNumber: z.ZodNumber;
                endsAt: z.ZodNullable<z.ZodString>;
              },
              z.core.$strip
            >
          >;
        },
        z.core.$strip
      >
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  approveProject: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
        ownerOrgId: z.ZodNullable<z.ZodString>;
        managingTeamId: z.ZodNullable<z.ZodString>;
        nearbuildersProjectId: z.ZodNullable<z.ZodString>;
        contact: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
          approved: "approved";
          pending: "pending";
          rejected: "rejected";
        }>;
        approvedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        verifiedAt: z.ZodNullable<z.ZodString>;
        verifiedByAccountId: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        identity: z.ZodNullable<
          z.ZodObject<
            {
              title: z.ZodString;
              description: z.ZodNullable<z.ZodString>;
              domain: z.ZodNullable<z.ZodString>;
              repository: z.ZodNullable<z.ZodString>;
              logoUrl: z.ZodNullable<z.ZodString>;
              kind: z.ZodEnum<{
                idea: "idea";
                project: "project";
                result: "result";
                scope: "scope";
              }>;
            },
            z.core.$strip
          >
        >;
        rounds: z.ZodArray<
          z.ZodObject<
            {
              id: z.ZodString;
              ownerAccountId: z.ZodString;
              title: z.ZodString;
              status: z.ZodEnum<{
                closed: "closed";
                open: "open";
                pending: "pending";
                rejected: "rejected";
              }>;
              projectRoundNumber: z.ZodNumber;
              endsAt: z.ZodNullable<z.ZodString>;
            },
            z.core.$strip
          >
        >;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      BAD_REQUEST: {
        readonly status: 400;
        readonly data: z.ZodObject<
          {
            invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            validationErrors: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strip
                >
              >
            >;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  rejectProject: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
        reason: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
        ownerOrgId: z.ZodNullable<z.ZodString>;
        managingTeamId: z.ZodNullable<z.ZodString>;
        nearbuildersProjectId: z.ZodNullable<z.ZodString>;
        contact: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
          approved: "approved";
          pending: "pending";
          rejected: "rejected";
        }>;
        approvedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        verifiedAt: z.ZodNullable<z.ZodString>;
        verifiedByAccountId: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        identity: z.ZodNullable<
          z.ZodObject<
            {
              title: z.ZodString;
              description: z.ZodNullable<z.ZodString>;
              domain: z.ZodNullable<z.ZodString>;
              repository: z.ZodNullable<z.ZodString>;
              logoUrl: z.ZodNullable<z.ZodString>;
              kind: z.ZodEnum<{
                idea: "idea";
                project: "project";
                result: "result";
                scope: "scope";
              }>;
            },
            z.core.$strip
          >
        >;
        rounds: z.ZodArray<
          z.ZodObject<
            {
              id: z.ZodString;
              ownerAccountId: z.ZodString;
              title: z.ZodString;
              status: z.ZodEnum<{
                closed: "closed";
                open: "open";
                pending: "pending";
                rejected: "rejected";
              }>;
              projectRoundNumber: z.ZodNumber;
              endsAt: z.ZodNullable<z.ZodString>;
            },
            z.core.$strip
          >
        >;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      BAD_REQUEST: {
        readonly status: 400;
        readonly data: z.ZodObject<
          {
            invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            validationErrors: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strip
                >
              >
            >;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  setProjectManagingTeam: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
        teamId: z.ZodNullable<z.ZodString>;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
        ownerOrgId: z.ZodNullable<z.ZodString>;
        managingTeamId: z.ZodNullable<z.ZodString>;
        nearbuildersProjectId: z.ZodNullable<z.ZodString>;
        contact: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
          approved: "approved";
          pending: "pending";
          rejected: "rejected";
        }>;
        approvedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        verifiedAt: z.ZodNullable<z.ZodString>;
        verifiedByAccountId: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        identity: z.ZodNullable<
          z.ZodObject<
            {
              title: z.ZodString;
              description: z.ZodNullable<z.ZodString>;
              domain: z.ZodNullable<z.ZodString>;
              repository: z.ZodNullable<z.ZodString>;
              logoUrl: z.ZodNullable<z.ZodString>;
              kind: z.ZodEnum<{
                idea: "idea";
                project: "project";
                result: "result";
                scope: "scope";
              }>;
            },
            z.core.$strip
          >
        >;
        rounds: z.ZodArray<
          z.ZodObject<
            {
              id: z.ZodString;
              ownerAccountId: z.ZodString;
              title: z.ZodString;
              status: z.ZodEnum<{
                closed: "closed";
                open: "open";
                pending: "pending";
                rejected: "rejected";
              }>;
              projectRoundNumber: z.ZodNumber;
              endsAt: z.ZodNullable<z.ZodString>;
            },
            z.core.$strip
          >
        >;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      BAD_REQUEST: {
        readonly status: 400;
        readonly data: z.ZodObject<
          {
            invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            validationErrors: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strip
                >
              >
            >;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  verifyProject: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
        ownerOrgId: z.ZodNullable<z.ZodString>;
        managingTeamId: z.ZodNullable<z.ZodString>;
        nearbuildersProjectId: z.ZodNullable<z.ZodString>;
        contact: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
          approved: "approved";
          pending: "pending";
          rejected: "rejected";
        }>;
        approvedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        verifiedAt: z.ZodNullable<z.ZodString>;
        verifiedByAccountId: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        identity: z.ZodNullable<
          z.ZodObject<
            {
              title: z.ZodString;
              description: z.ZodNullable<z.ZodString>;
              domain: z.ZodNullable<z.ZodString>;
              repository: z.ZodNullable<z.ZodString>;
              logoUrl: z.ZodNullable<z.ZodString>;
              kind: z.ZodEnum<{
                idea: "idea";
                project: "project";
                result: "result";
                scope: "scope";
              }>;
            },
            z.core.$strip
          >
        >;
        rounds: z.ZodArray<
          z.ZodObject<
            {
              id: z.ZodString;
              ownerAccountId: z.ZodString;
              title: z.ZodString;
              status: z.ZodEnum<{
                closed: "closed";
                open: "open";
                pending: "pending";
                rejected: "rejected";
              }>;
              projectRoundNumber: z.ZodNumber;
              endsAt: z.ZodNullable<z.ZodString>;
            },
            z.core.$strip
          >
        >;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      BAD_REQUEST: {
        readonly status: 400;
        readonly data: z.ZodObject<
          {
            invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            validationErrors: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strip
                >
              >
            >;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  unverifyProject: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
        ownerOrgId: z.ZodNullable<z.ZodString>;
        managingTeamId: z.ZodNullable<z.ZodString>;
        nearbuildersProjectId: z.ZodNullable<z.ZodString>;
        contact: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
          approved: "approved";
          pending: "pending";
          rejected: "rejected";
        }>;
        approvedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        verifiedAt: z.ZodNullable<z.ZodString>;
        verifiedByAccountId: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        identity: z.ZodNullable<
          z.ZodObject<
            {
              title: z.ZodString;
              description: z.ZodNullable<z.ZodString>;
              domain: z.ZodNullable<z.ZodString>;
              repository: z.ZodNullable<z.ZodString>;
              logoUrl: z.ZodNullable<z.ZodString>;
              kind: z.ZodEnum<{
                idea: "idea";
                project: "project";
                result: "result";
                scope: "scope";
              }>;
            },
            z.core.$strip
          >
        >;
        rounds: z.ZodArray<
          z.ZodObject<
            {
              id: z.ZodString;
              ownerAccountId: z.ZodString;
              title: z.ZodString;
              status: z.ZodEnum<{
                closed: "closed";
                open: "open";
                pending: "pending";
                rejected: "rejected";
              }>;
              projectRoundNumber: z.ZodNumber;
              endsAt: z.ZodNullable<z.ZodString>;
            },
            z.core.$strip
          >
        >;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      BAD_REQUEST: {
        readonly status: 400;
        readonly data: z.ZodObject<
          {
            invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            validationErrors: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strip
                >
              >
            >;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  deleteRound: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        id: z.ZodString;
        ownerAccountId: z.ZodString;
        projectSlug: z.ZodString;
        projectRecordId: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        title: z.ZodString;
        description: z.ZodString;
        readme: z.ZodString;
        bannerUrl: z.ZodNullable<z.ZodString>;
        formats: z.ZodArray<
          z.ZodEnum<{
            issues: "issues";
            recorded: "recorded";
            written: "written";
          }>
        >;
        repoUrl: z.ZodNullable<z.ZodString>;
        isPrivate: z.ZodBoolean;
        legionOnly: z.ZodBoolean;
        endsAt: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
          closed: "closed";
          open: "open";
          pending: "pending";
          rejected: "rejected";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        closedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      BAD_REQUEST: {
        readonly status: 400;
        readonly data: z.ZodObject<
          {
            invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            validationErrors: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strip
                >
              >
            >;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  rejectRound: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
        reason: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        id: z.ZodString;
        ownerAccountId: z.ZodString;
        projectSlug: z.ZodString;
        projectRecordId: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        title: z.ZodString;
        description: z.ZodString;
        readme: z.ZodString;
        bannerUrl: z.ZodNullable<z.ZodString>;
        formats: z.ZodArray<
          z.ZodEnum<{
            issues: "issues";
            recorded: "recorded";
            written: "written";
          }>
        >;
        repoUrl: z.ZodNullable<z.ZodString>;
        isPrivate: z.ZodBoolean;
        legionOnly: z.ZodBoolean;
        endsAt: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
          closed: "closed";
          open: "open";
          pending: "pending";
          rejected: "rejected";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        closedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      BAD_REQUEST: {
        readonly status: 400;
        readonly data: z.ZodObject<
          {
            invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            validationErrors: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strip
                >
              >
            >;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  restoreRound: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        id: z.ZodString;
        ownerAccountId: z.ZodString;
        projectSlug: z.ZodString;
        projectRecordId: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        title: z.ZodString;
        description: z.ZodString;
        readme: z.ZodString;
        bannerUrl: z.ZodNullable<z.ZodString>;
        formats: z.ZodArray<
          z.ZodEnum<{
            issues: "issues";
            recorded: "recorded";
            written: "written";
          }>
        >;
        repoUrl: z.ZodNullable<z.ZodString>;
        isPrivate: z.ZodBoolean;
        legionOnly: z.ZodBoolean;
        endsAt: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
          closed: "closed";
          open: "open";
          pending: "pending";
          rejected: "rejected";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        closedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      BAD_REQUEST: {
        readonly status: 400;
        readonly data: z.ZodObject<
          {
            invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            validationErrors: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strip
                >
              >
            >;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  getRound: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        id: z.ZodString;
        ownerAccountId: z.ZodString;
        projectSlug: z.ZodString;
        projectRecordId: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        title: z.ZodString;
        description: z.ZodString;
        readme: z.ZodString;
        bannerUrl: z.ZodNullable<z.ZodString>;
        formats: z.ZodArray<
          z.ZodEnum<{
            issues: "issues";
            recorded: "recorded";
            written: "written";
          }>
        >;
        repoUrl: z.ZodNullable<z.ZodString>;
        isPrivate: z.ZodBoolean;
        legionOnly: z.ZodBoolean;
        endsAt: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
          closed: "closed";
          open: "open";
          pending: "pending";
          rejected: "rejected";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        closedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        identity: z.ZodNullable<
          z.ZodObject<
            {
              title: z.ZodString;
              description: z.ZodNullable<z.ZodString>;
              domain: z.ZodNullable<z.ZodString>;
              repository: z.ZodNullable<z.ZodString>;
              logoUrl: z.ZodNullable<z.ZodString>;
              kind: z.ZodEnum<{
                idea: "idea";
                project: "project";
                result: "result";
                scope: "scope";
              }>;
            },
            z.core.$strip
          >
        >;
        participantCount: z.ZodNumber;
        participantPreview: z.ZodOptional<z.ZodArray<z.ZodString>>;
        feedbackCount: z.ZodOptional<z.ZodNumber>;
        canManage: z.ZodOptional<z.ZodBoolean>;
        projectVerifiedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      },
      z.core.$strip
    >,
    {
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  getRoundBySlug: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        slug: z.ZodString;
        number: z.ZodCoercedNumber<unknown>;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        id: z.ZodString;
        ownerAccountId: z.ZodString;
        projectSlug: z.ZodString;
        projectRecordId: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        title: z.ZodString;
        description: z.ZodString;
        readme: z.ZodString;
        bannerUrl: z.ZodNullable<z.ZodString>;
        formats: z.ZodArray<
          z.ZodEnum<{
            issues: "issues";
            recorded: "recorded";
            written: "written";
          }>
        >;
        repoUrl: z.ZodNullable<z.ZodString>;
        isPrivate: z.ZodBoolean;
        legionOnly: z.ZodBoolean;
        endsAt: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
          closed: "closed";
          open: "open";
          pending: "pending";
          rejected: "rejected";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        closedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        identity: z.ZodNullable<
          z.ZodObject<
            {
              title: z.ZodString;
              description: z.ZodNullable<z.ZodString>;
              domain: z.ZodNullable<z.ZodString>;
              repository: z.ZodNullable<z.ZodString>;
              logoUrl: z.ZodNullable<z.ZodString>;
              kind: z.ZodEnum<{
                idea: "idea";
                project: "project";
                result: "result";
                scope: "scope";
              }>;
            },
            z.core.$strip
          >
        >;
        participantCount: z.ZodNumber;
        participantPreview: z.ZodOptional<z.ZodArray<z.ZodString>>;
        feedbackCount: z.ZodOptional<z.ZodNumber>;
        canManage: z.ZodOptional<z.ZodBoolean>;
        projectVerifiedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      },
      z.core.$strip
    >,
    {
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  joinRound: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        id: z.ZodString;
        ownerAccountId: z.ZodString;
        projectSlug: z.ZodString;
        projectRecordId: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        title: z.ZodString;
        description: z.ZodString;
        readme: z.ZodString;
        bannerUrl: z.ZodNullable<z.ZodString>;
        formats: z.ZodArray<
          z.ZodEnum<{
            issues: "issues";
            recorded: "recorded";
            written: "written";
          }>
        >;
        repoUrl: z.ZodNullable<z.ZodString>;
        isPrivate: z.ZodBoolean;
        legionOnly: z.ZodBoolean;
        endsAt: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
          closed: "closed";
          open: "open";
          pending: "pending";
          rejected: "rejected";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        closedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        identity: z.ZodNullable<
          z.ZodObject<
            {
              title: z.ZodString;
              description: z.ZodNullable<z.ZodString>;
              domain: z.ZodNullable<z.ZodString>;
              repository: z.ZodNullable<z.ZodString>;
              logoUrl: z.ZodNullable<z.ZodString>;
              kind: z.ZodEnum<{
                idea: "idea";
                project: "project";
                result: "result";
                scope: "scope";
              }>;
            },
            z.core.$strip
          >
        >;
        participantCount: z.ZodNumber;
        participantPreview: z.ZodOptional<z.ZodArray<z.ZodString>>;
        feedbackCount: z.ZodOptional<z.ZodNumber>;
        canManage: z.ZodOptional<z.ZodBoolean>;
        projectVerifiedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      BAD_REQUEST: {
        readonly status: 400;
        readonly data: z.ZodObject<
          {
            invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            validationErrors: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strip
                >
              >
            >;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  leaveRound: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        id: z.ZodString;
        ownerAccountId: z.ZodString;
        projectSlug: z.ZodString;
        projectRecordId: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        title: z.ZodString;
        description: z.ZodString;
        readme: z.ZodString;
        bannerUrl: z.ZodNullable<z.ZodString>;
        formats: z.ZodArray<
          z.ZodEnum<{
            issues: "issues";
            recorded: "recorded";
            written: "written";
          }>
        >;
        repoUrl: z.ZodNullable<z.ZodString>;
        isPrivate: z.ZodBoolean;
        legionOnly: z.ZodBoolean;
        endsAt: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
          closed: "closed";
          open: "open";
          pending: "pending";
          rejected: "rejected";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        closedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        identity: z.ZodNullable<
          z.ZodObject<
            {
              title: z.ZodString;
              description: z.ZodNullable<z.ZodString>;
              domain: z.ZodNullable<z.ZodString>;
              repository: z.ZodNullable<z.ZodString>;
              logoUrl: z.ZodNullable<z.ZodString>;
              kind: z.ZodEnum<{
                idea: "idea";
                project: "project";
                result: "result";
                scope: "scope";
              }>;
            },
            z.core.$strip
          >
        >;
        participantCount: z.ZodNumber;
        participantPreview: z.ZodOptional<z.ZodArray<z.ZodString>>;
        feedbackCount: z.ZodOptional<z.ZodNumber>;
        canManage: z.ZodOptional<z.ZodBoolean>;
        projectVerifiedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  getMyParticipation: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        joined: z.ZodBoolean;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
    }
  >;
  listMyJoinedRounds: import("@orpc/contract").ProcedureContract<
    import("@orpc/contract").InitialInputSchema,
    z.ZodArray<
      z.ZodObject<
        {
          roundId: z.ZodString;
          roundTitle: z.ZodString;
          projectSlug: z.ZodString;
          projectRoundNumber: z.ZodNumber;
          status: z.ZodEnum<{
            closed: "closed";
            open: "open";
            pending: "pending";
            rejected: "rejected";
          }>;
          endsAt: z.ZodNullable<z.ZodString>;
          formats: z.ZodArray<
            z.ZodEnum<{
              issues: "issues";
              recorded: "recorded";
              written: "written";
            }>
          >;
          readme: z.ZodString;
          repoUrl: z.ZodNullable<z.ZodString>;
          participantCount: z.ZodNumber;
          myFeedbackCount: z.ZodNumber;
          joinedAt: z.ZodString;
        },
        z.core.$strip
      >
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      BAD_REQUEST: {
        readonly status: 400;
        readonly data: z.ZodObject<
          {
            invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            validationErrors: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strip
                >
              >
            >;
          },
          z.core.$strip
        >;
      };
    }
  >;
  getOwnerSummary: import("@orpc/contract").ProcedureContract<
    import("@orpc/contract").InitialInputSchema,
    z.ZodObject<
      {
        openRounds: z.ZodNumber;
        unresolvedFeedback: z.ZodNumber;
        pendingProjects: z.ZodNumber;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      BAD_REQUEST: {
        readonly status: 400;
        readonly data: z.ZodObject<
          {
            invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            validationErrors: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strip
                >
              >
            >;
          },
          z.core.$strip
        >;
      };
    }
  >;
  getMyLegionAccess: import("@orpc/contract").ProcedureContract<
    import("@orpc/contract").InitialInputSchema,
    z.ZodObject<
      {
        hasAccess: z.ZodBoolean;
        linkedNearAccount: z.ZodNullable<z.ZodString>;
        mintUrl: z.ZodString;
      },
      z.core.$strip
    >,
    object
  >;
  postFeedback: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
        format: z.ZodEnum<{
          recorded: "recorded";
          written: "written";
        }>;
        body: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        id: z.ZodString;
        roundId: z.ZodString;
        authorAccountId: z.ZodString;
        format: z.ZodEnum<{
          recorded: "recorded";
          written: "written";
        }>;
        body: z.ZodNullable<z.ZodString>;
        url: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
          dismissed: "dismissed";
          resolved: "resolved";
          unresolved: "unresolved";
        }>;
        starredAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodNullable<z.ZodString>;
        nostrEventId: z.ZodNullable<z.ZodString>;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      BAD_REQUEST: {
        readonly status: 400;
        readonly data: z.ZodObject<
          {
            invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            validationErrors: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strip
                >
              >
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  listFeedback: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
        cursor: z.ZodOptional<z.ZodString>;
        limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        status: z.ZodOptional<
          z.ZodEnum<{
            dismissed: "dismissed";
            resolved: "resolved";
            unresolved: "unresolved";
          }>
        >;
        author: z.ZodOptional<z.ZodString>;
        starred: z.ZodOptional<
          z.ZodUnion<readonly [z.ZodBoolean, z.ZodCodec<z.ZodString, z.ZodBoolean>]>
        >;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        items: z.ZodArray<
          z.ZodObject<
            {
              id: z.ZodString;
              roundId: z.ZodString;
              authorAccountId: z.ZodString;
              format: z.ZodEnum<{
                recorded: "recorded";
                written: "written";
              }>;
              body: z.ZodNullable<z.ZodString>;
              url: z.ZodNullable<z.ZodString>;
              status: z.ZodEnum<{
                dismissed: "dismissed";
                resolved: "resolved";
                unresolved: "unresolved";
              }>;
              starredAt: z.ZodNullable<z.ZodString>;
              createdAt: z.ZodString;
              updatedAt: z.ZodNullable<z.ZodString>;
              nostrEventId: z.ZodNullable<z.ZodString>;
            },
            z.core.$strip
          >
        >;
        nextCursor: z.ZodNullable<z.ZodString>;
      },
      z.core.$strip
    >,
    {
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  listMyFeedback: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          roundId: z.ZodString;
          authorAccountId: z.ZodString;
          format: z.ZodEnum<{
            recorded: "recorded";
            written: "written";
          }>;
          body: z.ZodNullable<z.ZodString>;
          url: z.ZodNullable<z.ZodString>;
          status: z.ZodEnum<{
            dismissed: "dismissed";
            resolved: "resolved";
            unresolved: "unresolved";
          }>;
          starredAt: z.ZodNullable<z.ZodString>;
          createdAt: z.ZodString;
          updatedAt: z.ZodNullable<z.ZodString>;
          nostrEventId: z.ZodNullable<z.ZodString>;
          notes: z.ZodArray<
            z.ZodObject<
              {
                id: z.ZodString;
                feedbackId: z.ZodString;
                authorAccountId: z.ZodString;
                role: z.ZodEnum<{
                  owner: "owner";
                  tester: "tester";
                }>;
                body: z.ZodString;
                createdAt: z.ZodString;
              },
              z.core.$strip
            >
          >;
        },
        z.core.$strip
      >
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  getFeedback: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
        feedbackId: z.ZodUUID;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        id: z.ZodString;
        roundId: z.ZodString;
        authorAccountId: z.ZodString;
        format: z.ZodEnum<{
          recorded: "recorded";
          written: "written";
        }>;
        body: z.ZodNullable<z.ZodString>;
        url: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
          dismissed: "dismissed";
          resolved: "resolved";
          unresolved: "unresolved";
        }>;
        starredAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodNullable<z.ZodString>;
        nostrEventId: z.ZodNullable<z.ZodString>;
        notes: z.ZodArray<
          z.ZodObject<
            {
              id: z.ZodString;
              feedbackId: z.ZodString;
              authorAccountId: z.ZodString;
              role: z.ZodEnum<{
                owner: "owner";
                tester: "tester";
              }>;
              body: z.ZodString;
              createdAt: z.ZodString;
            },
            z.core.$strip
          >
        >;
      },
      z.core.$strip
    >,
    {
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  addFeedbackNote: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
        feedbackId: z.ZodUUID;
        body: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        id: z.ZodString;
        feedbackId: z.ZodString;
        authorAccountId: z.ZodString;
        role: z.ZodEnum<{
          owner: "owner";
          tester: "tester";
        }>;
        body: z.ZodString;
        createdAt: z.ZodString;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      BAD_REQUEST: {
        readonly status: 400;
        readonly data: z.ZodObject<
          {
            invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            validationErrors: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strip
                >
              >
            >;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  editFeedback: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
        feedbackId: z.ZodUUID;
        body: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        id: z.ZodString;
        roundId: z.ZodString;
        authorAccountId: z.ZodString;
        format: z.ZodEnum<{
          recorded: "recorded";
          written: "written";
        }>;
        body: z.ZodNullable<z.ZodString>;
        url: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
          dismissed: "dismissed";
          resolved: "resolved";
          unresolved: "unresolved";
        }>;
        starredAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodNullable<z.ZodString>;
        nostrEventId: z.ZodNullable<z.ZodString>;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      BAD_REQUEST: {
        readonly status: 400;
        readonly data: z.ZodObject<
          {
            invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            validationErrors: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strip
                >
              >
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  deleteFeedback: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
        feedbackId: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        id: z.ZodString;
        roundId: z.ZodString;
        authorAccountId: z.ZodString;
        format: z.ZodEnum<{
          recorded: "recorded";
          written: "written";
        }>;
        body: z.ZodNullable<z.ZodString>;
        url: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
          dismissed: "dismissed";
          resolved: "resolved";
          unresolved: "unresolved";
        }>;
        starredAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodNullable<z.ZodString>;
        nostrEventId: z.ZodNullable<z.ZodString>;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  setFeedbackStatus: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
        feedbackIds: z.ZodArray<z.ZodString>;
        status: z.ZodEnum<{
          dismissed: "dismissed";
          resolved: "resolved";
          unresolved: "unresolved";
        }>;
        note: z.ZodOptional<z.ZodString>;
      },
      z.core.$strip
    >,
    z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          roundId: z.ZodString;
          authorAccountId: z.ZodString;
          format: z.ZodEnum<{
            recorded: "recorded";
            written: "written";
          }>;
          body: z.ZodNullable<z.ZodString>;
          url: z.ZodNullable<z.ZodString>;
          status: z.ZodEnum<{
            dismissed: "dismissed";
            resolved: "resolved";
            unresolved: "unresolved";
          }>;
          starredAt: z.ZodNullable<z.ZodString>;
          createdAt: z.ZodString;
          updatedAt: z.ZodNullable<z.ZodString>;
          nostrEventId: z.ZodNullable<z.ZodString>;
        },
        z.core.$strip
      >
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      BAD_REQUEST: {
        readonly status: 400;
        readonly data: z.ZodObject<
          {
            invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            validationErrors: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strip
                >
              >
            >;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  setFeedbackStarred: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
        feedbackIds: z.ZodArray<z.ZodString>;
        starred: z.ZodBoolean;
      },
      z.core.$strip
    >,
    z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          roundId: z.ZodString;
          authorAccountId: z.ZodString;
          format: z.ZodEnum<{
            recorded: "recorded";
            written: "written";
          }>;
          body: z.ZodNullable<z.ZodString>;
          url: z.ZodNullable<z.ZodString>;
          status: z.ZodEnum<{
            dismissed: "dismissed";
            resolved: "resolved";
            unresolved: "unresolved";
          }>;
          starredAt: z.ZodNullable<z.ZodString>;
          createdAt: z.ZodString;
          updatedAt: z.ZodNullable<z.ZodString>;
          nostrEventId: z.ZodNullable<z.ZodString>;
        },
        z.core.$strip
      >
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  listFeedbackAuthors: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodArray<
      z.ZodObject<
        {
          accountId: z.ZodString;
          telegramHandle: z.ZodNullable<z.ZodString>;
          feedbackCount: z.ZodNumber;
          unresolvedCount: z.ZodNumber;
          resolvedCount: z.ZodNumber;
          dismissedCount: z.ZodNumber;
          starredCount: z.ZodNumber;
          firstPostedAt: z.ZodString;
          lastPostedAt: z.ZodString;
        },
        z.core.$strip
      >
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  listParticipants: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodArray<
      z.ZodObject<
        {
          accountId: z.ZodString;
          joinedAt: z.ZodString;
          feedbackCount: z.ZodNumber;
        },
        z.core.$strip
      >
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  broadcastToRound: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
        kind: z.ZodEnum<{
          custom: "custom";
          round_closing: "round_closing";
          round_opened: "round_opened";
        }>;
        message: z.ZodOptional<z.ZodString>;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        recipients: z.ZodNumber;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      BAD_REQUEST: {
        readonly status: 400;
        readonly data: z.ZodObject<
          {
            invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            validationErrors: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strip
                >
              >
            >;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  listNotifications: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        items: z.ZodArray<
          z.ZodObject<
            {
              id: z.ZodString;
              roundId: z.ZodString;
              roundTitle: z.ZodString;
              projectSlug: z.ZodString;
              projectRoundNumber: z.ZodNumber;
              feedbackId: z.ZodNullable<z.ZodString>;
              kind: z.ZodEnum<{
                custom: "custom";
                feedback_dismissed: "feedback_dismissed";
                feedback_resolved: "feedback_resolved";
                round_closed: "round_closed";
                round_closing: "round_closing";
                round_opened: "round_opened";
              }>;
              title: z.ZodString;
              body: z.ZodString;
              readAt: z.ZodNullable<z.ZodString>;
              createdAt: z.ZodString;
            },
            z.core.$strip
          >
        >;
        unreadCount: z.ZodNumber;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
    }
  >;
  markNotificationRead: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        id: z.ZodString;
        roundId: z.ZodString;
        roundTitle: z.ZodString;
        projectSlug: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        feedbackId: z.ZodNullable<z.ZodString>;
        kind: z.ZodEnum<{
          custom: "custom";
          feedback_dismissed: "feedback_dismissed";
          feedback_resolved: "feedback_resolved";
          round_closed: "round_closed";
          round_closing: "round_closing";
          round_opened: "round_opened";
        }>;
        title: z.ZodString;
        body: z.ZodString;
        readAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  markAllNotificationsRead: import("@orpc/contract").ProcedureContract<
    import("@orpc/contract").InitialInputSchema,
    z.ZodObject<
      {
        updated: z.ZodNumber;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
    }
  >;
  getRoundGithubIssues: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        repoUrl: z.ZodString;
        windowStart: z.ZodString;
        windowEnd: z.ZodNullable<z.ZodString>;
        contributors: z.ZodArray<
          z.ZodObject<
            {
              login: z.ZodString;
              issues: z.ZodArray<
                z.ZodObject<
                  {
                    number: z.ZodNumber;
                    title: z.ZodString;
                    url: z.ZodString;
                    createdAt: z.ZodString;
                  },
                  z.core.$strip
                >
              >;
            },
            z.core.$strip
          >
        >;
      },
      z.core.$strip
    >,
    {
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      BAD_REQUEST: {
        readonly status: 400;
        readonly data: z.ZodObject<
          {
            invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            validationErrors: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strip
                >
              >
            >;
          },
          z.core.$strip
        >;
      };
    }
  >;
  getCreditCandidates: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodArray<
      z.ZodObject<
        {
          accountId: z.ZodString;
          writtenCount: z.ZodNumber;
          recordedCount: z.ZodNumber;
        },
        z.core.$strip
      >
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  closeRound: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
        credits: z.ZodOptional<
          z.ZodArray<
            z.ZodObject<
              {
                builderAccountId: z.ZodString;
                contributedMeaningfully: z.ZodBoolean;
                summary: z.ZodOptional<z.ZodString>;
              },
              z.core.$strip
            >
          >
        >;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        id: z.ZodString;
        ownerAccountId: z.ZodString;
        projectSlug: z.ZodString;
        projectRecordId: z.ZodString;
        projectRoundNumber: z.ZodNumber;
        title: z.ZodString;
        description: z.ZodString;
        readme: z.ZodString;
        bannerUrl: z.ZodNullable<z.ZodString>;
        formats: z.ZodArray<
          z.ZodEnum<{
            issues: "issues";
            recorded: "recorded";
            written: "written";
          }>
        >;
        repoUrl: z.ZodNullable<z.ZodString>;
        isPrivate: z.ZodBoolean;
        legionOnly: z.ZodBoolean;
        endsAt: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
          closed: "closed";
          open: "open";
          pending: "pending";
          rejected: "rejected";
        }>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        closedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        identity: z.ZodNullable<
          z.ZodObject<
            {
              title: z.ZodString;
              description: z.ZodNullable<z.ZodString>;
              domain: z.ZodNullable<z.ZodString>;
              repository: z.ZodNullable<z.ZodString>;
              logoUrl: z.ZodNullable<z.ZodString>;
              kind: z.ZodEnum<{
                idea: "idea";
                project: "project";
                result: "result";
                scope: "scope";
              }>;
            },
            z.core.$strip
          >
        >;
        participantCount: z.ZodNumber;
        participantPreview: z.ZodOptional<z.ZodArray<z.ZodString>>;
        feedbackCount: z.ZodOptional<z.ZodNumber>;
        canManage: z.ZodOptional<z.ZodBoolean>;
        projectVerifiedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      BAD_REQUEST: {
        readonly status: 400;
        readonly data: z.ZodObject<
          {
            invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            validationErrors: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strip
                >
              >
            >;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  listRoundCredits: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          roundId: z.ZodString;
          builderAccountId: z.ZodString;
          projectSlug: z.ZodString;
          roundTitle: z.ZodString;
          contributedMeaningfully: z.ZodBoolean;
          summary: z.ZodNullable<z.ZodString>;
          writtenCount: z.ZodNumber;
          recordedCount: z.ZodNumber;
          createdAt: z.ZodString;
        },
        z.core.$strip
      >
    >,
    {
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  getBuilderRounds: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        accountId: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodArray<
      z.ZodObject<
        {
          roundId: z.ZodString;
          roundTitle: z.ZodString;
          projectSlug: z.ZodString;
          repoUrl: z.ZodNullable<z.ZodString>;
          issuesUrl: z.ZodNullable<z.ZodString>;
          contributedMeaningfully: z.ZodBoolean;
          summary: z.ZodNullable<z.ZodString>;
          writtenCount: z.ZodNumber;
          recordedCount: z.ZodNumber;
          closedAt: z.ZodString;
          creditedAt: z.ZodString;
        },
        z.core.$strip
      >
    >,
    object
  >;
  getRoundEndorsements: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        roundIds: z.ZodArray<z.ZodString>;
      },
      z.core.$strip
    >,
    z.ZodRecord<
      z.ZodString,
      z.ZodObject<
        {
          eventId: z.ZodString;
          totalCount: z.ZodNumber;
        },
        z.core.$strip
      >
    >,
    object
  >;
  getBuilderActivity: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        accountId: z.ZodString;
        limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
      },
      z.core.$strip
    >,
    z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          source: z.ZodString;
          sourceDisplayName: z.ZodString;
          type: z.ZodString;
          timestamp: z.ZodString;
          payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        },
        z.core.$strip
      >
    >,
    object
  >;
  searchProjects: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        query: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        available: z.ZodBoolean;
        results: z.ZodArray<
          z.ZodObject<
            {
              id: z.ZodString;
              slug: z.ZodString;
              title: z.ZodString;
              description: z.ZodPipe<
                z.ZodOptional<z.ZodNullable<z.ZodString>>,
                z.ZodTransform<string | null, string | null | undefined>
              >;
              kind: z.ZodEnum<{
                idea: "idea";
                project: "project";
                result: "result";
                scope: "scope";
              }>;
              status: z.ZodEnum<{
                active: "active";
                archived: "archived";
                paused: "paused";
              }>;
              visibility: z.ZodEnum<{
                private: "private";
                public: "public";
                unlisted: "unlisted";
              }>;
              domain: z.ZodPipe<
                z.ZodOptional<z.ZodNullable<z.ZodString>>,
                z.ZodTransform<string | null, string | null | undefined>
              >;
              repository: z.ZodPipe<
                z.ZodOptional<z.ZodNullable<z.ZodString>>,
                z.ZodTransform<string | null, string | null | undefined>
              >;
              logoUrl: z.ZodPipe<
                z.ZodOptional<z.ZodNullable<z.ZodString>>,
                z.ZodTransform<string | null, string | null | undefined>
              >;
            },
            z.core.$strip
          >
        >;
      },
      z.core.$strip
    >,
    object
  >;
  getTelegramTip: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        accountId: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        handle: z.ZodNullable<z.ZodString>;
        source: z.ZodNullable<
          z.ZodEnum<{
            "near-social": "near-social";
            nearbuilders: "nearbuilders";
          }>
        >;
        available: z.ZodBoolean;
        message: z.ZodNullable<z.ZodString>;
        shareUrl: z.ZodNullable<z.ZodString>;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
    }
  >;
  getProjectSearchStatus: import("@orpc/contract").ProcedureContract<
    import("@orpc/contract").InitialInputSchema,
    z.ZodObject<
      {
        enabled: z.ZodBoolean;
      },
      z.core.$strip
    >,
    object
  >;
  listPublicProjects: import("@orpc/contract").ProcedureContract<
    import("@orpc/contract").InitialInputSchema,
    z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          slug: z.ZodString;
          name: z.ZodString;
          ownerOrgId: z.ZodNullable<z.ZodString>;
          managingTeamId: z.ZodNullable<z.ZodString>;
          nearbuildersProjectId: z.ZodNullable<z.ZodString>;
          contact: z.ZodNullable<z.ZodString>;
          status: z.ZodEnum<{
            approved: "approved";
            pending: "pending";
            rejected: "rejected";
          }>;
          approvedAt: z.ZodNullable<z.ZodString>;
          rejectedAt: z.ZodNullable<z.ZodString>;
          rejectionReason: z.ZodNullable<z.ZodString>;
          verifiedAt: z.ZodNullable<z.ZodString>;
          verifiedByAccountId: z.ZodNullable<z.ZodString>;
          createdAt: z.ZodString;
          updatedAt: z.ZodString;
          identity: z.ZodNullable<
            z.ZodObject<
              {
                title: z.ZodString;
                description: z.ZodNullable<z.ZodString>;
                domain: z.ZodNullable<z.ZodString>;
                repository: z.ZodNullable<z.ZodString>;
                logoUrl: z.ZodNullable<z.ZodString>;
                kind: z.ZodEnum<{
                  idea: "idea";
                  project: "project";
                  result: "result";
                  scope: "scope";
                }>;
              },
              z.core.$strip
            >
          >;
          rounds: z.ZodArray<
            z.ZodObject<
              {
                id: z.ZodString;
                ownerAccountId: z.ZodString;
                title: z.ZodString;
                status: z.ZodEnum<{
                  closed: "closed";
                  open: "open";
                  pending: "pending";
                  rejected: "rejected";
                }>;
                projectRoundNumber: z.ZodNumber;
                endsAt: z.ZodNullable<z.ZodString>;
              },
              z.core.$strip
            >
          >;
        },
        z.core.$strip
      >
    >,
    object
  >;
  getProjectBySlug: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        slug: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
        ownerOrgId: z.ZodNullable<z.ZodString>;
        managingTeamId: z.ZodNullable<z.ZodString>;
        nearbuildersProjectId: z.ZodNullable<z.ZodString>;
        contact: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
          approved: "approved";
          pending: "pending";
          rejected: "rejected";
        }>;
        approvedAt: z.ZodNullable<z.ZodString>;
        rejectedAt: z.ZodNullable<z.ZodString>;
        rejectionReason: z.ZodNullable<z.ZodString>;
        verifiedAt: z.ZodNullable<z.ZodString>;
        verifiedByAccountId: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        identity: z.ZodNullable<
          z.ZodObject<
            {
              title: z.ZodString;
              description: z.ZodNullable<z.ZodString>;
              domain: z.ZodNullable<z.ZodString>;
              repository: z.ZodNullable<z.ZodString>;
              logoUrl: z.ZodNullable<z.ZodString>;
              kind: z.ZodEnum<{
                idea: "idea";
                project: "project";
                result: "result";
                scope: "scope";
              }>;
            },
            z.core.$strip
          >
        >;
        rounds: z.ZodArray<
          z.ZodObject<
            {
              id: z.ZodString;
              ownerAccountId: z.ZodString;
              title: z.ZodString;
              status: z.ZodEnum<{
                closed: "closed";
                open: "open";
                pending: "pending";
                rejected: "rejected";
              }>;
              projectRoundNumber: z.ZodNumber;
              endsAt: z.ZodNullable<z.ZodString>;
            },
            z.core.$strip
          >
        >;
        canManage: z.ZodBoolean;
      },
      z.core.$strip
    >,
    {
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  inviteTesters: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        id: z.ZodString;
        fromRoundId: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        recipients: z.ZodNumber;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      BAD_REQUEST: {
        readonly status: 400;
        readonly data: z.ZodObject<
          {
            invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            validationErrors: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strip
                >
              >
            >;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  getBuilderStanding: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        accountId: z.ZodString;
      },
      z.core.$strip
    >,
    z.ZodNullable<
      z.ZodObject<
        {
          accountId: z.ZodString;
          rank: z.ZodNumber;
          score: z.ZodNumber;
          eventCount: z.ZodNumber;
        },
        z.core.$strip
      >
    >,
    object
  >;
  getLeaderboard: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        period: z.ZodDefault<
          z.ZodEnum<{
            "all-time": "all-time";
            monthly: "monthly";
            weekly: "weekly";
          }>
        >;
        limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        period: z.ZodEnum<{
          "all-time": "all-time";
          monthly: "monthly";
          weekly: "weekly";
        }>;
        configured: z.ZodBoolean;
        available: z.ZodBoolean;
        data: z.ZodArray<
          z.ZodObject<
            {
              rank: z.ZodNumber;
              actor: z.ZodString;
              score: z.ZodNumber;
              eventCount: z.ZodNumber;
            },
            z.core.$strip
          >
        >;
      },
      z.core.$strip
    >,
    object
  >;
  listFailedActivityEvents: import("@orpc/contract").ProcedureContract<
    import("@orpc/contract").InitialInputSchema,
    z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodUUID;
          operation: z.ZodEnum<{
            emit: "emit";
            retract: "retract";
          }>;
          eventType: z.ZodNullable<z.ZodString>;
          actor: z.ZodNullable<z.ZodString>;
          payload: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
          targetEventId: z.ZodNullable<z.ZodString>;
          reason: z.ZodNullable<z.ZodString>;
          idempotencyKey: z.ZodString;
          subjectKind: z.ZodNullable<z.ZodString>;
          subjectId: z.ZodNullable<z.ZodString>;
          status: z.ZodEnum<{
            cancelled: "cancelled";
            failed: "failed";
            pending: "pending";
            sent: "sent";
          }>;
          attempts: z.ZodNumber;
          lastError: z.ZodNullable<z.ZodString>;
          nextAttemptAt: z.ZodISODateTime;
          eventId: z.ZodNullable<z.ZodString>;
          createdAt: z.ZodISODateTime;
          sentAt: z.ZodNullable<z.ZodISODateTime>;
        },
        z.core.$strip
      >
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  retryFailedActivityEvents: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        ids: z.ZodArray<z.ZodUUID>;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        retried: z.ZodNumber;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      BAD_REQUEST: {
        readonly status: 400;
        readonly data: z.ZodObject<
          {
            invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            validationErrors: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strip
                >
              >
            >;
          },
          z.core.$strip
        >;
      };
    }
  >;
  backfillAcceptedFeedback: import("@orpc/contract").ProcedureContract<
    import("@orpc/contract").InitialInputSchema,
    z.ZodObject<
      {
        queued: z.ZodNumber;
        skipped: z.ZodNumber;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  getActivityOutboxDepth: import("@orpc/contract").ProcedureContract<
    import("@orpc/contract").InitialInputSchema,
    z.ZodObject<
      {
        byStatus: z.ZodRecord<z.ZodString, z.ZodNumber>;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
    }
  >;
  testError: import("@orpc/contract").ProcedureContract<
    z.ZodObject<
      {
        kind: z.ZodEnum<{
          bad_request: "bad_request";
          conflict: "conflict";
          forbidden: "forbidden";
          internal: "internal";
          not_found: "not_found";
          unauthorized: "unauthorized";
        }>;
      },
      z.core.$strip
    >,
    z.ZodObject<
      {
        ok: z.ZodLiteral<true>;
      },
      z.core.$strip
    >,
    {
      UNAUTHORIZED: {
        readonly status: 401;
        readonly data: z.ZodObject<
          {
            apiKeyProvided: z.ZodBoolean;
            provider: z.ZodOptional<z.ZodString>;
            authType: z.ZodOptional<
              z.ZodEnum<{
                apiKey: "apiKey";
                oauth: "oauth";
                token: "token";
              }>
            >;
          },
          z.core.$strip
        >;
      };
      FORBIDDEN: {
        readonly status: 403;
        readonly data: z.ZodObject<
          {
            requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            action: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      NOT_FOUND: {
        readonly status: 404;
        readonly data: z.ZodObject<
          {
            resource: z.ZodOptional<z.ZodString>;
            resourceId: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      };
      BAD_REQUEST: {
        readonly status: 400;
        readonly data: z.ZodObject<
          {
            invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
            validationErrors: z.ZodOptional<
              z.ZodArray<
                z.ZodObject<
                  {
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                  },
                  z.core.$strip
                >
              >
            >;
          },
          z.core.$strip
        >;
      };
    }
  >;
};
export type ContractType = typeof contract;
