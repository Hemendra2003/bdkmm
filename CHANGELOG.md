# Changelog

All notable changes to MOMENTUM. Each release is one reviewed pull request into `main`.

## [0.5.0] - 2026-10-02 — New app UI (`/app/`)

### Added

- Responsive shell with bottom navigation (Today · Habits · Progress), pixel icons, safe-area layout; route changes update title, scroll and focus.
- **Today:** start/continue/edit check-in, last scored velocity with its real date, last-7-days count, honest pending/no-score states.
- **Check-in:** one control per habit, answered counter, Skip for now, local draft, save independent of score readiness.
- **Results:** engine card with thrust, drag, multiplier, shadow, change and velocity from Engine B.
- **Habits:** list, add, edit, remove; new habits get unique keys; past scores never change (stored revisions).
- **Progress:** last 7 days / 30 days / all time history with scored, pending and no-score states.
- **Accounts:** password recovery with resend cooldown, reset screen, Google sign-in, optional 4-habit starter set for new users.

### Notes

- The original app at `/` is unchanged.
- Founder action for password recovery: enable the recovery email and allowlist `<site>/app/?flow=recovery` and `<site>/app/` in Supabase Auth redirect URLs.

## [0.4.0] - 2026-10-02 — Past scores stay fixed

### Database

- Migration `supabase/migrations/0002_entry_question_revisions.sql`: each entry stores the question set and engine version (b-1) that scored it; a trigger freezes them on later edits. Additive columns only; row-level security unchanged. **Must be applied to production before this release is deployed.**

### Fixed

- Re-tiering or removing a question no longer changes already-saved days (AUDIT-05). Older unstamped entries keep using current questions until first edited.

## [0.3.0] - 2026-10-02 — Score explanation

### Added

- The day summary shows how the score was built: raw change, multiplier, shadow (penalty carried from missed habits), intended change and actual change, straight from the engine result (WP2.6).
- Engine streaks are labelled "positive/negative score streak" so they are not confused with check-in or habit streaks.
- `docs/UX-0.md`: state glossary, screen inventory and build order for the UI overhaul.

## [0.2.1] - 2026-10-02 — Browser tests for /app/

### Build & CI

- Browser tests now cover `/app/` on desktop and 390px mobile: missing and malformed settings show the setup error, and the sign-in form is keyboard reachable. All real network traffic is blocked during tests.

## [0.2.0] - 2026-10-02 — React app shell

### Added

- New React app at `/app/` (signed-out sign-in screen and a Today view backed by the typed repositories). The existing app at `/` is unchanged.
- Clear setup error when Supabase settings are missing or malformed, instead of a blank page.
- Sign-in, session-read and sign-out failures are shown to the user.

### Build & CI

- Vitest + Testing Library component tests (23) run in `npm test` alongside the Node tests.

## [0.1.0] - 2026-10-02 — Stabilize (WP0 + WP1 + Engine B core)

### Security

- Removed committed settings/secrets from the tree; public config only via `VITE_` variables (P0.1a).
- Safe rendering: user text is no longer injected as HTML (P0.4).
- Supabase JS SDK pinned to 2.117.2 (P0.6a).
- Database schema + row-level security migration `supabase/migrations/0001_momentum_core.sql`: RLS enabled and forced, owner-only policies, no anonymous grants. Applied and verified on staging with a two-user isolation test (10/10). Production RLS is not yet verified.
- `removeAll` deletes only the signed-in user's rows (AUDIT-15).

### Fixed

- Dates use the local calendar day; demo mode is read-only with a clear banner (P0.3, P0.3b).
- Week/month views no longer include future days (AUDIT-17).
- Entries keep durable drafts and show save status (P0.5).

### Added

- Engine B scoring (contract b-1, `docs/ENGINE.md`) with golden fixtures; missed days reset streak multipliers while velocity carries over (Variant 1).
- Pure domain modules, typed repositories with tolerant legacy reads, session/state boundaries (WP1.2–1.4).
- Design tokens and design-system docs (WP1.7).

### Build & CI

- Vite + TypeScript toolchain, ESLint, Prettier, Node test runner + Vitest (WP1.1).
- GitHub Actions CI with SHA-pinned actions: typecheck, lint, format, tests, build, legacy bundle freshness (WP1.5).
- Playwright browser smoke test (desktop + 390px mobile Chromium) runs in CI (WP1.5b).
- Docs: `DEVELOPMENT.md`, `SECURITY.md`, `BACKLOG.md`, `FOUNDER-ACTIONS.md`, `ENGINE-DECISION.md`.
