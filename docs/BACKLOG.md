# MOMENTUM — Delivery Backlog: Work Package 0 and Work Package 1

Author: Oscar · Date: 2026-10-02 · Branch: `oscar/brief-bdkmm-1` · Base: `eb31f0e`
Source of truth: `docs/MASTER-PLAN-1-core.md` (WP0 = §2, WP1 = §11 + §5), `docs/MASTER-PLAN-2-ui-ux.md` (§3 design system), `../research/bdkmm/audit/AUDIT.md` (concrete locations).

Owners: **Jim** backend/logic · **Pam** UI · **Dwight** QA/security · **Toby** build/CI.
Statuses: `DISPATCHED` already assigned by god, do not duplicate · `READY` can start now · `BLOCKED` waiting on a dependency or founder.

Line refs point at committed HEAD `eb31f0e`. The plan notes the local working tree has uncommitted changes to `app.js`/`index.html`/`storage.js`; **preserve that work** — confirm the live line before editing.

---

## Work Package 0 — P0 stabilization (Master Plan 1 §2)

Exit (plan §2): evidence of isolation, safe rendering, trustworthy date targeting, recoverable editing, and a tested recovery path; credential status has a named owner and documented disposition.

### P0.1 — Contain credential risk
Two parts. The investigation/rotation is **founder-only** (see §Founder actions). The repo-hygiene part is engineering.
- **P0.1a Secret scanning + ignore rules** — Owner **Dwight** — `READY`
  - Files: `.gitignore`, new `.gitleaks.toml` or CI secret-scan step (coordinate the CI wiring with Toby/WP1.7), `SECURITY.md` (stub).
  - Deps: none for local scan; the CI gate depends on WP1.7.
  - Acceptance: a secret scanner runs over the tree and history and reports findings without printing secret values; `.gitignore` covers local tool settings (`.claude/`), env files, and OS files (`.DS_Store`) while permitting a safe example config; no new secret can be committed without the scan failing.
- **P0.1b Credential inventory** — Owner **Dwight** — `DISPATCHED` (part of the read-only security inventory)
  - Read-only: list affected credentials by location/version, never redistribute or print values. Hand disposition to the founder.

### P0.2 — Verify account ownership (RLS / grants)
- **P0.2a Schema + RLS + grants inventory and two-user isolation test** — Owner **Dwight** — `DISPATCHED`
  - Read-only inventory of schema, grants, RLS, views, functions; test anonymous denial and user-A/user-B read/write where access allows.
- **P0.2b Apply operation-specific RLS policies + ownership constraints** — Owner **Jim** (with Dwight verifying) — `BLOCKED` (needs founder Supabase access + P0.2a findings)
  - Files: new `supabase/migrations/*.sql` (checked-in schema/policies — none exist today).
  - Acceptance: all three tables (`momentum_entries`, `user_questions`, `user_settings`) enforce authenticated ownership on SELECT/INSERT/UPDATE/DELETE incl. new-row and existing-row checks; unique `(user_id,date)`, `(user_id,key)`, and settings-owner constraints exist; anonymous and forged-owner access is denied in tests. Do not apply a fresh init migration blindly to the live DB (plan §2.2).

### P0.3 — Finish date / demo isolation
- **P0.3a Local calendar date policy** — Owner **Jim** — `READY`
  - Files: `app.js` (`appNow`/`todayKey` ~`33-36`; graph/filter date math ~`722-760`, `873-879`; save path ~`540-547`). Centralize into a pure `dates` helper.
  - Deps: coordinate with Dwight's characterization fixtures (P0.6b) so date behavior is pinned before change.
  - Acceptance (audit 01/09): a save at 00:30 IST on Sep 5 produces a Sep-5 entry; Sep 6 does not overwrite Sep 5; entry date is captured when the form opens; midnight-rollover, DST and timezone boundaries have tests. Do **not** bulk-shift existing June-27 records.
- **P0.3b Demo mode: explicit, labeled, isolated; remove dev tools from prod** — Owner **Jim** (logic) + **Pam** (visible label) — `READY`
  - Files: `app.js` (`DEMO_DATE_OVERRIDE` ~`33`, dev tools `devReset`/`devExport`/`devImport`/`toggleDevTools` ~`928-962`), `index.html` (dev-tools UI).
  - Acceptance (plan §2.3): production build cannot write demo-dated data to a real account; demo mode is visibly labeled; destructive dev tools are absent from production; `?dev=1` alone is not authorization.

### P0.4 — Make text rendering safe
- **P0.4 Safe text rendering (escape all user text → DOM nodes)** — Owner **Jim** — `DISPATCHED`
  - Files (audit 02): `app.js` ~`407-410`, `916-921`, `1155-1170`, `1361-1395`.
  - Acceptance: custom markup displays literally on entry, question-management, and habits screens; no injected element/handler is created.
