import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Navigate, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useAuthClient } from "@/app";
import { Button } from "@/components/ui/button";

type SearchParams = {
  redirect?: string;
};

export const Route = createFileRoute("/_layout/login")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    const { queryClient, authClient } = context;
    const initialSession = context.session;
    const session =
      initialSession ??
      queryClient.getQueryData(sessionQueryOptions(authClient, initialSession).queryKey);

    if (session?.user) {
      const redirectTo = search.redirect?.startsWith("/") ? search.redirect : "/home";
      throw redirect({ to: redirectTo, search: {} });
    }
  },
  loader: ({ context }) => {
    const initialSession = context.session;
    void context.queryClient.prefetchQuery(sessionQueryOptions(context.authClient, initialSession));
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuthClient();
  const { data: session } = useQuery(sessionQueryOptions(auth, undefined));
  const { redirect } = Route.useSearch();
  const queryClient = useQueryClient();

  const [nearPending, setNearPending] = useState(false);
  const [anonPending, setAnonPending] = useState(false);

  const handleSuccess = async (message: string) => {
    const redirectTo = redirect?.startsWith("/") ? redirect : "/home";
    toast.success(message);
    const { data: freshSession } = await auth.getSession();
    if (freshSession) {
      queryClient.setQueryData(["session"], freshSession);
    }
    await queryClient.invalidateQueries({ queryKey: ["session"] });
    navigate({ to: redirectTo, replace: true, search: {} });
  };

  const handleError = (error: { code?: string; message?: string } | Error) => {
    const code = "code" in error ? error.code : undefined;
    const message = "message" in error ? error.message : "Failed to sign in";
    if (code === "UNAUTHORIZED_NONCE_REPLAY") toast.error("Sign-in already used");
    else if (code === "UNAUTHORIZED_INVALID_SIGNATURE") toast.error("Invalid signature");
    else if (code === "SIGNER_NOT_AVAILABLE") toast.error("NEAR wallet not available");
    else toast.error(message || "Failed to sign in");
  };

  const handleNear = async () => {
    setNearPending(true);
    await auth.signIn.near({
      onSuccess: async () => {
        setNearPending(false);
        await handleSuccess("Signed in with NEAR");
      },
      onError: (error: { code?: string; message?: string }) => {
        setNearPending(false);
        handleError(error);
      },
    });
  };

  const handleAnonymous = async () => {
    setAnonPending(true);
    try {
      await auth.signIn.anonymous({
        fetchOptions: {
          onSuccess: async () => {
            setAnonPending(false);
            await handleSuccess("Started anonymous session");
          },
          onError: (ctx: { error?: { message?: string } }) => {
            setAnonPending(false);
            handleError(new Error(ctx.error?.message || "Anonymous sign in failed"));
          },
        },
      });
    } catch {
      setAnonPending(false);
    }
  };

  if (session?.user) {
    const redirectTo = redirect?.startsWith("/") ? redirect : "/home";
    return <Navigate to={redirectTo} replace search={{}} />;
  }

  const isPending = nearPending || anonPending;

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 animate-fade-in">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center size-12 rounded-full bg-brand-green/10 mb-4">
            <span className="text-2xl font-black text-brand-green">●</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground mb-2">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            Connect your NEAR wallet to access your workspace
          </p>
        </div>

        <div className="space-y-3 animate-fade-in-up">
          <Button
            onClick={handleNear}
            disabled={isPending}
            size="lg"
            className="w-full rounded-full h-12 text-sm font-bold bg-brand-green hover:bg-brand-green/90 text-black shadow-md shadow-brand-green/20 hover:shadow-lg hover:shadow-brand-green/30 transition-all"
          >
            {nearPending ? "Connecting…" : "Connect with NEAR"}
          </Button>

          <div className="relative flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Button
            variant="ghost"
            onClick={handleAnonymous}
            disabled={isPending}
            size="lg"
            className="w-full rounded-full h-12 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
          >
            {anonPending ? "Starting…" : "Continue anonymously"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-8 leading-relaxed">
          Anonymous sessions don't persist after sign out.
          <br />
          Connect a wallet to save your work.
        </p>
      </div>
    </div>
  );
}
