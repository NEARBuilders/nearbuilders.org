# Design tokens

The [UI stylesheet](../ui/src/styles.css) defines the NEAR Builders theme. Components use the semantic utilities it registers with Tailwind. The stylesheet supplies the light values in `:root` and the dark overrides under `.dark`. Shared values inherit from `:root`.

| Role | Utilities |
| --- | --- |
| Page and surfaces | `bg-background`, `text-foreground`, `bg-card`, `text-card-foreground`, and the elevated and popover pairs |
| Controls and state | The primary, secondary, muted, accent, and destructive pairs, plus border, input, and ring |
| Brand | `brand-*` for the site's brand roles, `near-intents` for NEAR Intents, and `hackathon-*` for the campaign |
| Sidebar | The `sidebar-*` surface, foreground, primary, accent, border, and ring tokens |
| Dashboard project status | `project-status-active` and `project-status-paused`, with their foreground tokens. The dashboard uses the base color for the tinted surface and border. Archived uses the muted tokens. |
| Radius | `rounded-2xs`, `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, and `rounded-2xl` |
| Motion | `animate-progress-bar`, `animate-fade-in`, `animate-fade-in-up`, `animate-slide-in-up`, and `animate-settings-panel-in` |

Components shared with sibling apps use these same roles. A consumer needs the stylesheet's token utilities and the same theme class on its app root. Use the semantic role when choosing a token. Colors that are equal today may serve different roles and change independently later.

Run `bash scripts/check-ui-palette.sh` from the checkout to check UI TypeScript for built-in Tailwind palette utilities, including classes stored outside JSX. Use the existing UI lint for additional style checks. When migrating a class to a token, compare the affected component in both themes and preserve its existing appearance.
