import {
  Check,
  Clipboard,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  MessageCircle,
  RotateCcw,
  X,
  XCircle,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  suggestedXReply,
  type XNominationRecord,
  type XNominationUpdate,
  xNominationContext,
} from "@/lib/x-nomination-queue";
import { formatDateTime } from "./-proposal-dashboard";
import { XNominationStatusBadge } from "./-x-nomination-table";

type ProposalLifecycle = {
  reviewStatus: string;
  applyStatus: string;
  removeStatus: string;
};

function SheetCloseButton() {
  return (
    <SheetClose asChild>
      <Button type="button" size="icon-sm" variant="outline" aria-label="Close nomination">
        <X />
      </Button>
    </SheetClose>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <h3 className="border-b border-border bg-secondary/30 px-4 py-3 text-sm font-semibold text-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function MetadataItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 bg-card px-4 py-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 min-w-0 break-words text-sm text-foreground">{value}</div>
    </div>
  );
}

function dateValue(value: string | null) {
  return value ? formatDateTime(value) : "—";
}

function referralDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function profileStatus(row: XNominationRecord, proposal?: ProposalLifecycle) {
  if (!proposal) return row.profileStatus === "submitted" ? "Profile submitted" : "Not submitted";
  if (proposal.removeStatus === "removing") return "Removing profile";
  if (proposal.removeStatus === "removed") return "Profile removed";
  if (proposal.removeStatus === "failed") return "Profile removal failed";
  if (proposal.reviewStatus === "rejected") return "Profile submission rejected";
  if (proposal.applyStatus === "failed") return "Profile publishing failed";
  if (proposal.applyStatus === "applying") return "Publishing profile";
  if (proposal.applyStatus === "applied") return "Profile published";
  if (proposal.reviewStatus === "approved") return "Approved for publishing";
  return "Awaiting profile review";
}

async function copyValue(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`${label} could not be copied`);
  }
}

