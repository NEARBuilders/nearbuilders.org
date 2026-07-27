import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, KeyRound, Mail, Smartphone, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type Passkey, type SessionData, sessionQueryOptions, useAuthClient } from "@/app";
import { Badge, Button, ConfirmDialog } from "@/components";
import { useUserPasskeys } from "@/components/settings-sections";
import { Input } from "@/components/ui/input";
import { nearAccountsOptions, nearAccountsQueryKey } from "@/lib/queries/near-accounts";

export const Route = createFileRoute("/_layout/_authenticated/_dashboard/settings/auth-methods")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: ["passkeys"],
        queryFn: async () => {
          const { data } = await context.authClient.passkey.listUserPasskeys();
          return (data || []) as Passkey[];
        },
        staleTime: 60 * 1000,
      }),
      context.queryClient.ensureQueryData(nearAccountsOptions(context.authClient)),
    ]);
  },
  component: AuthMethodsSettings,
});

function AuthMethodsSettings() {
  const auth = useAuthClient();
  const { data: session } = useQuery<SessionData | null>(sessionQueryOptions(auth));
  const user = session?.user;
  const { data: passkeys = [] } = useUserPasskeys(!!user);
  const { data: nearAccountsData, isLoading: nearAccountsLoading } = useQuery(
    nearAccountsOptions(auth),
  );
  const nearAccounts = nearAccountsData?.accounts ?? [];

  if (!user) return null;

  const linkedMethodCount =
    Number(!!user.email) +
    Number(nearAccounts.length > 0) +
    Number(!!user.phoneNumber) +
    passkeys.length;

  return (
    <div className="space-y-5">
      <AuthOverview linkedMethodCount={linkedMethodCount} passkeyCount={passkeys.length} />
      <div className="grid gap-4 lg:grid-cols-2">
        <EmailMethod user={user} />
        <NearMethod accounts={nearAccounts} isLoading={nearAccountsLoading} />
        <div className="lg:col-span-2">
          <PhoneMethod user={user} />
        </div>
      </div>
      <PasskeysMethod passkeys={passkeys} />
    </div>
  );
}

function AuthOverview({
  linkedMethodCount,
  passkeyCount,
}: {
  linkedMethodCount: number;
  passkeyCount: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold leading-tight text-foreground">Sign-in methods</h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Add at least one recoverable method so this account remains accessible after sign out.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={linkedMethodCount > 0 ? "success" : "destructive"}>
            {linkedMethodCount} linked
          </Badge>
          <Badge variant={passkeyCount > 0 ? "success" : "secondary"}>
            {passkeyCount} passkeys
          </Badge>
        </div>
      </div>
    </div>
  );
}

function EmailMethod({ user }: { user: { email?: string; isAnonymous?: boolean | null } }) {
  return (
    <MethodCard
      icon={Mail}
      title="Email"
      description="Password and recovery access."
      status={user.email ? "Linked" : "Not linked"}
      linked={!!user.email}
    >
      <p className={`text-sm text-muted-foreground${user.email ? " break-all" : ""}`}>
        {user.email ?? "Email login has not been linked for this account yet."}
      </p>
    </MethodCard>
  );
}

