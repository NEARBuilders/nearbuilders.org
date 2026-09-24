import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KeyRound, LogOut, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type SessionData, sessionQueryOptions, useAuthClient } from "@/app";
import { Badge, Button } from "@/components";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_layout/_authenticated/_dashboard/settings/security")({
  component: SecuritySettings,
});

function SecuritySettings() {
  const auth = useAuthClient();
  const { data: session } = useQuery<SessionData | null>(sessionQueryOptions(auth));
  const user = session?.user;

  if (!user) return null;

  return <SecurityTab user={user} />;
}

function SecurityTab({ user }: { user: { email?: string; isAnonymous?: boolean | null } }) {
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changePasswordMutation = useMutation({
    mutationFn: () => {
      if (newPassword !== confirmPassword) throw new Error("Passwords do not match");
      if (newPassword.length < 8) throw new Error("Password must be at least 8 characters");
      return (async () => {
        const { error } = await auth.changePassword({ currentPassword, newPassword });
        if (error) throw new Error(error.message);
      })();
    },
    onSuccess: () => {
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeSessionsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await auth.revokeSessions();
      if (error) throw new Error(error.message);
    },
    onSuccess: () => toast.success("Other sessions revoked"),
    onError: (err: Error) => toast.error(err.message),
  });

  const signOutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await auth.signOut();
      if (error) throw new Error(error.message || "Failed to sign out");
      await auth.near.disconnect().catch(() => {});
    },
    onSuccess: async () => {
      queryClient.setQueryData(["session"], null);
      queryClient.removeQueries({ queryKey: ["passkeys"] });
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      navigate({ to: "/", replace: true });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-5">
      <SecurityOverview hasPassword={!!user.email} isAnonymous={!!user.isAnonymous} />
      {user.email ? (
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold leading-tight text-foreground">
                  Change password
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Use at least 8 characters. Updating your password keeps the current session open.
                </p>
              </div>
            </div>
            <Badge variant="success">Available</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Current password">
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
              />
            </Field>
            <Field label="New password">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
              />
            </Field>
            <Field label="Confirm password">
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
              />
            </Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => changePasswordMutation.mutate()}
              disabled={
                changePasswordMutation.isPending ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword
              }
              variant="outline"
              size="sm"
            >
              {changePasswordMutation.isPending ? "changing..." : "change password"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-foreground">Password unavailable</div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Password management appears once an email-based login is attached to this account.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <ActionCard
          icon={RotateCcw}
          title="Revoke other sessions"
          body="End every other active session while keeping this one open."
          actionLabel={revokeSessionsMutation.isPending ? "revoking..." : "revoke sessions"}
          onClick={() => revokeSessionsMutation.mutate()}
          disabled={revokeSessionsMutation.isPending}
        />
        <ActionCard
          icon={LogOut}
          title="Sign out"
          body="Disconnect this session and return to the public landing page."
          actionLabel={signOutMutation.isPending ? "signing out..." : "sign out"}
          onClick={() => signOutMutation.mutate()}
          disabled={signOutMutation.isPending}
          danger
        />
      </div>
    </div>
  );
}

function SecurityOverview({
  hasPassword,
  isAnonymous,
}: {
  hasPassword: boolean;
  isAnonymous: boolean;
}) {
  const Icon = isAnonymous ? ShieldAlert : ShieldCheck;

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold leading-tight text-foreground">
              Account security
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Manage password access, active sessions, and sign-out behavior for this account.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={hasPassword ? "success" : "secondary"}>
            {hasPassword ? "Password enabled" : "No password"}
          </Badge>
          <Badge variant={isAnonymous ? "destructive" : "success"}>
            {isAnonymous ? "Temporary account" : "Recoverable"}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  body,
  actionLabel,
  onClick,
  disabled,
  danger = false,
}: {
  icon: typeof RotateCcw;
  title: string;
  body: string;
  actionLabel: string;
  onClick: () => void;
  disabled: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-card p-5 ${
        danger ? "border-brand-pink-soft" : "border-border"
      }`}
    >
      <div className="flex h-full flex-col gap-4">
        <div className="flex gap-3">
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg border ${
              danger ? "border-brand-pink-soft bg-brand-pink-light" : "border-border bg-muted"
            }`}
          >
            <Icon className={`h-4 w-4 ${danger ? "text-destructive" : "text-muted-foreground"}`} />
          </div>
          <div className="space-y-1">
            <div className="font-semibold text-foreground">{title}</div>
            <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>
        </div>
        <Button
          onClick={onClick}
          disabled={disabled}
          variant="outline"
          size="sm"
          className={`self-start ${danger ? "text-destructive hover:text-destructive" : ""}`}
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}
