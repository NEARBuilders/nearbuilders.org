import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const emailPreferenceQueryKey = ["email-preference"] as const;

export function NotificationEmailSettings({
  authEmail,
  authEmailVerified,
}: {
  authEmail?: string | null;
  authEmailVerified?: boolean;
}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const preferenceQuery = useQuery({
    queryKey: emailPreferenceQueryKey,
    queryFn: () => apiClient.getMyEmailPreference(),
  });

  const requestCode = useMutation({
    mutationFn: (address: string) => apiClient.requestNotificationEmailCode({ email: address }),
    onSuccess: () => toast.success("Verification code sent"),
    onError: (error: Error) => toast.error(error.message || "Could not send the code"),
  });

  const confirmCode = useMutation({
    mutationFn: (value: string) => apiClient.confirmNotificationEmailCode({ code: value }),
    onSuccess: async () => {
      setCode("");
      toast.success("Email verified");
      await queryClient.invalidateQueries({ queryKey: emailPreferenceQueryKey });
    },
    onError: (error: Error) => toast.error(error.message || "That code is invalid or expired"),
  });

  const setEnabled = useMutation({
    mutationFn: (enabled: boolean) => apiClient.setEmailNotificationsEnabled({ enabled }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: emailPreferenceQueryKey });
    },
    onError: (error: Error) => toast.error(error.message || "Could not update email notifications"),
  });

  const preference = preferenceQuery.data;
  const verifiedAddress =
    preference?.verified && preference.email
      ? preference.email
      : authEmailVerified && authEmail
        ? authEmail
        : null;
  const enabled = preference?.enabled ?? true;
  const pending = preference?.pendingEmail;

  return (
    <div className="space-y-3">
      <p className={`text-sm text-muted-foreground${verifiedAddress ? " break-all" : ""}`}>
        {verifiedAddress ?? "Add an email to get notified about approvals."}
      </p>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          const address = email.trim();
          if (!address) return;
          requestCode.mutate(address);
        }}
      >
        <Input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={verifiedAddress ? "Change email" : "you@example.com"}
          autoComplete="email"
        />
        <Button type="submit" size="sm" disabled={requestCode.isPending}>
          {requestCode.isPending ? "Sending..." : "Send code"}
        </Button>
      </form>
      {pending ? (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (!/^\d{6}$/.test(code)) return;
            confirmCode.mutate(code);
          }}
        >
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="6-digit code"
            maxLength={6}
          />
          <Button type="submit" size="sm" variant="outline" disabled={confirmCode.isPending}>
            {confirmCode.isPending ? "Checking..." : "Verify"}
          </Button>
        </form>
      ) : null}
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={!verifiedAddress || setEnabled.isPending}
        onClick={() => setEnabled.mutate(!enabled)}
        className="inline-flex items-center gap-2 text-sm text-foreground disabled:opacity-50"
      >
        <span
          className={`relative h-5 w-9 rounded-full border border-border ${enabled && verifiedAddress ? "bg-primary" : "bg-muted"}`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-background ${enabled && verifiedAddress ? "left-4" : "left-0.5"}`}
          />
        </span>
        Email notifications {enabled ? "on" : "off"}
      </button>
    </div>
  );
}
