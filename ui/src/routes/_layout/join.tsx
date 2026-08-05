import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { Profile } from "better-near-auth";
import { AlertTriangle, Check, CircleCheck, Loader2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { BuilderFormFields, type BuilderFormValues, parseSkills } from "@/components/builder-form";
import { Button } from "@/components/ui/button";
import { composeLinks, initialFormLinks } from "@/lib/social-links";
import {
  initializeNominationToken,
  NOMINATION_STORAGE_KEY,
  shouldClearNominationToken,
} from "@/lib/telegram-nomination";

type NominationStatus = "ready" | "submitted" | "invalid" | "error";

type JoinSearch = {
  nomination?: string;
};

export const Route = createFileRoute("/_layout/join")({
  validateSearch: (search: Record<string, unknown>): JoinSearch => {
    return {
      nomination: typeof search.nomination === "string" ? search.nomination : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Join NEAR Builders" },
      {
        name: "description",
        content: "Create your NEAR builder profile.",
      },
      {
        name: "referrer",
        content: "no-referrer",
      },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const auth = useAuthClient();
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: Route.fullPath });
  const { nomination } = Route.useSearch();
  const [nearPending, setNearPending] = useState(false);
  const [nominationToken, setNominationToken] = useState<string | null>(null);
  const [nominationInitialized, setNominationInitialized] = useState(false);

  useEffect(() => {
    const state = initializeNominationToken(
      nomination,
      sessionStorage.getItem(NOMINATION_STORAGE_KEY),
    );
    if (state.capturedToken) {
      sessionStorage.setItem(NOMINATION_STORAGE_KEY, state.capturedToken);
    }
    if (state.shouldCleanUrl) {
      void navigate({ to: "/join", search: {}, replace: true });
    }
    setNominationToken(state.token);
    setNominationInitialized(true);
  }, [navigate, nomination]);

  const sessionQuery = useQuery(sessionQueryOptions(auth, undefined));
  const nominationQuery = useQuery({
    queryKey: ["telegram-nomination", nominationToken],
    queryFn: () => apiClient.builders.resolveTelegramNomination({ token: nominationToken! }),
    enabled: nominationInitialized && Boolean(nominationToken),
    retry: false,
  });

  useEffect(() => {
    if (shouldClearNominationToken(nominationQuery.data?.status)) {
      sessionStorage.removeItem(NOMINATION_STORAGE_KEY);
    }
  }, [nominationQuery.data?.status]);

  const session = sessionQuery.data;
  const isSignedIn = Boolean(session?.user && !session.user.isAnonymous);
  const nearAccountId = auth.near.getAccountId();
  const nominationAttached = nominationQuery.data?.status === "ready";
  const nominationStatus: NominationStatus | undefined = nominationQuery.isError
    ? "error"
    : nominationQuery.data?.status;
  const flowReady =
    nominationInitialized &&
    (!nominationToken || nominationQuery.isSuccess || nominationQuery.isError);

  const existingProfileQuery = useQuery({
    queryKey: ["my-builder-profile"],
    queryFn: () => apiClient.getMyBuilderProfile({}),
    enabled: flowReady && isSignedIn && Boolean(nearAccountId),
    retry: false,
  });

  const pendingProposalQuery = useQuery({
    queryKey: ["proposals", "builders", nearAccountId, "pending"],
    queryFn: () =>
      apiClient.getProposals({
        pluginId: "builders",
        entityId: nearAccountId!,
        reviewStatus: "pending",
        limit: 1,
      }),
    enabled: flowReady && isSignedIn && Boolean(nearAccountId),
    retry: false,
  });

  const profileQuery = useQuery<Profile | null>({
    queryKey: ["near-profile", nearAccountId],
    queryFn: async () => {
      const response = await auth.near.getProfile(nearAccountId!);
      return response.data || null;
    },
    enabled: flowReady && isSignedIn && Boolean(nearAccountId),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const connectNear = async () => {
    setNearPending(true);
    try {
      await auth.signIn.near({
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

  if (!nominationInitialized || (nominationToken && nominationQuery.isLoading)) {
    return <LoadingState />;
  }

  if (sessionQuery.isLoading) {
    return <LoadingState />;
  }

  if (!isSignedIn || !nearAccountId) {
    return (
      <JoinShell>
        <NominationNotice status={nominationStatus} attached={nominationAttached} />
        <h1 className="text-3xl font-black tracking-tight text-foreground">Connect your account</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Connect the NEAR account that should appear on your builder profile.
        </p>
        <Button
          type="button"
          size="lg"
          onClick={connectNear}
          disabled={nearPending}
          className="mt-8 w-full rounded-full font-bold"
        >
          {nearPending && <Loader2 className="size-4 animate-spin" />}
          {nearPending ? "Connecting…" : "Connect NEAR account"}
        </Button>
      </JoinShell>
    );
  }

  if (existingProfileQuery.isLoading || pendingProposalQuery.isLoading || profileQuery.isLoading) {
    return <LoadingState />;
  }

  const existingProfile = existingProfileQuery.data?.data;
  if (existingProfile) {
    return (
      <JoinShell>
        <CircleCheck className="mx-auto size-8 text-brand-green" />
        <h1 className="mt-5 text-3xl font-black tracking-tight text-foreground">
          Your profile already exists
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This NEAR account is already listed in the builder directory.
        </p>
        <Button asChild size="lg" className="mt-8 w-full rounded-full font-bold">
          <Link to="/builders/$account" params={{ account: existingProfile.nearAccount }}>
            View builder profile
          </Link>
        </Button>
      </JoinShell>
    );
  }

  if ((pendingProposalQuery.data?.data.length ?? 0) > 0) {
    return (
      <JoinShell>
        <CircleCheck className="mx-auto size-8 text-brand-green" />
        <h1 className="mt-5 text-3xl font-black tracking-tight text-foreground">
          Your profile is under review
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          A builder profile for {nearAccountId} has already been submitted.
        </p>
        <Button asChild variant="outline" size="lg" className="mt-8 w-full rounded-full">
          <Link to="/builders" search={undefined}>
            Browse builders
          </Link>
        </Button>
      </JoinShell>
    );
  }

  return (
    <BuilderProfileForm
      accountId={nearAccountId}
      socialProfile={profileQuery.data}
      apiClient={apiClient}
      nominationToken={nominationAttached ? nominationToken : null}
      nominationStatus={nominationStatus}
    />
  );
}

function BuilderProfileForm({
  accountId,
  socialProfile,
  apiClient,
  nominationToken,
  nominationStatus,
}: {
  accountId: string;
  socialProfile: Profile | null | undefined;
  apiClient: ReturnType<typeof useApiClient>;
  nominationToken: string | null;
  nominationStatus?: NominationStatus;
}) {
  const queryClient = useQueryClient();
  const [submitted, setSubmitted] = useState(false);
  const nominationAttached = Boolean(nominationToken);

  const mutation = useMutation({
    mutationFn: (values: BuilderFormValues) =>
      apiClient.submitBuilderProfile({
        nominationToken: nominationToken ?? undefined,
        name: values.name.trim(),
        bio: values.bio.trim(),
        skills: parseSkills(values.skills),
        location: values.location.trim() || undefined,
        links: composeLinks(values.links),
      }),
    onSuccess: async () => {
      sessionStorage.removeItem(NOMINATION_STORAGE_KEY);
      setSubmitted(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["proposals", "builders"] }),
        queryClient.invalidateQueries({ queryKey: ["my-builder-profile"] }),
      ]);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Could not submit your builder profile");
    },
  });

  const form = useForm({
    defaultValues: {
      name: socialProfile?.name ?? "",
      bio: socialProfile?.description ?? "",
      skills: "",
      location: "",
      links: initialFormLinks(undefined, socialProfile?.linktree),
    } satisfies BuilderFormValues,
    canSubmitWhenInvalid: true,
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
    onSubmitInvalid: () => {
      toast.error("Please complete the required fields.");
    },
  });

  if (submitted) {
    return (
      <JoinShell>
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-green/15">
          <Check className="size-6 text-brand-green" />
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-tight text-foreground">
          Profile submitted
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {nominationAttached
            ? "Your Telegram nomination and builder profile are now pending admin review."
            : "Your builder profile is now pending admin review."}
        </p>
        <Button asChild size="lg" className="mt-8 w-full rounded-full font-bold">
          <Link to="/builders" search={undefined}>
            Browse builders
          </Link>
        </Button>
      </JoinShell>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <NominationNotice status={nominationStatus} attached={nominationAttached} />
        <h1 className="mt-5 text-3xl font-black tracking-tight text-foreground">
          Create your builder profile
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Complete the details that will be reviewed for the NEAR Builders directory.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-6 rounded-2xl border border-border bg-card p-6 sm:p-8"
      >
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Connected NEAR account
          </p>
          <p className="mt-1 font-mono text-sm font-semibold text-foreground">{accountId}</p>
        </div>

        <BuilderFormFields form={form} required />

        <div className="border-t border-border pt-4">
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting || mutation.isPending}
                className="w-full rounded-full font-bold"
              >
                {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
                {mutation.isPending ? "Submitting…" : "Submit profile for review"}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </div>
  );
}

function NominationNotice({ status, attached }: { status?: NominationStatus; attached: boolean }) {
  if (attached) {
    return (
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-green/30 bg-brand-green/10 px-3 py-1.5 text-xs font-semibold text-foreground">
        <CircleCheck className="size-4 text-brand-green" />
        Telegram nomination attached
      </div>
    );
  }

  if (!status) return null;

  const message =
    status === "submitted"
      ? "This nomination was already used. You can still join without it."
      : status === "invalid"
        ? "This nomination link is invalid. You can still join without it."
        : "We could not verify this nomination. You can still join without it.";

  return (
    <div className="mb-5 flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-left text-sm text-muted-foreground">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-4">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function JoinShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl items-center px-4 py-12 sm:px-6">
      <div className="w-full rounded-2xl border border-border bg-card p-7 text-center sm:p-10">
        {children}
      </div>
    </div>
  );
}
