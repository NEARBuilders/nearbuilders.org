import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  Cloud,
  Copy,
  ExternalLink,
  MessageCircle,
  Terminal,
  Upload,
  UserPlus,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CommandCopy } from "@/components/ui/command-copy";

export const Route = createFileRoute("/_layout/ironclaw")({
  head: () => ({
    meta: [
      { title: "IronClaw Hackathon Guide | NEAR Builders" },
      {
        name: "description",
        content:
          "Step-by-step guide: get a NEAR AI API key, set up the IronClaw reborn binary, install the hackathon skill, register, contribute, submit, and get support.",
      },
    ],
  }),
  component: IronclawPage,
});

const sections = [
  {
    id: "api-key",
    step: "0",
    icon: Cloud,
    title: "Get Your NEAR AI API Key",
    subtitle: "Create an account, claim free credits, and generate credentials",
    content: (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-muted px-3.5 py-3 text-sm text-muted-foreground">
          You need a NEAR AI API key to run inference through your IronClaw agent. Recommended:
          DeepSeek V4 Flash via NEAR AI (fast, free).
        </div>

        <ol className="space-y-3 text-sm text-muted-foreground list-decimal pl-4">
          <li>
            <strong className="text-foreground">Create your account</strong> at{" "}
            <a
              href="https://cloud.near.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-cyan underline underline-offset-4"
            >
              cloud.near.ai
            </a>
          </li>
          <li>
            <strong className="text-foreground">Claim $5 of free credits</strong> —{" "}
            <a
              href="https://app.notion.com/p/near-foundation/Claiming-NEAR-AI-Cloud-Credits-2e6da22d7b6483deb74901226d383df2"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-cyan underline underline-offset-4"
            >
              guide here
            </a>
          </li>
          <li>
            <strong className="text-foreground">Generate an API key</strong> in the &ldquo;API
            Keys&rdquo; section
          </li>
          <li>
            <strong className="text-foreground">Export your API key</strong>
          </li>
        </ol>

        <CommandCopy command="export NEARAI_API_KEY=&quot;your-key-here&quot;" />

        <p className="text-xs text-muted-foreground">
          The{" "}
          <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">
            scripts/run-reborn-webui.sh
          </code>{" "}
          script in the next step will configure the model provider automatically (defaults to
          DeepSeek V4 Flash via NEAR AI).
        </p>

        <div className="rounded-md border border-border bg-muted/50 px-3.5 py-2.5 text-xs text-muted-foreground">
          ⚠️ Never share your API key publicly or commit it to version control.
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="https://cloud.near.ai" target="_blank" rel="noopener noreferrer">
              <ExternalLink size={12} />
              cloud.near.ai
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://docs.near.ai/cloud/quickstart#setup"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={12} />
              Setup guide
            </a>
          </Button>
        </div>
      </div>
    ),
    markdown: `## Step 0: Get Your NEAR AI API Key

1. Create your account at https://cloud.near.ai
2. Claim $5 of free credits: https://app.notion.com/p/near-foundation/Claiming-NEAR-AI-Cloud-Credits-2e6da22d7b6483deb74901226d383df2
3. Generate an API key in the "API Keys" section
4. Export your API key:

\`\`\`bash
export NEARAI_API_KEY="your-key-here"
\`\`\`

The \`scripts/run-reborn-webui.sh\` script in the next step will configure the model provider automatically (defaults to DeepSeek V4 Flash via NEAR AI).

⚠️ Never share your API key publicly.

Setup guide: https://docs.near.ai/cloud/quickstart#setup`,
  },
  {
    id: "setup",
    step: "1",
    icon: Terminal,
    title: "Set Up IronClaw (Reborn)",
    subtitle: "Build and run the reborn binary with the WebUI",
    content: (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-muted px-3.5 py-3 text-sm text-muted-foreground">
          <strong>ironclaw-reborn</strong> is the standalone binary with the WebChat v2 UI. Build
          from source — pre-built releases are not yet available. The hosted version at{" "}
          <a
            href="https://agent.near.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-cyan underline underline-offset-4"
          >
            agent.near.ai
          </a>{" "}
          is an older architecture that will no longer be supported.
        </div>

        <div className="rounded-xl border-2 border-brand-accent/40 bg-brand-accent/5 px-5 py-4 space-y-3">
          <p className="text-sm font-bold text-foreground">Quick start (recommended)</p>
          <p className="text-sm text-muted-foreground">
            The repo includes{" "}
            <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">
              scripts/run-reborn-webui.sh
            </code>{" "}
            which handles the entire setup. Just export your provider key and run:
          </p>
          <CommandCopy command="git clone https://github.com/NEARBuilders/ironclaw.git && cd ironclaw" />
          <CommandCopy command="export NEARAI_API_KEY=&quot;your-key-here&quot;" />
          <CommandCopy command="scripts/run-reborn-webui.sh" />
          <p className="text-sm text-muted-foreground">
            Open{" "}
            <a
              href="http://127.0.0.1:3000/v2"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-cyan underline underline-offset-4"
            >
              http://127.0.0.1:3000/v2
            </a>{" "}
            and log in with the printed token.
          </p>
        </div>

        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors list-none flex items-center gap-2">
            <ChevronDown
              size={14}
              className="shrink-0 transition-transform duration-200 group-open:rotate-0 -rotate-90"
            />
            Manual setup (expand)
          </summary>
          <div className="mt-4 space-y-4">
            <CommandCopy command="git clone https://github.com/NEARBuilders/ironclaw.git" />
            <CommandCopy command="cd ironclaw" />
            <CommandCopy command="cargo run -q -p ironclaw_reborn_cli --bin ironclaw-reborn -- --help" />
            <p className="text-xs text-muted-foreground">
              Or build separately:{" "}
              <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">
                cargo build -p ironclaw_reborn_cli --bin ironclaw-reborn
              </code>
            </p>
            <CommandCopy command="export IRONCLAW_REBORN_HOME=&quot;$HOME/.ironclaw-reborn-demo&quot;" />
            <p className="text-xs text-muted-foreground">
              The home directory <strong>must not</strong> be inside the repo.
            </p>
            <CommandCopy command="export IRONCLAW_REBORN_WEBUI_TOKEN=&quot;$(openssl rand -hex 32)&quot;" />
            <CommandCopy command="export IRONCLAW_REBORN_WEBUI_USER_ID=&quot;reborn-cli&quot;" />
            <CommandCopy command="cargo run -q -p ironclaw_reborn_cli --features webui-v2-beta --bin ironclaw-reborn -- serve" />
            <p className="text-sm text-muted-foreground">
              Open{" "}
              <a
                href="http://127.0.0.1:3000/v2"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-cyan underline underline-offset-4"
              >
                http://127.0.0.1:3000/v2
              </a>{" "}
              and log in with your{" "}
              <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">
                IRONCLAW_REBORN_WEBUI_TOKEN
              </code>
              .
            </p>
          </div>
        </details>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://github.com/nearai/ironclaw/blob/main/docs/reborn-binary.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={12} />
              Reborn binary docs
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://agent.near.ai" target="_blank" rel="noopener noreferrer">
              <ExternalLink size={12} />
              agent.near.ai (legacy)
            </a>
          </Button>
        </div>
      </div>
    ),
    markdown: `## Step 1: Set Up IronClaw (Reborn)

### Quick start (recommended)

\`\`\`bash
git clone https://github.com/NEARBuilders/ironclaw.git && cd ironclaw
export NEARAI_API_KEY="your-key-here"
scripts/run-reborn-webui.sh
\`\`\`

Open http://127.0.0.1:3000/v2 and log in with the printed token.

### Manual setup

\`\`\`bash
git clone https://github.com/NEARBuilders/ironclaw.git
cd ironclaw
cargo run -q -p ironclaw_reborn_cli --bin ironclaw-reborn -- --help

export IRONCLAW_REBORN_HOME="$HOME/.ironclaw-reborn-demo"
export IRONCLAW_REBORN_WEBUI_TOKEN="$(openssl rand -hex 32)"
export IRONCLAW_REBORN_WEBUI_USER_ID="reborn-cli"

cargo run -q -p ironclaw_reborn_cli --features webui-v2-beta --bin ironclaw-reborn -- serve
\`\`\`

Open http://127.0.0.1:3000/v2 and log in with your token.

Reborn binary docs: https://github.com/nearai/ironclaw/blob/main/docs/reborn-binary.md`,
  },
  {
    id: "skills",
    step: "2",
    icon: Cloud,
    title: "Install the Hackathon Skill",
    subtitle: "Equip your agent with nova-submit and the hackathon skill",
    content: (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-muted px-3.5 py-3 text-sm text-muted-foreground">
          Your agent needs two things: the <strong>nova-submit</strong> Reborn extension (encrypts
          and uploads files to a NOVA group) and the <strong>ironclaw-hackathon</strong> skill
          (guides your agent through register and submit flows).
        </div>

        <p className="text-sm font-semibold text-foreground">Get a NOVA account</p>
        <p className="text-sm text-muted-foreground">
          Sign up at{" "}
          <a
            href="https://nova-sdk.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-cyan underline underline-offset-4"
          >
            nova-sdk.com
          </a>{" "}
          for your NOVA account ID and API key.
        </p>

        <CommandCopy command="export IRONCLAW_REBORN_HOME=&quot;$HOME/.ironclaw-reborn-demo&quot;" />
        <p className="text-xs text-muted-foreground">
          Make sure{" "}
          <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">
            IRONCLAW_REBORN_HOME
          </code>{" "}
          matches what{" "}
          <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">
            scripts/run-reborn-webui.sh
          </code>{" "}
          sets. The extension commands use this to find your Reborn state.
        </p>
        <CommandCopy command="cargo run -q -p ironclaw_reborn_cli --bin ironclaw-reborn -- extension install nova-submit" />
        <CommandCopy command="cargo run -q -p ironclaw_reborn_cli --bin ironclaw-reborn -- extension activate nova-submit" />
        <CommandCopy command="git clone https://github.com/jcarbonnell/ironclaw-hackathon.git" />
        <CommandCopy command="mkdir -p &quot;$IRONCLAW_REBORN_HOME/local-dev/tenants/default/users/reborn-cli/skills/ironclaw-hackathon&quot;" />
        <CommandCopy command="cp ironclaw-hackathon/skill/SKILL.md &quot;$IRONCLAW_REBORN_HOME/local-dev/tenants/default/users/reborn-cli/skills/ironclaw-hackathon/&quot;" />
        <p className="text-sm text-muted-foreground">Verify everything is set up:</p>
        <CommandCopy command="cargo run -q -p ironclaw_reborn_cli --bin ironclaw-reborn -- extension search nova && cargo run -q -p ironclaw_reborn_cli --bin ironclaw-reborn -- skills list | grep hackathon" />

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://github.com/nearai/ironclaw/blob/main/docs/reborn-binary.md#extension"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={12} />
              Nova-Submit extension docs
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://github.com/jcarbonnell/ironclaw-hackathon"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={12} />
              ironclaw-hackathon repo
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://nova-sdk.com" target="_blank" rel="noopener noreferrer">
              <ExternalLink size={12} />
              nova-sdk.com
            </a>
          </Button>
        </div>
      </div>
    ),
    markdown: `## Step 2: Install the Hackathon Skill

\`\`\`bash
# Get a NOVA account at https://nova-sdk.com

# Make sure IRONCLAW_REBORN_HOME matches the webui script
export IRONCLAW_REBORN_HOME="$HOME/.ironclaw-reborn-demo"

# Install and activate the nova-submit Reborn extension
cargo run -q -p ironclaw_reborn_cli --bin ironclaw-reborn -- extension install nova-submit
cargo run -q -p ironclaw_reborn_cli --bin ironclaw-reborn -- extension activate nova-submit

# Install the hackathon skill on the Reborn filesystem
git clone https://github.com/jcarbonnell/ironclaw-hackathon.git
mkdir -p "$IRONCLAW_REBORN_HOME/local-dev/tenants/default/users/reborn-cli/skills/ironclaw-hackathon"
cp ironclaw-hackathon/skill/SKILL.md "$IRONCLAW_REBORN_HOME/local-dev/tenants/default/users/reborn-cli/skills/ironclaw-hackathon/"

# Verify
cargo run -q -p ironclaw_reborn_cli --bin ironclaw-reborn -- extension search nova
cargo run -q -p ironclaw_reborn_cli --bin ironclaw-reborn -- skills list | grep hackathon
\`\`\`

Nova-Submit extension docs: https://github.com/nearai/ironclaw/blob/main/docs/reborn-binary.md#extension
ironclaw-hackathon: https://github.com/jcarbonnell/ironclaw-hackathon`,
  },
  {
    id: "register",
    step: "3",
    icon: UserPlus,
    title: "Register for the Hackathon",
    subtitle: "Record your intent to compete",
    content: (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-muted px-3.5 py-3 text-sm text-muted-foreground">
          Tell your agent: &ldquo;Register me for the hackathon.&rdquo; The{" "}
          <strong>register_competing_agent</strong> method records your intent to compete.
        </div>

        <div className="rounded-lg border border-border bg-muted px-3.5 py-3">
          <p className="text-sm font-semibold text-foreground mb-2">What you need to provide</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-secondary">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground border-b border-border">
                    Field
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground border-b border-border">
                    Required
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground border-b border-border">
                    Purpose
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">Agent ID</td>
                  <td className="px-3 py-2 text-xs text-foreground">Yes</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    Short handle, no spaces/slashes/quotes
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">Participant Name</td>
                  <td className="px-3 py-2 text-xs text-foreground">Yes</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    Name or @handle for the leaderboard
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-xs text-foreground">NOVA Account ID</td>
                  <td className="px-3 py-2 text-xs text-foreground">Yes</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    Must match at submission time, e.g.{" "}
                    <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">
                      alice.nova-sdk.near
                    </code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          The skill prints a <strong>registration block</strong>. Copy it and send to hackathon
          staff — they need your NOVA account ID to add you to the submission group.
        </p>

        <div className="rounded-md border border-border bg-muted/50 px-3.5 py-2.5 text-xs text-muted-foreground">
          ⚠️ Until staff adds you, you <strong>cannot submit</strong> — the upload will fail.
        </div>
      </div>
    ),
    markdown: `## Step 3: Register for the Hackathon

Tell your agent: "Register me for the hackathon."

| Field | Required | Purpose |
|---|---|---|
| Agent ID | Yes | Short handle, no spaces/slashes/quotes |
| Participant Name | Yes | Name or @handle for the leaderboard |
| NOVA Account ID | Yes | Must match at submission time |

The skill prints a registration block. Send it to hackathon staff.

⚠️ Until staff adds you, you cannot submit.`,
  },
  {
    id: "contribute",
    step: "4",
    icon: Upload,
    title: "Contribute Skills & Tools",
    subtitle: "Publish your extensions to IronHub",
    content: (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-muted px-3.5 py-3 text-sm text-muted-foreground">
          Before submitting, contribute your custom skills and tools to IronHub — this is part of
          the competition. Share what you built with the community.
        </div>

        <div className="rounded-lg border border-border bg-muted px-3.5 py-3">
          <p className="text-sm font-semibold text-foreground mb-2">Submission paths</p>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">Create a Skill</p>
              <p className="text-sm text-muted-foreground">
                Propose a{" "}
                <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">SKILL.md</code>{" "}
                branch:
              </p>
              <a
                href="https://github.com/nearai/ironhub/issues/new?template=new-skill.yml"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-sm text-brand-cyan underline underline-offset-4"
              >
                New skill template <ExternalLink size={10} />
              </a>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Create a Tool</p>
              <p className="text-sm text-muted-foreground">
                Propose a new WASM tool trunk with auth scopes and action surface:
              </p>
              <a
                href="https://github.com/nearai/ironhub/issues/new?template=new-tool.yml"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-sm text-brand-cyan underline underline-offset-4"
              >
                New tool template <ExternalLink size={10} />
              </a>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No-code with Iliad</p>
              <p className="text-sm text-muted-foreground">
                Use the visual builder at{" "}
                <a
                  href="https://iliad.codes"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-cyan underline underline-offset-4"
                >
                  iliad.codes
                </a>
                .
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="https://hub.ironclaw.com/developer" target="_blank" rel="noopener noreferrer">
              <ExternalLink size={12} />
              IronHub developer hub
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://github.com/nearai/ironhub/blob/main/CONTRIBUTING.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={12} />
              Contributing guide
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://iliad.codes" target="_blank" rel="noopener noreferrer">
              <ExternalLink size={12} />
              Iliad
            </a>
          </Button>
        </div>
      </div>
    ),
    markdown: `## Step 4: Contribute Skills & Tools

### Create a Skill
https://github.com/nearai/ironhub/issues/new?template=new-skill.yml

### Create a Tool
https://github.com/nearai/ironhub/issues/new?template=new-tool.yml

### No-code with Iliad
https://iliad.codes

Developer hub: https://hub.ironclaw.com/developer
Contributing: https://github.com/nearai/ironhub/blob/main/CONTRIBUTING.md`,
  },
  {
    id: "submit",
    step: "5",
    icon: Zap,
    title: "Submit Your Final Entry",
    subtitle: "Encrypt and upload via NOVA",
    content: (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-muted px-3.5 py-3 text-sm text-muted-foreground">
          Tell your agent: &ldquo;Submit my final entry.&rdquo; The{" "}
          <strong>submit_final_entry</strong> method validates inputs, builds a submission file, and
          uploads it via the nova-submit tool.
        </div>

        <div className="rounded-lg border border-border bg-muted px-3.5 py-3">
          <p className="text-sm font-semibold text-foreground mb-2">What you need to provide</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-secondary">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground border-b border-border">
                    Field
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground border-b border-border">
                    Required
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground border-b border-border">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">NOVA Account ID</td>
                  <td className="px-3 py-2 text-xs text-foreground">Yes</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    Must match registration
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">NOVA API Key</td>
                  <td className="px-3 py-2 text-xs text-foreground">Yes</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    From nova-sdk.com. Never stored or echoed
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">Project Title</td>
                  <td className="px-3 py-2 text-xs text-foreground">Yes</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    Short name for your project
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">
                    Workflow Description
                  </td>
                  <td className="px-3 py-2 text-xs text-foreground">Yes</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    One sentence, ≤280 chars
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">Demo URL</td>
                  <td className="px-3 py-2 text-xs text-foreground">Yes</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    ~5 min video, publicly viewable
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">GitHub Repo</td>
                  <td className="px-3 py-2 text-xs text-foreground">No</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">Public repo URL</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 font-mono text-xs text-foreground">Skills List</td>
                  <td className="px-3 py-2 text-xs text-foreground">No</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    Comma-separated custom skills/tools
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-xs text-foreground">Demo Notes</td>
                  <td className="px-3 py-2 text-xs text-foreground">No</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    Anything for the judges
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <div className="rounded-md border border-border bg-muted/50 px-3.5 py-2.5 text-xs text-muted-foreground">
            On success you get a CID as proof. <strong>Rotate your NOVA API key</strong> at
            nova-sdk.com afterward.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://github.com/jcarbonnell/ironclaw-hackathon"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={12} />
              ironclaw-hackathon repo
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://nova-sdk.com" target="_blank" rel="noopener noreferrer">
              <ExternalLink size={12} />
              nova-sdk.com
            </a>
          </Button>
        </div>
      </div>
    ),
    markdown: `## Step 5: Submit Your Final Entry

Tell your agent: "Submit my final entry."

| Field | Required | Notes |
|---|---|---|
| NOVA Account ID | Yes | Must match registration |
| NOVA API Key | Yes | From nova-sdk.com. Never stored/echoed |
| Project Title | Yes | Short name for your project |
| Workflow Description | Yes | One sentence, ≤280 chars |
| Demo URL | Yes | ~5 min video, publicly viewable |
| GitHub Repo | No | Public repo URL |
| Skills List | No | Custom skills/tools you built |
| Demo Notes | No | Anything for the judges |

On success you get a CID. **Rotate your NOVA API key** afterward.`,
  },
  {
    id: "support",
    step: "6",
    icon: MessageCircle,
    title: "Get Support",
    subtitle: "Join the IronClaw community on Telegram",
    content: (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-muted px-3.5 py-3 text-sm text-muted-foreground">
          Stuck? Need help with your agent, the hackathon skill, or NOVA setup? The IronClaw
          community is active on Telegram.
        </div>

        <a
          href="https://t.me/ironclawAI"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-4 rounded-xl border-2 border-brand-cyan/40 bg-brand-cyan/5 px-5 py-4 hover:border-brand-cyan hover:bg-brand-cyan/10 transition-all duration-200"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-cyan/10">
            <MessageCircle size={22} className="text-brand-cyan" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-foreground group-hover:text-brand-cyan transition-colors">
              t.me/ironclawAI
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Ask questions, share progress, connect with outros participants
            </p>
          </div>
          <ExternalLink
            size={16}
            className="shrink-0 text-muted-foreground group-hover:text-brand-cyan transition-colors"
          />
        </a>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="https://t.me/ironclawAI" target="_blank" rel="noopener noreferrer">
              <ExternalLink size={12} />
              Join Telegram
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://docs.ironclaw.com" target="_blank" rel="noopener noreferrer">
              <ExternalLink size={12} />
              IronClaw Docs
            </a>
          </Button>
        </div>
      </div>
    ),
    markdown: `## Step 6: Get Support

Join the IronClaw community on Telegram: https://t.me/ironclawAI

Ask questions, share progress, connect with outros participants.

Docs: https://docs.ironclaw.com`,
  },
] as const;