export function XNominationReviewSheet({
  row,
  referrals,
  proposal,
  pending,
  onClose,
  onUpdate,
}: {
  row?: XNominationRecord;
  referrals: XNominationRecord[];
  proposal?: ProposalLifecycle;
  pending: boolean;
  onClose: () => void;
  onUpdate: (input: XNominationUpdate) => void;
}) {
  const [replyUrl, setReplyUrl] = useState("");
  const [copiedPostId, setCopiedPostId] = useState(false);

  useEffect(() => {
    setReplyUrl(row?.replyUrl ?? "");
    setCopiedPostId(false);
  }, [row]);

  if (!row) return <Sheet open={false} />;

  const suggestedReply = suggestedXReply(row);
  const nomineeProfile = row.linkedNomineeNearAccount ?? row.linkedNomineeBuilderId;
  const canonicalPostUrl =
    referrals.find((referral) => referral.sourcePostId === row.canonicalSourcePostId)
      ?.sourcePostUrl ?? row.sourcePostUrl;
  const run = (action: XNominationUpdate["action"]) => {
    onUpdate({ row, action, replyUrl: replyUrl.trim() || undefined });
  };
  const copyPostId = async () => {
    await copyValue(row.sourcePostId, "Source post ID");
    setCopiedPostId(true);
    window.setTimeout(() => setCopiedPostId(false), 2000);
  };

  return (
    <Sheet
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <SheetContent
        side="right"
        size="wide"
        hideCloseButton
        className="overflow-hidden rounded-none border-y-0"
      >
        <SheetHeader className="border-b border-border bg-secondary/30 px-5 py-6 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <XNominationStatusBadge status={row.engagementStatus} />
              {row.sourceReferralCount > 1 && (
                <Badge variant="secondary" className="rounded-full">
                  {row.sourceReferralCount} referrals
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button asChild type="button" size="icon-sm" variant="outline">
                <a
                  href={row.sourcePostUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open source post on X"
                >
                  <ExternalLink />
                </a>
              </Button>
              <SheetCloseButton />
            </div>
          </div>
          <SheetTitle className="mt-3 text-2xl font-bold leading-tight">
            @{row.nomineeXUsername}
          </SheetTitle>
          <SheetDescription>
            Nominated by @{row.nominatorXUsername} · {dateValue(row.sourcePostCreatedAt)}
          </SheetDescription>
          <div className="mt-2 flex min-w-0 items-center gap-1.5">
            <code className="min-w-0 truncate text-xs text-muted-foreground">
              {row.sourcePostId}
            </code>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => void copyPostId()}
              aria-label={copiedPostId ? "Source post ID copied" : "Copy source post ID"}
            >
              {copiedPostId ? <Check /> : <Copy />}
            </Button>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-background px-5 py-6 sm:px-6">
          <Section title={`Referrals (${referrals.length})`}>
            <div className="divide-y divide-border">
              {referrals.map((referral) => {
                const context = xNominationContext(referral);
                return (
                  <div key={referral.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                        <Badge
                          variant={referral.isCanonical ? "outline" : "secondary"}
                          className="rounded-full px-2 py-0.5"
                        >
                          {referral.isCanonical ? "Canonical" : "Additional"}
                        </Badge>
                        <span className="truncate">@{referral.nominatorXUsername}</span>
                        <span>·</span>
                        <span className="shrink-0">
                          {referralDate(referral.sourcePostCreatedAt)}
                        </span>
                      </div>
                      {context && (
                        <p className="mt-1 truncate text-sm text-foreground">{context}</p>
                      )}
                    </div>
                    <Button
                      asChild
                      size="icon-sm"
                      variant="outline"
                      className="shrink-0"
                      aria-label={`Open referral ${referral.sourcePostId} on X`}
                    >
                      <a href={referral.sourcePostUrl} target="_blank" rel="noreferrer">
                        <ExternalLink />
                      </a>
                    </Button>
                  </div>
                );
              })}
            </div>
          </Section>

          {row.profileStatus !== "submitted" && row.engagementStatus !== "completed" && (
            <Section title="Outreach">
              <div className="space-y-4 p-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => row.joinUrl && void copyValue(row.joinUrl, "Join link")}
                    disabled={!row.joinUrl}
                  >
                    <Link2 />
                    Copy join link
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      suggestedReply && void copyValue(suggestedReply, "Suggested reply")
                    }
                    disabled={!suggestedReply}
                  >
                    <Clipboard />
                    Copy outreach
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="x-nomination-reply-url">Reply URL (optional)</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="x-nomination-reply-url"
                      value={replyUrl}
                      onChange={(event) => setReplyUrl(event.target.value)}
                      placeholder="Optional public X reply URL"
                      inputMode="url"
                    />
                    <Button type="button" onClick={() => run("mark_contacted")} disabled={pending}>
                      {pending ? <Loader2 className="animate-spin" /> : <MessageCircle />}
                      {row.engagementStatus === "contacted" ? "Update contact" : "Mark contacted"}
                    </Button>
                  </div>
                </div>
              </div>
            </Section>
          )}

          <Section title="Details">
            <div className="grid gap-px bg-border sm:grid-cols-2">
              <MetadataItem
                label="Nominee"
                value={
                  <a
                    href={`https://x.com/${row.nomineeXUsername}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-brand-cyan hover:underline"
                  >
                    @{row.nomineeXUsername}
                  </a>
                }
              />
              <MetadataItem
                label="Nominator"
                value={
                  <a
                    href={`https://x.com/${row.nominatorXUsername}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-brand-cyan hover:underline"
                  >
                    @{row.nominatorXUsername}
                  </a>
                }
              />
              {row.linkedNomineeNearAccount && (
                <MetadataItem
                  label="Builder profile"
                  value={
                    <a
                      href={`/builders/${row.linkedNomineeNearAccount}`}
                      className="font-medium text-brand-cyan hover:underline"
                    >
                      {row.linkedNomineeNearAccount}
                    </a>
                  }
                />
              )}
              {!row.linkedNomineeNearAccount && nomineeProfile && (
                <MetadataItem label="Builder profile" value={nomineeProfile} />
              )}
              <MetadataItem
                label="Canonical referral"
                value={
                  <a
                    href={canonicalPostUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-brand-cyan hover:underline"
                  >
                    Open post
                    <ExternalLink className="size-3.5" />
                  </a>
                }
              />
              <MetadataItem
                label="Link opens"
                value={`${row.openCount} · last ${dateValue(row.lastOpenedAt)}`}
              />
              <MetadataItem label="Onboarding" value={profileStatus(row, proposal)} />
              {row.replyUrl && (
                <MetadataItem
                  label="Recorded reply"
                  value={
                    <a
                      href={row.replyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-brand-cyan hover:underline"
                    >
                      Open reply
                      <ExternalLink className="size-3.5" />
                    </a>
                  }
                />
              )}
              <MetadataItem label="Contacted" value={dateValue(row.contactedAt)} />
              <MetadataItem label="Completed" value={dateValue(row.completedAt)} />
            </div>
          </Section>
        </div>

        {row.engagementStatus !== "completed" && (
          <SheetFooter className="border-t border-border bg-background/95 px-5 py-4 backdrop-blur sm:px-6">
            <div className="flex w-full flex-wrap justify-end gap-2">
              {row.engagementStatus === "rejected" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => run("reopen")}
                  disabled={pending}
                >
                  {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                  Reopen
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => run("reject")}
                  disabled={pending}
                >
                  {pending ? <Loader2 className="animate-spin" /> : <XCircle />}
                  Reject
                </Button>
              )}
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
