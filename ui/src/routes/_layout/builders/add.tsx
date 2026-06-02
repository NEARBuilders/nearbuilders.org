import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Hammer, Loader2, MapPin, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_layout/builders/add")({
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
  const auth = useAuthClient();
  const apiClient = useApiClient();
  const { data: session, isLoading: sessionLoading } = useQuery(
    sessionQueryOptions(auth, undefined),
  );
  const nearAccountId = auth.near.getAccountId();
  const isAuthenticated = Boolean(session?.user && !session.user.isAnonymous);

  const [nearAccount, setNearAccount] = useState(nearAccountId ?? "");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [skillsRaw, setSkillsRaw] = useState("");
  const [location, setLocation] = useState("");

  const isSelfNomination = nearAccountId
    ? nearAccount.trim().toLowerCase() === nearAccountId.toLowerCase()
    : false;

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
            Nominate a Builder
          </h1>
          <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto leading-relaxed">
            Connect your NEAR wallet to nominate a builder for the NEAR Builders directory. All
            nominations are reviewed by admins.
          </p>
          <div className="flex flex-col gap-3 items-center">
            <Button
              asChild
              size="lg"
              className="rounded-full px-8 h-12 bg-brand-green hover:bg-brand-green/90 text-black font-bold shadow-lg shadow-brand-green/20"
            >
              <Link to="/login" search={{ redirect: "/builders/add" }}>
                Connect wallet to continue
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
              <Link to="/builders">Browse builders</Link>
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
            You need a linked NEAR account to nominate a builder.
          </p>
          <Button
            onClick={() => auth.signIn.near()}
            size="lg"
            className="rounded-full px-8 h-12 bg-brand-cyan text-black font-bold"
          >
            Connect NEAR wallet
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
            : "Nominate someone for the NEAR Builders directory. All nominations are reviewed by admins."}
        </p>
      </div>

      <NominationForm
        nearAccount={nearAccount}
        setNearAccount={setNearAccount}
        name={name}
        setName={setName}
        bio={bio}
        setBio={setBio}
        skillsRaw={skillsRaw}
        setSkillsRaw={setSkillsRaw}
        location={location}
        setLocation={setLocation}
        isSelfNomination={isSelfNomination}
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
  apiClient: ReturnType<typeof useApiClient>;
}) {
  const [submitted, setSubmitted] = useState(false);

  const nominateMutation = useMutation({
    mutationFn: () =>
      apiClient.propose({
        pluginId: "builders",
        entityId: nearAccount.trim().toLowerCase(),
        payload: {
          name: name.trim() || undefined,
          bio: bio.trim() || undefined,
          skills: skillsRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          location: location.trim() || undefined,
        },
        source: "web",
      }),
    onSuccess: () => {
      toast.success(
        isSelfNomination
          ? "Builder profile submitted for review"
          : "Builder nomination submitted for review",
      );
      setSubmitted(true);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to submit nomination"),
  });

  if (submitted) {
    return (
      <div className="rounded-2xl border border-brand-accent bg-brand-accent-light p-10 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-brand-green/20">
          <Check className="size-6 text-brand-green" />
        </div>
        <h2 className="text-2xl font-black text-foreground mb-2">
          {isSelfNomination ? "Application submitted!" : "Nomination submitted!"}
        </h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto leading-relaxed">
          Your submission is pending admin review. We'll update the status soon.
        </p>
        <div className="flex flex-col gap-2 items-center">
          <Button
            asChild
            className="rounded-full px-8 bg-brand-green hover:bg-brand-green/90 text-black font-bold"
          >
            <Link to="/builders">Browse builders</Link>
          </Button>
          {isSelfNomination && (
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
              <Link to="/home">Go to dashboard</Link>
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
        {isSelfNomination ? (
          <div className="flex items-center gap-2 h-10 px-3 rounded-xl border border-brand-accent bg-brand-accent-light text-sm font-mono text-brand-cyan">
            <MapPin size={12} className="text-muted-foreground shrink-0" />
            {nearAccount}
          </div>
        ) : (
          <Input
            id="field-account"
            placeholder="example.near"
            value={nearAccount}
            onChange={(e) => setNearAccount(e.target.value)}
            className="font-mono"
          />
        )}
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
          <Input
            id="field-location"
            placeholder="City, Country or Remote"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={100}
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
        <Input
          id="field-skills"
          placeholder="React, Rust, Smart Contracts…"
          value={skillsRaw}
          onChange={(e) => setSkillsRaw(e.target.value)}
        />
      </div>

      <div className="flex gap-3 pt-2 border-t border-border">
        <Button type="submit" disabled={nominateMutation.isPending} className="rounded-full px-6">
          {nominateMutation.isPending && <Loader2 size={14} className="animate-spin" />}
          {isSelfNomination ? "Join as builder" : "Nominate builder"}
        </Button>
        <Button asChild variant="ghost" className="text-muted-foreground">
          <Link to="/builders">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