function buildFullMarkdown(): string {
  return [
    "---",
    "name: ironclaw-hackathon-guide",
    "version: 1.0.0",
    "description: Full walkthrough for the NEAR Legion IronClaw Hackathon — API key setup, reborn binary, skill installation, registration, contribution, submission, and support.",
    "activation:",
    "  keywords:",
    "    - hackathon",
    "    - skill-a-thon",
    "    - ironclaw",
    "    - nova",
    "    - near",
    "    - legion",
    "    - reborn",
    "  tags:",
    "    - hackathon",
    "    - ironclaw",
    "    - near",
    "    - nova",
    "  max_context_tokens: 4000",
    "---",
    "",
    "# IronClaw Hackathon Guide",
    "",
    "Step-by-step guide: get a NEAR AI API key, set up IronClaw reborn, install the hackathon skill, register, contribute skills & tools, submit your entry, and get support.",
    "",
    ...sections.flatMap((s) => [s.markdown, ""]),
  ].join("\n");
}

function IronclawPage() {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["api-key", "setup"]));
  const [copied, setCopied] = useState(false);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildFullMarkdown());
    setCopied(true);
    toast.success("Guide copied — load as IronClaw skill");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
      <div className="flex-1">
        <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6 sm:px-6 sm:py-10 animate-fade-in">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
                  <Zap size={18} />
                </div>
                <div className="min-w-0">
                  <span className="text-base font-semibold text-foreground">
                    IronClaw Hackathon Guide
                  </span>
                  <p className="mt-1 text-sm text-muted-foreground">
                    6 steps — API key, reborn setup, skill install, register, contribute, submit
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={handleCopy}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied" : "Copy as skill"}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {sections.map((section) => {
              const isOpen = openSections.has(section.id);

              return (
                <div
                  key={section.id}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className="flex w-full items-center gap-3 px-5 py-4 text-left cursor-pointer hover:bg-muted/50 transition-colors duration-150"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-[11px] font-bold text-muted-foreground font-mono">
                      {section.step}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-foreground">{section.title}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{section.subtitle}</p>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-muted-foreground transition-transform duration-200 ${
                        isOpen ? "rotate-0" : "-rotate-90"
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-border px-5 py-4">{section.content}</div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Quick links
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <UrlCard href="https://ironclaw.com" label="IronClaw" />
              <UrlCard
                href="https://github.com/nearai/ironclaw/blob/main/docs/reborn-binary.md"
                label="Reborn binary docs"
              />
              <UrlCard
                href="https://github.com/nearai/ironclaw/blob/main/docs/reborn-binary.md#extension"
                label="Nova-Submit extension"
              />
              <UrlCard
                href="https://github.com/jcarbonnell/ironclaw-hackathon"
                label="ironclaw-hackathon"
              />
              <UrlCard href="https://nova-sdk.com" label="NOVA SDK" />
              <UrlCard href="https://docs.ironclaw.com" label="IronClaw Docs" />
              <UrlCard href="https://cloud.near.ai" label="NEAR AI Cloud" />
              <UrlCard
                href="https://docs.near.ai/cloud/quickstart#setup"
                label="API key setup guide"
              />
              <UrlCard href="https://t.me/ironclawAI" label="Telegram: @ironclawAI" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UrlCard({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-2 rounded-lg border border-border bg-muted px-3.5 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors duration-150"
    >
      <span className="flex-1 truncate font-medium">{label}</span>
      <ExternalLink
        size={12}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </a>
  );
}
