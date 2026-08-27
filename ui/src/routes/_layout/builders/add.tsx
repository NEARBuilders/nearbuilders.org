import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  countrySuggestions,
  locationError,
  normalizeLocation,
  normalizeSkills,
  parseSkillList,
  skillSuggestions,
} from "@everything-dev/builders-plugin/builder-tags";
import { ArrowLeft, Check, Hammer, Loader2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { SuggestionInput } from "@/components/builder-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type SearchParams = {
  intent?: "self";
};

export const Route = createFileRoute("/_layout/builders/add")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    intent: search.intent === "self" ? "self" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Nominate a Builder | NEAR Builders" },
      {
        name: "description",
        content: "Nominate a builder to join the NEAR Builders directory.",
      },
    ],
  }),
  component: NominateBuilderPage,
});

function NominateBuilderPage() {
  const { intent } = Route.useSearch();
  const auth = useAuthClient();
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [nearPending, setNearPending] = useState(false);
  const { data: session, isLoading: sessionLoading } = useQuery(
    sessionQueryOptions(auth, undefined),
  );
  const nearAccountId = auth.near.getAccountId();
  const isAuthenticated = Boolean(session?.user && !session.user.isAnonymous);
  const requestedSelfRegistration = intent === "self";

  const {
    data: ownBuilderProfileResult,
    isLoading: ownBuilderProfileLoading,
    isError: ownBuilderProfileError,
    isFetching: ownBuilderProfileFetching,
    refetch: refetchOwnBuilderProfile,
  } = useQuery({
    queryKey: ["my-builder-profile", session?.user?.id, nearAccountId],
    queryFn: () => apiClient.getMyBuilderProfile({}),
    enabled: requestedSelfRegistration && isAuthenticated && Boolean(nearAccountId),
  });

  const {
    data: ownBuilderProposalResult,
    isLoading: ownBuilderProposalLoading,
    isError: ownBuilderProposalError,
    isFetching: ownBuilderProposalFetching,
    refetch: refetchOwnBuilderProposal,
  } = useQuery({
    queryKey: ["builder-proposals", nearAccountId, "pending"],
    queryFn: () =>
      apiClient.getProposals({
        pluginId: "builders",
        entityId: nearAccountId!,
        reviewStatus: "pending",
        limit: 1,
      }),
    enabled: requestedSelfRegistration && isAuthenticated && Boolean(nearAccountId),
  });

  const [nomineeAccount, setNomineeAccount] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [skillsRaw, setSkillsRaw] = useState("");
  const [location, setLocation] = useState("");

  const hasActiveBuilderProfile =
    Boolean(ownBuilderProfileResult?.data) || Boolean(ownBuilderProposalResult?.data.length);
  const isBuilderProfileLoading =
    requestedSelfRegistration &&
    isAuthenticated &&
    Boolean(nearAccountId) &&
    (ownBuilderProfileLoading || ownBuilderProposalLoading);
  const isBuilderProfileError =
    requestedSelfRegistration &&
    isAuthenticated &&
    Boolean(nearAccountId) &&
    !hasActiveBuilderProfile &&
    (ownBuilderProfileError || ownBuilderProposalError);
  const isBuilderProfileRetrying = ownBuilderProfileFetching || ownBuilderProposalFetching;
  const isSelfRegistration = requestedSelfRegistration && !hasActiveBuilderProfile;
  const nearAccount = isSelfRegistration ? (nearAccountId ?? "") : nomineeAccount;
  const isSelfNomination = nearAccountId
    ? nearAccount.trim().toLowerCase() === nearAccountId.trim().toLowerCase()
    : false;
  const redirectPath = requestedSelfRegistration ? "/builders/add?intent=self" : "/builders/add";

  const connectNear = async () => {
    setNearPending(true);
    try {
      await auth.near.link({
        onSuccess: async () => {
          const { data: freshSession } = await auth.getSession();
          if (freshSession) {
            queryClient.setQueryData(["session"], freshSession);
          }
          await queryClient.invalidateQueries({ queryKey: ["session"] });
          toast.success("NEAR account connected");
        },
        onError: (error: { message?: string }) => {
          toast.error(error.message || "Could not connect your NEAR account");
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not connect your NEAR account");
    } finally {
      setNearPending(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-muted">
            <UserPlus className="size-7 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground mb-2">
            {isSelfRegistration ? "Join as a builder" : "Nominate a builder"}
          </h1>
          <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto leading-relaxed">
            {isSelfRegistration
              ? "Connect your NEAR wallet to submit your profile for the NEAR Builders directory."
              : "Connect your NEAR wallet to nominate a builder for the NEAR Builders directory."}
          </p>
          <div className="flex flex-col gap-3 items-center">
            <Button
              asChild
              size="lg"
              className="rounded-full px-8 h-12 bg-brand-green hover:bg-brand-green/90 text-black font-bold shadow-lg shadow-brand-green/20"
            >
              <Link to="/login" search={{ redirect: redirectPath }}>
                Connect wallet to continue
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
              <Link to="/builders" search={undefined}>
                Browse builders
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!nearAccountId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-muted">
            <Hammer className="size-7 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground mb-2">
            Link your NEAR wallet
          </h1>
          <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto leading-relaxed">
            {isSelfRegistration
              ? "You need a linked NEAR account to submit your builder profile."
              : "You need a linked NEAR account to nominate a builder."}
          </p>
          <Button
            onClick={() => void connectNear()}
            disabled={nearPending}
            size="lg"
            className="rounded-full px-8 h-12 bg-brand-cyan text-black font-bold"
          >
            {nearPending ? "Connecting…" : "Connect NEAR wallet"}
          </Button>
        </div>
      </div>
    );
  }

  if (isBuilderProfileLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (isBuilderProfileError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-muted">
            <Hammer className="size-7 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground mb-2">
            Profile status unavailable
          </h1>
          <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto leading-relaxed">
            We couldn't check your builder profile. Try again before submitting.
          </p>
          <Button
            onClick={() => {
              void Promise.all([refetchOwnBuilderProfile(), refetchOwnBuilderProposal()]);
            }}
            disabled={isBuilderProfileRetrying}
            size="lg"
            className="rounded-full px-8 h-12"
          >
            {isBuilderProfileRetrying && <Loader2 className="size-4 animate-spin" />}
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <Link
          to="/builders"
          search={undefined}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft size={14} />
          All builders
        </Link>
        <h1 className="text-4xl font-black tracking-tight text-foreground mb-2">
          {isSelfNomination ? "Join as a builder" : "Nominate a builder"}
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          {isSelfNomination
            ? "Submit your profile for the NEAR Builders directory. All submissions are reviewed by admins."
            : "Nominate someone to create or support their pending NEAR Builders profile."}
        </p>
      </div>

      <NominationForm
        nearAccount={nearAccount}
        setNearAccount={setNomineeAccount}
        name={name}
        setName={setName}
        bio={bio}
        setBio={setBio}
        skillsRaw={skillsRaw}
        setSkillsRaw={setSkillsRaw}
        location={location}
        setLocation={setLocation}
        isSelfNomination={isSelfNomination}
        lockNearAccount={isSelfRegistration}
        apiClient={apiClient}
      />
    </div>
  );
}

function NominationForm({
  nearAccount,
  setNearAccount,
  name,
  setName,
  bio,
  setBio,
  skillsRaw,
  setSkillsRaw,
  location,
  setLocation,
  isSelfNomination,
  lockNearAccount,
  apiClient,
}: {
  nearAccount: string;
  setNearAccount: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  bio: string;
  setBio: (v: string) => void;
  skillsRaw: string;
  setSkillsRaw: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  isSelfNomination: boolean;
  lockNearAccount: boolean;
  apiClient: ReturnType<typeof useApiClient>;
}) {
  const [submissionOutcome, setSubmissionOutcome] = useState<
    "profile" | "nomination" | "already-nominated" | null
  >(null);
  const skills = normalizeSkills(skillsRaw);
  const currentSkillToken = skillsRaw.split(",").pop()?.trim() ?? "";
  const { data: existingSkills = [] } = useQuery({
    queryKey: ["builder-skill-tags"],
    queryFn: async () => {
      const result = await apiClient.listBuilders({ limit: 100 });
      return result.data.flatMap((builder) => builder.skills);
    },
    staleTime: 60_000,
  });

  const nominateMutation = useMutation({
    mutationFn: async () => {
      if (isSelfNomination) {
        await apiClient.submitBuilderProfile({
          name: name.trim(),
          bio: bio.trim(),
          skills,
          location: normalizeLocation(location) ?? undefined,
        });
        return "profile" as const;
      }
      const result = await apiClient.nominateBuilder({
        nearAccount: nearAccount.trim().toLowerCase(),
        name: name.trim() || undefined,
        bio: bio.trim() || undefined,
        skills,
        location: normalizeLocation(location) ?? undefined,
      });
      return result.data.alreadyNominated
        ? ("already-nominated" as const)
        : ("nomination" as const);
    },
    onSuccess: (outcome) => {
      if (outcome === "already-nominated") {
        toast.info("You've already nominated this builder");
      } else if (outcome === "profile") {
        toast.success("Builder profile submitted for review");
      } else {
        toast.success("Nomination recorded");
      }
      setSubmissionOutcome(outcome);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to submit nomination"),
  });

  if (submissionOutcome) {
    const isProfileSubmission = submissionOutcome === "profile";
    const isRepeatNomination = submissionOutcome === "already-nominated";

    return (
      <div className="rounded-2xl border border-brand-accent bg-brand-accent-light p-10 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-brand-green/20">
          <Check className="size-6 text-brand-green" />
        </div>
        <h2 className="text-2xl font-black text-foreground mb-2">
          {isProfileSubmission
            ? "Application submitted!"
            : isRepeatNomination
              ? "Already nominated"
              : "Nomination recorded!"}
        </h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto leading-relaxed">
          {isProfileSubmission
            ? "Your profile is pending admin review. We'll update the status soon."
            : isRepeatNomination
              ? "You've already nominated this builder."
              : "Your support has been counted. The builder's profile will remain pending until an admin reviews it."}
        </p>
        <div className="flex flex-col gap-2 items-center">
          <Button
            asChild
            className="rounded-full px-8 bg-brand-green hover:bg-brand-green/90 text-black font-bold"
          >
            <Link to="/builders" search={undefined}>
              Browse builders
            </Link>
          </Button>
          {isProfileSubmission && (
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
              <Link to="/dashboard">Go to dashboard</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!nearAccount.trim()) {
          toast.error("NEAR account is required");
          return;
        }
        if (isSelfNomination && (!name.trim() || !bio.trim() || skills.length === 0)) {
          toast.error("Display name, bio, and at least one skill are required");
          return;
        }
        if (location.trim() && locationError(location)) {
          toast.error(locationError(location));
          return;
        }
        nominateMutation.mutate();
      }}
      className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-6"
    >
      <div>
        <label
          htmlFor="field-account"
          className="text-sm font-semibold text-foreground mb-1.5 block"
        >
          NEAR Account <span className="text-destructive">*</span>
        </label>
        <p className="text-xs text-muted-foreground mb-2">
          {isSelfNomination
            ? "This is your linked NEAR account."
            : "The NEAR account of the builder you're nominating."}
        </p>
        <Input
          id="field-account"
          placeholder="example.near"
          value={nearAccount}
          onChange={(e) => setNearAccount(e.target.value)}
          readOnly={lockNearAccount}
          className="font-mono"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label
            htmlFor="field-name"
            className="text-sm font-semibold text-foreground mb-1.5 block"
          >
            Display name
          </label>
          <Input
            id="field-name"
            placeholder="Builder name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
          />
        </div>

        <div>
          <label
            htmlFor="field-location"
            className="text-sm font-semibold text-foreground mb-1.5 block"
          >
            Location
          </label>
          <SuggestionInput
            id="field-location"
            placeholder="Country or City, Country"
            value={location}
            onChange={setLocation}
            suggestions={countrySuggestions(location)}
          />
        </div>
      </div>

      <div>
        <label htmlFor="field-bio" className="text-sm font-semibold text-foreground mb-1.5 block">
          Bio
        </label>
        <Textarea
          id="field-bio"
          placeholder="What do they build? What are they working on?"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={1000}
          rows={4}
        />
      </div>

      <div>
        <label
          htmlFor="field-skills"
          className="text-sm font-semibold text-foreground mb-1.5 block"
        >
          Skills <span className="font-normal text-muted-foreground">(comma-separated)</span>
        </label>
        <SuggestionInput
          id="field-skills"
          placeholder="React, Rust, Smart Contracts…"
          value={skillsRaw}
          onChange={setSkillsRaw}
          suggestions={skillSuggestions(currentSkillToken, existingSkills)}
          onPick={(suggestion) => {
            const parts = parseSkillList(skillsRaw);
            const next = normalizeSkills([...parts.slice(0, -1), suggestion], existingSkills);
            setSkillsRaw(`${next.join(", ")}, `);
          }}
        />
      </div>

      {nominateMutation.isError && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
        >
          {nominateMutation.error instanceof Error
            ? nominateMutation.error.message
            : "Failed to submit. Please try again."}
        </div>
      )}

      <div className="flex gap-3 pt-2 border-t border-border">
        <Button type="submit" disabled={nominateMutation.isPending} className="rounded-full px-6">
          {nominateMutation.isPending && <Loader2 size={14} className="animate-spin" />}
          {isSelfNomination ? "Join as builder" : "Nominate builder"}
        </Button>
        <Button asChild variant="ghost" className="text-muted-foreground">
          <Link to="/builders" search={undefined}>
            Cancel
          </Link>
        </Button>
      </div>
    </form>
  );
}
