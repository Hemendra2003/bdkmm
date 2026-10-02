# Changelog

All notable changes to MOMENTUM. Each release is one reviewed pull request into `main`.

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
- Docs: `DEVELOPMENT.md`, `SECURITY.md`, `BACKLOG.md`, `FOUNDER-ACTIONS.md`, `ENGINE-DECISION.md`.
