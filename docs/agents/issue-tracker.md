# Issue tracker: GitHub + Local Markdown

Issues and specs for this repo live on GitHub (repo read fresh from `bos.config.json` `repository`). Sprint-level issue files are also written locally under `.scratch/<feature>/issues/` for agent workflow.

## GitHub conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

## Local markdown conventions

Sprint issues live as files under `.scratch/<feature>/issues/`:

```
.scratch/
├── sprint-2-structure-reporting/
│   ├── SPRINT.md
│   └── issues/
│       ├── 01-node-aggregation-api.md
│       ├── 02-platform-admin-sr-ui.md
│       └── 03-node-dashboard-ui.md
└── future/
    └── issues/
        └── ...
```

- **Create an issue**: write a markdown file at `.scratch/<feature>/issues/<NN>-<slug>.md`
- **Read an issue**: read the file
- **List issues**: glob `.scratch/*/issues/*.md`
- **Close**: delete the file or move to `.scratch/<feature>/closed/`

## Pull requests as a triage surface

**PRs as a request surface: no.**

## When a skill says "publish to the issue tracker"

Create a GitHub issue with `gh issue create`, or write a local file under `.scratch/<feature>/issues/` depending on the workflow context.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments` for GitHub issues, or read the file at `.scratch/<feature>/issues/<file>.md` for local issues.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single GitHub issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's native issue dependencies. Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body.
- **Frontier query**: list the map's open children, drop any with an open blocker or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer to the map's Decisions-so-far.
