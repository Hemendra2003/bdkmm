# MOMENTUM — Founder-only actions (blocking WP0/WP1)

Author: Oscar · Date: 2026-10-02 · Source: `docs/MASTER-PLAN-1-core.md` §2, §7, §9, §10; audit findings 01/03.
These require account ownership, credential control, or billing/infra access. The team cannot do them and several tickets are `BLOCKED` until they happen. Nothing here authorizes production changes by the team — it lists what **you** must do or approve.

## 1. Credential containment and rotation (highest priority)
- The repo history contains **non-placeholder auth-token values** in a previously-removed local tool settings file (plan §2.1, finding "Credential history"). **Removing the file did not revoke anything.**
- Actions only you can take:
  - Identify every affected credential/token and **revoke or rotate** any that may still be usable (Supabase keys, any third-party host token, OAuth secrets).
  - Review access and billing logs for unexpected use.
  - Decide separately whether to **rewrite Git history** — this needs collaborator coordination, a backup, and handling of forks/caches/protected branches. Do **not** treat force-push as an automatic first step.
- The team will not print or redistribute secret values in any report. The `sb_publishable_…` key in `auth.js` is a *publishable* frontend key and is expected to be public **only if RLS is enforced** (see item 3).

## 2. Supabase project access for the team (read-first)
- Grant the team **read access to the live Supabase project** (schema, grants, RLS policies, views, functions, configured row limit, backup settings, OAuth config, email settings).
- Without this, these tickets stay blocked: **P0.2a** full isolation test, **P0.2b** applying RLS migrations, **P0.3** confirming demo isolation against real persistence, **P0.7b** backup restore, and the migration inventory (plan §9).
- Preferably provide a **separate staging project** so the team can rehearse migrations and restores without touching production (plan §10: separate local/staging/production).

## 3. Confirm or enable Row-Level Security
- Confirm whether RLS is **enabled and enforced** on `momentum_entries`, `user_questions`, and `user_settings`. The client reads have **no user filter** (audit 03), so confidentiality currently depends entirely on live policies that are not in the repo.
- If RLS is off or unverifiable, treat cross-user exposure as an open release-gate risk until proven closed. Approve the team checking in schema/RLS migrations for review before they are applied to live.

## 4. Backups and recovery
- Confirm the **actual backup tier and retention** before any deletion/trash promises are made to users (plan §7, §10).
- Approve a **timed restore rehearsal into isolated staging** (RPO ≤24h / RTO ≤4h are *proposed* targets, adopt only after cost review).
- Investigate the **historic June-27 demo-date concentration** in data/backups (plan §9.7) — but do **not** authorize bulk-shifting those records; overwritten answers may be unrecoverable.

## 5. Decisions you must sign off (not infra, but founder-only)
- **Engine A vs B** and, if B, the missed-day policy — see `docs/ENGINE-DECISION.md`.
- Scope confirmation: is this a **personal app** or **public beta**? This decides whether account-deletion, password recovery, and the full isolation suite are launch-blocking now.
- Hosting/monitoring providers and spend/quota/email/import limits (plan §10) — choose from verified need and budget, not defaults.

---
**Summary of what unblocks the most work:** (1) rotate/contain credentials, (2) give the team read access to Supabase (ideally a staging project), (3) confirm RLS, (4) pick the engine. Items 1–3 unblock all of WP0's security/backend tickets; item 4 unblocks WP2.