- **P0.4-test Rendering-injection regression tests** — Owner **Dwight** — `READY` (pairs with P0.4; needs the test runner from P0.6a)
  - Acceptance: a stored `<b>`/`<script>` payload renders as literal text in each sink; test fails if interpolation returns.
- **P0.4-csp Content-Security-Policy** — Owner **Toby** — `BLOCKED` (after inline handlers removed in P0.4/WP1)
  - Files: hosting headers / `index.html` meta. Acceptance: a restrictive CSP is in place and the app functions with no inline-script execution.

### P0.5 — Stop losing edits
- **P0.5 Durable drafts + keep editor open on failed save + guard blank-form overwrite** — Owner **Jim** — `READY`
  - Files: `app.js` (`openLog`/`openLogFullEdit` ~`482-536`, `finishQuestionnaire` ~`540-557`). Interim `localStorage` is acceptable (plan §2.5); launch contract is IndexedDB+outbox (WP4, out of scope here).
  - Deps: date policy P0.3a (draft must key on the correct date).
  - Acceptance (audit 06/07): a failed save keeps the questionnaire open with all selections; a failed read never opens a blank form that can overwrite an existing entry; a failed refresh after a successful save says "saved, refresh failed"; drafts are account-scoped and cleared on logout.

### P0.6 — Pin and characterize
- **P0.6a Pin Supabase SDK + minimal npm/lockfile** — Owner **Toby** — `READY`
  - Files: `index.html` ~`929` (pin `@supabase/supabase-js@2` to an exact version now), new `package.json` + lockfile.
  - Acceptance: SDK version is exact and reproducible; `npm ci` restores it; this is the seed the WP1 build grows from.
- **P0.6b Characterization fixtures for the current engine** — Owner **Dwight** — `READY`
  - Files: extend `audit/reproduce.mjs` (already reproduces 12 behaviors) into a fixture set; new `tests/` once P0.6a lands.
  - Acceptance: current `scoreForAnswer`/`runEngine`/`recomputeAll` behavior is captured as golden fixtures before any refactor; intended rule changes are labeled separately from regressions.

### P0.7 — Preserve evidence and recovery
- **P0.7a Source/schema inventory snapshot** — Owner **Dwight** — `DISPATCHED` (part of security inventory)
- **P0.7b Backup restore rehearsal in isolated staging** — **Founder-gated** (needs Supabase access) — see §Founder actions.

**WP0 parallelism map** (safe to run at once — disjoint files):
- Group A (read-only, zero file conflict): P0.1b, P0.2a, P0.7a — Dwight (DISPATCHED).
- Group B (logic in `app.js`, **serialize within Jim**; these share `app.js`): P0.3a → P0.3b → P0.4 (DISPATCHED) → P0.5. Order by dependency: date policy first, then draft safety. These cannot run truly parallel because they edit the same file; sequence them.
- Group C (independent of `app.js` logic): P0.6a (Toby, build files), P0.1a (Dwight, `.gitignore`/CI) — parallel with Group B.
- Group D (tests, depend on P0.6a landing): P0.6b, P0.4-test (Dwight) — parallel with each other, after the runner exists.
- Blocked on founder: P0.2b, P0.4-csp (after P0.4), P0.7b.

---

## Work Package 1 — Foundations (Master Plan 1 §11 row "Foundations" + §5 architecture)

Exit (plan §11): typed modules, pinned build, characterization tests, state/session boundaries, and CI. UI design system proceeds in parallel.

### WP1.1 — Build toolchain: npm + Vite + TypeScript + lint
- Owner **Toby** — `READY` (builds on P0.6a)
- Files: `package.json`, `vite.config.ts`, `tsconfig.json`, `.eslintrc`/`.prettierrc`, lockfile.
- Acceptance: `npm run build`/`dev`/`lint`/`typecheck` work; dependencies pinned in a lockfile; existing static app still serves during incremental migration; only public `VITE_`-prefixed Supabase config is exposed client-side.

### WP1.2 — Extract pure domain modules
- Owner **Jim** — `READY` (after P0.6b fixtures exist, so extraction is regression-checked)
- Files: new `src/domain/{dates,scoring,validation,history}.ts` extracted from `app.js` (`TIER_WEIGHTS`/`scoreForAnswer`/`runEngine`/`recomputeAll`/`checkBalance` ~`43-285`); keep browser compatibility during migration.
- Deps: P0.6b (characterization), WP1.1 (TS build).
- Acceptance: pure functions take explicit clock/timezone inputs, have no DOM/network access, and pass the characterization fixtures unchanged; `app.js` imports them rather than redefining.

