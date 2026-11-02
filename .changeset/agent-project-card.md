---
"ui": patch
---

New-project pages now show a "Let your agent do this" card for signed-in users: it creates a 7-day API key in-page under the current session (labeled "Agent: new <kind> (<date>)" with `agent-project-creation` metadata, so it is listed and deletable in Settings → API keys), shows it once with a copy button, and copies a prompt with the MCP URL, the key and instructions for filling project info and NEAR Catalog fields via `createProject` (#318).
