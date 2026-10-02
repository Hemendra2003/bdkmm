# MOMENTUM — UX-0: align meaning

Author: Oscar · Date: 2026-10-02 · Branch: `ux0-alignment` · Base: `main` 2c011db
Purpose: the shared vocabulary and inventory so Pam can start the UX-1 prototype in `/app/`. Sources: `docs/MASTER-PLAN-2-ui-ux.md` §2/§5/§8, `docs/ENGINE.md` (b-1, Variant 1), `docs/BACKLOG.md`, `docs/DESIGN-SYSTEM.md`, `src/app/`.
Scope: docs only. "Legacy" = the vanilla app at `/` (`index.html`+`app.js`). "React" = `/app/` (`src/app/`).

---

## 1. State glossary — every user-visible status → a real state

Each UI label must map to one engine/data state. No blended or faked states. Engine refs are `ENGINE.md` sections; data refs are `src/data/repositories.ts`.

| UI label / copy | Real meaning | Backed by | Built today |
|---|---|---|---|
| **Start check-in** | No draft and no entry for the local date | `entries.get(today)` null + no local draft | React: entry read ✓, draft ✗ |
| **Continue check-in** | A local draft or a partial (score-pending) entry exists | local draft (IndexedDB) / entry with unanswered due actions | ✗ (no draft store) |
| **Edit check-in** | A confirmed entry exists for the date | `entries.get` non-null | React shows "recorded" only |
| **Draft saved on this device** | Device draft, not submitted; no score, no streak | account-scoped IndexedDB draft (interim localStorage, P0.5) | ✗ (P0.5 interim exists in legacy) |
| **Check-in queued · Waiting to sync** | Submitted offline; acceptance pending | outbox op (ENGINE.md §5) | ✗ |
| **Check-in saved** | Server accepted the finalization | `entries.save` resolved (server receipt) | React: save path ✗ (read-only today) |
| **Score pending** | Confirmed check-in with unresolved due actions | eligibility gate fails (ENGINE.md §5/§6) | ✗ (not surfaced) |
| **Scored: new momentum + change** | Eligible finalized day | `runEngine` → thrust/drag/mult/shadow/actualChange (ENGINE.md §3, b-1) | engine ✓ (WP2 core), UI ✗ |
| **No action score** | No eligible/scheduled actions, or all excused | ENGINE.md §5 | ✗ |
| **Recalculating momentum** | Confirmed check-in, historical replay still running | async replay (ENGINE.md §8) | ✗ |
| **"124 km/s · last scored day 28 Sep"** | Last eligible day's `newVelocity` + its calendar date | `recomputeAll` last eligible result | ✗ (React shows a boolean) |
| **Conflict / Needs review** | Stale revision on write (another device/day) | `updated_at` / expected-revision check | column ✓, check ✗ |
| **Check-in streak / habit streak / adherence** | Distinct metrics, never interchangeable | metric dictionary (MASTER-PLAN-1 §3) | ✗ |
| Status line ("Building momentum"…) | Derived from b-1 **actualChange** streaks (not pre-floor) | ENGINE.md §3.5 | legacy uses pre-floor `finalDv` — reconcile |

Finalization vocabulary (ENGINE.md §5): **unrecorded · completed · partial · not completed · excused**. "Skip for now" = unrecorded; "Excuse" = explicit, records a reason. Missing data is never silently a success/failure/neutral.

---

## 2. Screen & journey inventory (MASTER-PLAN-2 §5 A–H)

