import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Copy, Mail, ShieldAlert, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type SessionData, sessionQueryOptions, useAuthClient } from "@/app";
import { Badge, Button } from "@/components";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_layout/_authenticated/_dashboard/settings/profile")({
  head: () => ({
    meta: [
      { title: "Account | Settings" },
      { name: "description", content: "Manage your account identity and recovery details." },
    ],
  }),
  component: AccountSettings,
});

function AccountSettings() {
  const auth = useAuthClient();
  const { data: session } = useQuery<SessionData | null>(sessionQueryOptions(auth));
  const user = session?.user;

  if (!user) return null;

  return (
    <div className="space-y-5">
      <AccountSummary user={user} />
      <AccountDetailsCard user={user} />
      {user.isAnonymous && <TemporaryAccountNotice />}
    </div>
  );
}

function AccountSummary({
  user,
}: {
  user: { email?: string; name?: string; isAnonymous?: boolean | null };
}) {
  const displayName = user.name?.trim() || "Anonymous";
  const accountState = user.isAnonymous ? "Temporary account" : "Standard account";
  const recoveryState = user.isAnonymous ? "Recovery needed" : "Recovery ready";
  const RecoveryIcon = user.isAnonymous ? ShieldAlert : ShieldCheck;

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-base font-bold text-foreground">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 space-y-2">
            <div className="space-y-1">
              <h2 className="truncate text-lg font-semibold leading-tight text-foreground">
                {displayName}
              </h2>
              <p className="text-sm text-muted-foreground">
                Manage your account identity and recovery status.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={user.isAnonymous ? "secondary" : "success"}>
                <UserRound />
                {accountState}
              </Badge>
              <Badge variant={user.isAnonymous ? "destructive" : "success"}>
                <RecoveryIcon />
                {recoveryState}
              </Badge>
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-lg border border-border bg-muted px-3.5 py-3 sm:w-64">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            Primary email
          </div>
          <div className="truncate text-sm font-medium text-foreground">
            {user.email ?? "Not linked yet"}
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountDetailsCard({
  user,
}: {
  user: { id: string; email?: string; name?: string; isAnonymous?: boolean | null };
}) {
  const auth = useAuthClient();
  const [name, setName] = useState(user.name || "");

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await auth.updateUser({ name });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => toast.success("Account updated"),
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Account identity
        </div>
        <p className="text-sm text-muted-foreground">
          These values identify your account inside NEAR Builders.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <InfoRow label="user id" value={user.id} mono />
        <InfoRow label="email" value={user.email ?? "not linked"} />
        <InfoRow
          label="account type"
          value={user.isAnonymous ? "anonymous" : "standard"}
          copyable={false}
        />
      </div>
      <div className="space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Display name
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your display name"
            className="max-w-sm"
          />
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || name === (user.name || "")}
            variant="outline"
            size="sm"
          >
            {updateMutation.isPending ? "saving..." : "save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
  copyable = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const canCopy = copyable && value !== "not linked";

  const handleCopy = async () => {
    if (!canCopy) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="grid gap-2 rounded-md border border-border bg-muted px-3.5 py-3 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={`min-w-0 truncate text-[13px] text-foreground ${mono ? "font-mono text-xs" : ""}`}
        title={value}
      >
        {value}
      </span>
      {canCopy && (
        <Button
          type="button"
          onClick={handleCopy}
          variant="ghost"
          size="icon-sm"
          className="justify-self-start text-muted-foreground hover:text-foreground sm:justify-self-auto"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      )}
    </div>
  );
}

function TemporaryAccountNotice() {
  return (
    <div className="rounded-xl border border-brand-pink-soft bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-brand-pink-soft bg-brand-pink-light">
            <ShieldAlert className="h-4 w-4 text-destructive" />
          </div>
          <div className="space-y-1">
            <div className="font-semibold text-foreground">Make this account recoverable</div>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              This session is temporary. Link an email or NEAR wallet before signing out so you can
              return to this account later.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="self-start">
          <Link to="/settings/auth-methods">Review auth methods</Link>
        </Button>
      </div>
    </div>
  );
}
