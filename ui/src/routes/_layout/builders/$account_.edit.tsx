import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { Profile } from "better-near-auth";
import { ArrowLeft, Loader2, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { BuilderFormFields, type BuilderFormValues, parseSkills } from "@/components/builder-form";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { composeLinks, initialFormLinks } from "@/lib/social-links";

export const Route = createFileRoute("/_layout/builders/$account_/edit")({
  head: ({ params }) => ({
    meta: [
      { title: `Edit ${params.account} | NEAR Builders` },
      { name: "description", content: "Edit your builder profile." },
    ],
  }),
  component: EditBuilderProfilePage,
});

function EditBuilderProfilePage() {
  const { account } = Route.useParams();
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const { data: session, isLoading: sessionLoading } = useQuery(
    sessionQueryOptions(auth, undefined),
  );
  const nearAccountId = auth.near.getAccountId();
  const isAuthenticated = Boolean(session?.user && !session.user.isAnonymous);

  const builderQuery = useQuery({
    queryKey: ["builder", account],
    queryFn: () => apiClient.getBuilder({ nearAccount: account }),
    retry: false,
  });
  const builder = builderQuery.data?.data;

  const profileQuery = useQuery<Profile | null>({
    queryKey: ["near-profile", account],
    queryFn: async () => {
      const res = await auth.near.getProfile(account);
      return res.data || null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const canEdit = Boolean(nearAccountId) && nearAccountId?.toLowerCase() === account.toLowerCase();

  if (sessionLoading || builderQuery.isLoading || profileQuery.isLoading) {
    return (
      <CenteredState
        account={account}
        content={<Loader2 className="size-6 animate-spin text-muted-foreground" />}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <Notice
        account={account}
        title="Sign in to edit"
        body="Connect your NEAR wallet to edit this builder profile."
        action={
          <Button asChild className="rounded-full px-6">
            <Link to="/login" search={{ redirect: `/builders/${account}/edit` }}>
              Connect wallet
            </Link>
          </Button>
        }
      />
    );
  }

  if (builderQuery.isError || !builder) {
    return (
      <Notice
        account={account}
        title="Builder not found"
        body="This builder profile doesn't exist or hasn't been approved yet."
      />
    );
  }

  if (!canEdit) {
    return (
      <Notice
        account={account}
        title="Permission needed"
        body="You don't have permission to edit this profile."
      />
    );
  }

  return (
    <EditForm account={account} builder={builder} socialLinktree={profileQuery.data?.linktree} />
  );
}

function EditForm({
  account,
  builder,
  socialLinktree,
}: {
  account: string;
  builder: NonNullable<Awaited<ReturnType<ReturnType<typeof useApiClient>["getBuilder"]>>["data"]>;
  socialLinktree?: Record<string, unknown> | null;
}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [confirmWithdrawOpen, setConfirmWithdrawOpen] = useState(false);

  const invalidateBuilderQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["builder", account] });
    queryClient.invalidateQueries({ queryKey: ["builders"] });
    queryClient.invalidateQueries({ queryKey: ["my-builder-profile"] });
  };

  const withdrawMutation = useMutation({
    mutationFn: (withdrawn: boolean) =>
      withdrawn ? apiClient.withdrawMyBuilderProfile({}) : apiClient.restoreMyBuilderProfile({}),
    onSuccess: (_result, withdrawn) => {
      toast.success(withdrawn ? "Profile withdrawn" : "Profile is listed again");
      setConfirmWithdrawOpen(false);
      invalidateBuilderQueries();
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update your profile"),
  });

  const updateMutation = useMutation({
    mutationFn: (values: BuilderFormValues) =>
      apiClient.updateBuilderProfile({
        nearAccount: account,
        name: values.name.trim() || undefined,
        bio: values.bio,
        location: values.location,
        skills: parseSkills(values.skills),
        links: composeLinks(values.links, builder.links),
      }),
    onSuccess: () => {
      toast.success("Profile updated");
      invalidateBuilderQueries();
      navigate({ to: "/builders/$account", params: { account } });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save"),
  });

  const form = useForm({
    defaultValues: {
      name: builder.name ?? "",
      bio: builder.bio ?? "",
      skills: builder.skills.join(", "),
      location: builder.location ?? "",
      links: initialFormLinks(builder.links, socialLinktree),
    } satisfies BuilderFormValues,
    canSubmitWhenInvalid: true,
    onSubmit: async ({ value }) => {
      await updateMutation.mutateAsync(value);
    },
    onSubmitInvalid: () => {
      toast.error("Please fix the highlighted fields before saving.");
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <Link
          to="/builders/$account"
          params={{ account }}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Back to profile
        </Link>
        <h1 className="mb-2 text-4xl font-black tracking-tight text-foreground">Edit profile</h1>
        <p className="leading-relaxed text-muted-foreground">
          Update your builder profile. Profile and background images are managed on NEAR Social.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-6 rounded-2xl border border-border bg-card p-6 sm:p-8"
      >
        <BuilderFormFields form={form} />

        <div className="flex gap-3 border-t border-border pt-2">
          <form.Subscribe selector={(s) => ({ isSubmitting: s.isSubmitting })}>
            {({ isSubmitting }) => (
              <Button
                type="submit"
                disabled={isSubmitting || updateMutation.isPending}
                className="rounded-full px-6"
              >
                {updateMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                {updateMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            )}
          </form.Subscribe>
          <Button asChild variant="ghost" className="text-muted-foreground">
            <Link to="/builders/$account" params={{ account }}>
              <X size={14} />
              Cancel
            </Link>
          </Button>
        </div>
      </form>

      <section className="mt-8 rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h2 className="text-lg font-bold text-foreground">Withdraw your profile</h2>
        {builder.withdrawnAt ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Your profile is withdrawn. It doesn't appear in the public builders directory or
              search, and its public page shows as not found. Nothing is deleted and you can list it
              again at any time.
            </p>
            <Button
              variant="outline"
              className="mt-4 rounded-full"
              onClick={() => withdrawMutation.mutate(false)}
              disabled={withdrawMutation.isPending}
            >
              {withdrawMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              List my profile again
            </Button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Take your profile out of the public builders directory and search. Nothing is deleted
              and you can list it again at any time. To permanently delete your profile and
              associated records, contact an admin.
            </p>
            <Button
              variant="outline"
              className="mt-4 rounded-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmWithdrawOpen(true)}
              disabled={withdrawMutation.isPending}
            >
              Withdraw my profile
            </Button>
          </>
        )}
      </section>

      <ConfirmDialog
        open={confirmWithdrawOpen}
        onOpenChange={setConfirmWithdrawOpen}
        title="Withdraw your builder profile?"
        description="Your profile will be removed from the public directory and search immediately. You can list it again from this page at any time."
        confirmLabel="Withdraw profile"
        cancelLabel="Keep listed"
        variant="destructive"
        isPending={withdrawMutation.isPending}
        onConfirm={() => withdrawMutation.mutate(true)}
      />
    </div>
  );
}

function CenteredState({ account, content }: { account: string; content: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <BackLink account={account} />
      <div className="flex items-center justify-center py-20">{content}</div>
    </div>
  );
}

function Notice({
  account,
  title,
  body,
  action,
}: {
  account: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <BackLink account={account} />
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <h1 className="mb-2 text-2xl font-black text-foreground">{title}</h1>
        <p className="mx-auto mb-8 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
        {action ?? (
          <Button asChild variant="outline" className="rounded-full px-6">
            <Link to="/builders/$account" params={{ account }}>
              Back to profile
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function BackLink({ account }: { account: string }) {
  return (
    <div className="mb-8">
      <Link
        to="/builders/$account"
        params={{ account }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={14} />
        Back to profile
      </Link>
    </div>
  );
}