Status: **Legacy /** = exists in vanilla app (often with audited bugs); **React /app/** = built / partial / none.

| § | Journey | Legacy / | React /app/ |
|---|---|---|---|
| A | Welcome, auth, recovery | password + Google sign-in, no recovery/resend, global Enter bug | `SignIn` password-only; `store` loading/signed-out/signed-in/error; no Google, no recovery |
| B | First-use setup & migration | legacy 15→3-question seed + forced 10-min/quota (buggy, AUDIT-14) | none |
| C | Today | dashboard: velocity, flame, status line, week/month graphs | `Today` read-only: date + "recorded?" boolean + question list + sign out |
| D | Daily check-in | bulk questionnaire, partial save, same-day edit | none (no editor) |
| E | Results & engine explanation | summary overlay (thrust/drag/vel/mult/streak + week graph) | none |
| F | Habits, library, routine | manage-questions + library drawer + habits averages | none |
| G | Progress, history, reflection | week/month SVG graphs, habit filters (rolling-window bug, AUDIT-17) | none |
| H | Settings, trust, support | dev tools (export/import/reset) — must be removed in prod | none |

Shared infra in React today: design-system components (`Button`, `Card`, `Field`, `StatusLine`), session controller with generation guards, typed repositories with user-id filters. These are the foundation UX-1 builds on.

---

## 3. Contracts (gate before the journeys that depend on them)

| Contract | What it fixes | Status | Owner |
|---|---|---|---|
| **Date** | local calendar date (not UTC), captured at form open, timezone/DST safe | **done** (`src/domain/dates.ts` `localDateKey`, used by store) | Jim (P0.3) |
| **Excuse** | explicit "Excuse today" with reason, excluded from scoring; distinct from Skip | **missing** (data model answer is `1\|2\|3\|null`, no excuse) | Jim + product — **founder decision Q3** |
| **Revision (immutable history)** | per-entry question-set + engine-version stamp so re-tier doesn't rewrite the past (AUDIT-05) | **in progress** (WP2.5) | Jim |
| **Sync / outbox** | durable draft + queued submission + conflict (IndexedDB + op IDs) | **missing** (interim localStorage draft only) | Jim (WP4) |
| **Migration / cutover** | legacy→b-1 boundary: preserve velocity, reset multiplier streaks/shadow, read-only pre-cutover | **missing** (legacy per-user migration exists in `app.js`; b-1 cutover unbuilt) | Jim + founder |

Dependency rule (§8): auth contracts before recovery; date/revision before past-day & routine edits; trusted engine before confirmed-score copy; outbox before any offline claim.

---

## 4. UX-1 build order for Pam (PR-sized slices)

Ship Today + check-in first; each slice is one reviewable PR against `/app/`.

1. **PR1 — Shell + design system wiring.** Routes/nav for Today · Habits · Progress (MASTER-PLAN-2 §4); apply `DESIGN-SYSTEM.md` tokens + SVG icon set; responsive at iPhone-SE width; loading/empty/error shells. *Blocks nothing; unblocks all screens.*
2. **PR2 — Today (§5C).** Primary action resolves Start/Continue/Edit from entry+draft; show last-scored velocity + its real date (not a boolean); week check-in count; at most one nudge; honest empty/gap/zero states. Uses `store` as-is plus a `lastScored` selector.
3. **PR3 — Daily check-in editor (§5D).** Radio options with non-color selection, answered/unanswered progress, **Save check-in** independent of score readiness, "Skip for now" (unrecorded). Local draft via interim localStorage (account+date+base-revision keyed). *Needs: Excuse decision (Q3), draft contract (interim ok).*
4. **PR4 — Results & explanation (§5E, Engine B card).** Thrust→Drag→Multiplier→Shadow→Change→Velocity from the b-1 engine result; separate Pending / No-score / Scored / Queued states; actual comparison dates. *Needs: WP2 engine wired into store to produce a computed result + eligibility.*
5. **PR5 — Auth polish (§5A).** Google sign-in states, password recovery, resend-with-cooldown. *Needs: founder email config (Q1).*

Then UX-2+ (setup/migration, habits, progress, history, settings) per §8 phases.

---

## 5. Founder decisions needed (max 3)

1. **Email confirmation & password recovery.** Staging has confirm-email OFF. Do we ship beta with it off and add only password-recovery email?
   **Recommend:** confirm-email OFF for beta (frictionless signup), but configure recovery email so §5A recovery and PR5 can ship. Needs the founder to enable recovery email + redirect allowlist in Supabase.
2. **Onboarding starter set & scored mood/sleep.** Plan drops the forced 10-question / negative-quota and the locked scored mood/sleep.
   **Recommend:** ship one small balanced **optional** starter preset (3–5 habits), with mood/sleep as **optional unscored reflection**, not mandatory scored questions. Approve the preset contents.
3. **Excuse in the first release.** "Excuse today" needs a new data-model state (currently none).
   **Recommend:** **defer Excuse to UX-3**; UX-1/2 ship only "Skip for now" (unrecorded). Keeps PR3 small and avoids a schema change mid-prototype.

---

*Acceptance (UX-0 gate, §8): every status above maps to a real state; no hidden engine blend or false completion. Met.*
