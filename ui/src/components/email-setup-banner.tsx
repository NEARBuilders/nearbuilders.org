import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useApiClient } from "@/app";
import { emailPreferenceQueryKey } from "@/components/email-notification-settings";
import {
  dismissEmailPrompt,
  isEmailPromptDismissed,
  subscribeEmailPrompt,
} from "@/lib/email-prompt";

export function EmailSetupBanner({
  email,
  emailVerified,
}: {
  email?: string | null;
  emailVerified?: boolean;
}) {
  const apiClient = useApiClient();
  const [dismissed, setDismissed] = useState(false);
  const preferenceQuery = useQuery({
    queryKey: emailPreferenceQueryKey,
    queryFn: () => apiClient.getMyEmailPreference(),
  });

  useEffect(() => {
    setDismissed(isEmailPromptDismissed());
    return subscribeEmailPrompt(() => setDismissed(isEmailPromptDismissed()));
  }, []);

  const verified =
    (preferenceQuery.data?.verified && Boolean(preferenceQuery.data.email)) ||
    (emailVerified && Boolean(email));

  if (preferenceQuery.isLoading || verified || dismissed) return null;

  return (
    <div className="border-b border-border bg-muted px-4 py-3">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <p className="text-sm text-foreground">Add an email to get notified about approvals.</p>
        <button
          type="button"
          className="text-sm text-muted-foreground underline"
          onClick={() => {
            dismissEmailPrompt();
            setDismissed(true);
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