function NearMethod({
  accounts,
  isLoading,
}: {
  accounts: Array<{
    accountId: string;
    network: "mainnet" | "testnet";
    isActive: boolean;
  }>;
  isLoading: boolean;
}) {
  const auth = useAuthClient();
  const queryClient = useQueryClient();

  const linkNearMutation = useMutation({
    mutationFn: () =>
      new Promise<void>((resolve, reject) => {
        void auth.near.link({ onSuccess: resolve, onError: reject });
      }),
    onSuccess: () => {
      toast.success("NEAR account linked");
      void queryClient.invalidateQueries({ queryKey: ["session"] });
      void queryClient.invalidateQueries({ queryKey: nearAccountsQueryKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setPrimaryMutation = useMutation({
    mutationFn: async (account: { accountId: string; network: "mainnet" | "testnet" }) => {
      const { error } = await auth.near.setPrimaryAccount(account);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Primary NEAR account updated");
      void queryClient.invalidateQueries({ queryKey: ["session"] });
      void queryClient.invalidateQueries({ queryKey: nearAccountsQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["my-builder-profile"] });
      void queryClient.invalidateQueries({ queryKey: ["projects-personal"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const hasAccounts = accounts.length > 0;

  return (
    <MethodCard
      icon={Wallet}
      title="NEAR Wallets"
      description="Link multiple wallets and choose which account is active."
      status={hasAccounts ? `${accounts.length} linked` : "Not linked"}
      linked={hasAccounts}
    >
      <div className="space-y-3">
        {isLoading ? (
          <div className="rounded-md border border-border bg-muted px-3.5 py-3 text-sm text-muted-foreground">
            Loading linked accounts...
          </div>
        ) : hasAccounts ? (
          <div className="flex flex-col gap-2">
            {accounts.map((account) => (
              <div
                key={`${account.accountId}:${account.network}`}
                className="flex flex-col gap-3 rounded-md border border-border bg-muted px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="break-all font-mono text-xs text-foreground">
                    {account.accountId}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{account.network}</div>
                </div>
                {account.isActive ? (
                  <Badge variant="success">Primary</Badge>
                ) : (
                  <Button
                    type="button"
                    onClick={() => setPrimaryMutation.mutate(account)}
                    disabled={setPrimaryMutation.isPending}
                    variant="outline"
                    size="sm"
                  >
                    Make primary
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-border bg-muted px-3.5 py-3 text-sm text-muted-foreground">
            No NEAR wallets linked yet.
          </div>
        )}
        <Button
          type="button"
          onClick={() => linkNearMutation.mutate()}
          disabled={linkNearMutation.isPending}
          variant="outline"
          size="sm"
        >
          {linkNearMutation.isPending
            ? "Connecting..."
            : hasAccounts
              ? "Link another wallet"
              : "Connect NEAR wallet"}
        </Button>
      </div>
    </MethodCard>
  );
}

function PhoneMethod({
  user,
}: {
  user: { phoneNumber?: string | null; phoneNumberVerified?: boolean | null };
}) {
  const phoneNumber = user.phoneNumber ?? null;

  return (
    <MethodCard
      icon={Smartphone}
      title="Phone"
      description="OTP access when attached."
      status={phoneNumber ? (user.phoneNumberVerified ? "Verified" : "Unverified") : "Available"}
      linked={!!phoneNumber && user.phoneNumberVerified !== false}
    >
      <p className="text-sm text-muted-foreground">
        {phoneNumber ?? "Phone OTP sign-in is available from the login screen."}
      </p>
    </MethodCard>
  );
}

function PasskeysMethod({ passkeys }: { passkeys: Array<{ id: string; name?: string }> }) {
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const [passkeyName, setPasskeyName] = useState("");
  const [passkeyToDelete, setPasskeyToDelete] = useState<{ id: string; name?: string } | null>(
    null,
  );
  const passkeyQueryKey = ["passkeys"] as const;

  const addPasskeyMutation = useMutation({
    mutationFn: async () => {
      const name = passkeyName.trim();
      const { error } = name
        ? await auth.passkey.addPasskey({ name })
        : await auth.passkey.addPasskey();
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setPasskeyName("");
      toast.success("Passkey added");
      queryClient.invalidateQueries({ queryKey: passkeyQueryKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removePasskeyMutation = useMutation({
    mutationFn: async (passkeyId: string) => {
      const { error } = await auth.passkey.deletePasskey({ id: passkeyId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setPasskeyToDelete(null);
      toast.success("Passkey removed");
      queryClient.invalidateQueries({ queryKey: passkeyQueryKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <MethodCard
        icon={KeyRound}
        title="Passkeys"
        description="Register device-based sign-in for faster and safer access."
        status={passkeys.length > 0 ? `${passkeys.length} registered` : "None"}
        linked={passkeys.length > 0}
      >
        <div className="space-y-3">
          {passkeys.length > 0 ? (
            <div className="flex flex-col gap-2">
              {passkeys.map((passkey) => (
                <div
                  key={passkey.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted px-3.5 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {passkey.name || "Passkey"}
                  </span>
                  <Button
                    onClick={() => setPasskeyToDelete(passkey)}
                    disabled={removePasskeyMutation.isPending}
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-border bg-muted px-3.5 py-3 text-sm text-muted-foreground">
              No passkeys registered yet.
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              type="text"
              value={passkeyName}
              onChange={(e) => setPasskeyName(e.target.value)}
              placeholder="Passkey name, e.g. Work laptop"
              className="max-w-sm"
            />
            <Button
              onClick={() => addPasskeyMutation.mutate()}
              disabled={addPasskeyMutation.isPending}
              variant="outline"
              size="sm"
            >
              {addPasskeyMutation.isPending ? "adding..." : "add passkey"}
            </Button>
          </div>
        </div>
      </MethodCard>

      <ConfirmDialog
        open={!!passkeyToDelete}
        onOpenChange={(open: boolean) => {
          if (!open) setPasskeyToDelete(null);
        }}
        title="Remove passkey"
        description={`Remove ${passkeyToDelete?.name || "this passkey"} from your account? You will no longer be able to use it to sign in.`}
        confirmLabel="remove"
        variant="destructive"
        onConfirm={() => {
          if (passkeyToDelete) removePasskeyMutation.mutate(passkeyToDelete.id);
        }}
        isPending={removePasskeyMutation.isPending}
      />
    </>
  );
}

function MethodCard({
  icon: Icon,
  title,
  description,
  status,
  linked,
  children,
}: {
  icon: typeof Mail;
  title: string;
  description: string;
  status: string;
  linked: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="text-base font-semibold leading-tight text-foreground">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
          <Badge variant={linked ? "success" : "secondary"} className="mt-0.5">
            {linked && <Check className="h-3 w-3" />}
            {status}
          </Badge>
        </div>
        {children}
      </div>
    </div>
  );
}