### WP1.3 — Typed data repositories + rename `Storage` global
- Owner **Jim** — `READY`
- Files: `storage.js` → `src/data/repositories.ts`; rename the custom `window.Storage` global (plan §5).
- Deps: WP1.1.
- Acceptance: all Supabase access goes through typed repositories with boundary validation and explicit user filters (defense in depth, not a substitute for RLS); no remaining references to the old global name.

### WP1.4 — Session / state boundaries
- Owner **Jim** — `READY`
- Files: new `src/state/session.ts`; refactor boot/auth (`app.js` ~`1428-1463`, `auth.js` ~`14-20`).
- Deps: WP1.2, WP1.3.
- Acceptance (audit 04/08): one auth subscription; boot work scheduled outside the auth callback; boot deduped by user identity/event; account-scoped caches; generation guards reject stale user-A results after switching to B; logout clears caches, drafts, DOM fragments, overlays.

### WP1.5 — CI pipeline
- Owner **Toby** — `READY` (after WP1.1)
- Files: `.github/workflows/ci.yml`.
- Deps: WP1.1; consumes tests from WP1.2/P0.6b and the secret scan from P0.1a.
- Acceptance: PR CI runs typecheck, lint, build, domain fixtures, and a small browser smoke step; red CI blocks merge.

### WP1.6 — Characterization + domain test suite (Vitest)
- Owner **Dwight** — `READY` (after WP1.1; absorbs/ports P0.6b fixtures)
- Files: `src/domain/*.test.ts`.
- Acceptance: meaningful scenarios (polarity/tier/value combinations, floor, multiplier, partial, null/invalid answers) pass; coverage is scenario-named, not a vague "full coverage" promise.

