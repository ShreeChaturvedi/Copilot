# Settings redesign — refined modal (2026-07-09)

Normative for the settings surface on the `ui-redesign` branch. Sits under `design-brief.md` (SETTLE/aqua). Landing recon (Linear, Midday, Factory, Obsidian) informs density and quiet chrome only.

## Decisions

| Choice | Value                                                                         |
| ------ | ----------------------------------------------------------------------------- |
| Shell  | Refined preference modal (not full-page route)                                |
| Size   | ~max-w-3xl, min(72vh, 640px)                                                  |
| IA     | General · Account · Integrations · Security · About                           |
| Save   | Instant apply; identity fields blur/debounce; password/export/delete explicit |

## Sections

- **General** — Appearance (theme), Calendar (visible hours), Workspace (default view, week start, completion control, sidebar analytics, notifications)
- **Account** — name, email (read-only), bio, timezone, photo (disabled until upload)
- **Integrations** — Google Calendar (unchanged capabilities)
- **Security** — password, Google sign-in status, log out everywhere, Export, Delete account
- **About** — version + env mono; no fake external links

## Deep-link aliases

| Incoming                  | Resolves to |
| ------------------------- | ----------- |
| `profile`                 | `account`   |
| `preferences`, `calendar` | `general`   |
| `help`                    | `about`     |

Canonical ids: `general | account | integrations | security | about`.

## Visual

Quiet rail, hairline rows, aqua film on active nav only, destructive fence for delete. No Card-in-Card. Mobile list→detail push (#48) kept.