### WP1.7 — UI design system (parallel track)
- Owner **Pam** — `READY` (independent of Jim's logic files)
- Files: new `src/styles/tokens.css`, a component inventory doc, pixel SVG icon set.
- Source: Master Plan 2 §3.
- Acceptance: semantic tokens (brand/positive/negative/warning/text/surface + documented alpha + chart tokens) centralized; preserved palette (`#05060D`/`#0D0F1A`/`#181A28`/`#1F2133`, gold `#FFB830`, reds, green/blue, text `#F0F0F8`/`#B8B8D0`/`#9090B0`); type scale 16/24 body, 14/20 secondary, 12/16 metadata; spacing 4/8/12/16/24/32/48; 120/200ms motion tokens with reduced-motion alternatives; one implementation each of core components with documented states; a pixel SVG set (rocket/bolt/warning/settings/library/back/close/check/plus/chart) replacing emoji; visible gold focus ring; rendered contrast checked (not assumed from token names).

**WP1 parallelism map:**
- **Fully parallel from the start:** WP1.7 (Pam, new `src/styles/*` + icons) ‖ WP1.1 (Toby, build config) ‖ Dwight's WP0 inventory. No shared files.
- **Serialized (Jim, dependency chain):** WP1.1 → WP1.2 → {WP1.3, WP1.4}. WP1.3 and WP1.4 both depend on WP1.2 but touch different files (`data/` vs `state/`), so once WP1.2 lands they can run in parallel if Jim is split or a second backend hand joins.
- **After WP1.1:** WP1.5 (Toby) ‖ WP1.6 (Dwight) — different files (`.github/` vs `src/domain/*.test.ts`).
- **Cross-package note:** WP1.1 supersedes/absorbs P0.6a; do P0.6a as the minimal pin first, then grow it in WP1.1. P0.4-csp (WP0) unblocks once inline handlers are gone (P0.4 + WP1.4).

---

## Work Package 2 — Engine B implementation (founder chose B, 2026-10-02)

Spec: `docs/ENGINE.md` (version `b-1`). Engine A is a documented future option, not built. **Blocker:** the gap-policy variant (`ENGINE.md` §4) is still with the founder — WP2.4 and the gap-related fixture flips are `BLOCKED` on that; everything else in WP2 can proceed.

### WP2.1 — Answer validation + eligibility gate
- Owner **Jim** — `READY`
- Files: `src/domain/scoring.ts` (`runEngine` ~`51-92`), `src/domain/validation.ts` (reuse the `[1,2,3]` rule from `parseDraft`), `src/domain/history.ts` (completion count ~`42-43`).
- Spec: `ENGINE.md` §6, §5.
- Acceptance: invalid answers (`"garbage"`, `"0"`, `999`, non-numeric, out-of-range) are rejected, not coerced; they do not score and do not satisfy completion. Completion counts only valid keys for currently-due questions; `null` and orphan keys are excluded. A day is eligible only when every due action is answered or excused with ≥1 non-excused scored action; otherwise No score / pending.

### WP2.2 — Rounding policy (half-away-from-zero)
- Owner **Jim** — `READY`
- Files: new `src/domain/rounding.ts` (`roundHalfAwayFromZero`), applied in `scoring.ts` (mult, rawChange) and `history.ts` (shadow).
- Spec: `ENGINE.md` §2.
- Acceptance: a shared helper replaces every `Math.round` in the engine; negative half-ties round away from zero (`−2.5 → −3`); client and server fixtures agree.

### WP2.3 — Calendar-keyed shadow + single floor + streaks from actualChange
- Owner **Jim** — `READY` (depends on WP2.1 for eligibility)
- Files: `src/domain/history.ts` (`recomputeAll` ~`16-46`), `src/domain/scoring.ts` (remove the inner floor so it applies once).
- Spec: `ENGINE.md` §3.3–3.5.
- Acceptance: shadow sums drag from **calendar** dates t−1/t−2 (not most-recent cache rows); a gap ages shadow to 0. The zero floor is applied exactly once. Engine streaks derive from `actualChange` after shadow+floor; negative intent absorbed by the floor (`actualChange = 0`) does not extend the negative streak or show as lost velocity.

### WP2.4 — Gap / missed-day policy
- Owner **Jim** — `BLOCKED` (founder picks Variant 1 or 2 — `ENGINE.md` §4)
- Files: `src/domain/history.ts`; if Variant 2, a new `src/domain/trajectory.ts` for dated system adjustments.
- Acceptance (Variant 1): unknown/pending/no-action days carry velocity unchanged; multiplier streak resets when a gap day closes. (Variant 2 adds 3% decay, one positive-streak grace, retained negative streak — needs its own sub-spec first.)

### WP2.5 — Immutable question-set revision + engine-version stamp (AUDIT-05)
- Owner **Jim** (schema overlaps WP3) — `BLOCKED` (needs Supabase access; coordinate with WP3 schema)
- Files: `src/data/repositories.ts`, new `supabase/migrations/*.sql`, `src/domain/history.ts` (score from the entry's stored revision, not live questions).
- Spec: `ENGINE.md` §7 E6, §8.
- Acceptance: re-tiering or removing a question does not change any already-saved day's score; each entry carries the question-set revision + engine version used.

### WP2.6 — Score explanation surface
- Owner **Pam** (UI) + **Jim** (data) — `READY` (after WP2.3)
- Files: `index.html`/summary overlay + a formatter that reads the engine result.
- Spec: `ENGINE.md` §3.6.
- Acceptance: the day summary shows raw, multiplier, shadow, intendedChange, and actualChange separately, with copy generated from fixture values (no hand-typed numbers); engine streaks are named distinctly from check-in/habit streaks.

### WP2.7 — Fixture updates: flip KNOWN-BUG tests to intended values + add new fixtures
- Owner **Dwight** — `READY` (lands per-case as each Jim ticket merges; gap cases `BLOCKED` on WP2.4)
- Files: `tests/engine.characterization.test.mjs`, new `tests/engine-b.fixtures.test.mjs`.
- Spec: `ENGINE.md` §9 table.
- Acceptance: each `[KNOWN-BUG]` test is deliberately updated to the Engine-B intended value (validation family → not scored/partial; AUDIT-10 gap → streak 1 / shadow 0; AUDIT-05 → stays 108); new fixtures cover the negative-tie rounding, actualChange-vs-finalDv streaks, calendar-keyed shadow, and the §7 worked examples (first day, partial, all-excused, backfill, re-tier, floor). The golden app.js-extraction tests are retired or re-pointed as the engine moves fully into `src/domain/`.

**WP2 parallelism map:**
- **Serialize within Jim (shared files `scoring.ts`/`history.ts`):** WP2.1 → WP2.2 → WP2.3. WP2.5 is separate (schema/repositories) and blocked on Supabase.
- **Parallel:** WP2.7 fixtures (Dwight) follow each Jim merge case-by-case; WP2.6 explanation UI (Pam) after WP2.3; both independent of each other's files.
- **Blocked on founder:** WP2.4 (gap variant) and the two AUDIT-10 fixture flips in WP2.7.
- **Blocked on Supabase access:** WP2.5 (immutable revisions) — coordinate with WP3.

---

## Deferred to later work packages
Immutable revision schema + idempotent mutations (WP3, overlaps WP2.5), full daily product + PWA/offline (WP4), hardening/beta (WP5). Listed so no one pulls them into foundations or the engine package.
