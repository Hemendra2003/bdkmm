# BDKMM / MOMENTUM — Product Brief

Author: Oscar · Date: 2026-10-02 · Base commit: `eb31f0e` · Branch: `oscar/brief-bdkmm-1`
Repo: https://github.com/Hemendra2003/bdkmm · Read from code + git log only. No written founder brief exists.

Legend: plain text = read directly from code/git. **ASSUMPTION** = my inference, not confirmed.

---

## 1. What the app does today

MOMENTUM is a single-page, vanilla-JS web app for **daily self-tracking framed as a rocket's velocity**. Each day the user answers a set of habit questions; an engine turns the answers into a "delta-V" (thrust minus drag), applies a streak multiplier, and updates a running "velocity" number. The dashboard shows velocity, an animated flame that scales with velocity, a status line ("BUILDING MOMENTUM", "COLLAPSE DETECTED"), week and month line graphs, and streak badges.

- **Files:** `index.html` (56 KB, all markup + CSS), `app.js` (75 KB, all logic), `auth.js` (Supabase auth), `storage.js` (Supabase data layer). No `package.json`, build step, tests, or CI. Scripts loaded via `<script>` tags; Supabase JS v2 from jsDelivr CDN (`index.html:929-932`).
- **Target user — ASSUMPTION:** a discipline / self-improvement–minded individual. The question library leans hard on fitness, "deep work", and a "KILLERS" category (doomscrolling, porn, junk food, procrastination) — `app.js:68-148`. One user per account; no social/sharing features.
- **Main journey:**
  1. Sign in — email+password or Google OAuth, via Supabase (`auth.js`).
  2. Dashboard loads (`bootMomentum`, `app.js:1428`): runs one-time legacy migration, loads the user's questions, recomputes all history, renders.
  3. "Log today" → `openLog` (`app.js:482`) opens a bulk questionnaire of all active questions.
  4. `finishQuestionnaire` (`app.js:540`) upserts the day's answers to Supabase, recomputes, shows a **summary overlay** (thrust / drag / velocity / multiplier / streak + a 7-day graph), then returns to dashboard.
  5. Side pages: **Habits** (per-habit performance, `renderHabitsPage`), **Manage Questions** (add from a library or write custom, set tier/polarity, `_buildMQPage`), **Why / The Engine** (static explainer).
- **Scoring model** (`app.js:43-56, 244-285`): every question has a `polarity` (positive/negative) and a `tier` (S/A/B). `TIER_WEIGHTS` maps (polarity, tier, answer-strength 0/1/2) → a signed score. `runEngine` sums positives into `thrust`, negatives into `drag`; `rawDv = thrust − drag`; a multiplier rewards positive streaks (≤2.2×) and punishes negative streaks (≤3.5×). `recomputeAll` also subtracts a "shadow" penalty carried from the prior 1–2 days' drag. Velocity floors at 0 and starts at 100.

---

## 2. How storage and auth actually work

**Auth** (`auth.js`): wraps `supabase.createClient(SB_URL, SB_KEY)` with a **publishable (anon) key hardcoded in the file**. Supports email/password sign-in, sign-up (min 6 chars), and Google OAuth. `Auth.init` wires `onAuthStateChange`; `bootMomentum` runs on any session, and the UI locks to an auth screen when there's no session (`app.js:1449-1463`).

**Storage** (`storage.js`): Supabase-only ("local-first later" is a stated TODO, `storage.js:2`). Three tables:
- `momentum_entries` (user_id, date, answers JSONB, updated_at) — upsert on conflict `user_id,date`.
- `user_questions` (key, text, opts, polarity, tier, is_fixed, source, sort_order) — upsert on conflict `user_id,key`.
- `user_settings` (legacy_migrated, migrated_at) — one row per user, gates the one-time migration.

**Security & data risks:**
- **RLS dependence (needs confirmation).** `loadEntries` and `loadQuestions` select **without a `user_id` filter in the query** (`storage.js:9-17, 57-65`) — they rely entirely on Supabase Row-Level Security to scope rows to the caller. Writes/deletes do filter by `user_id`. **ASSUMPTION:** RLS is enabled on all three tables. If it is not, any logged-in user can read (and the policy-less tables may let them write) every other user's data. This is the single most important thing to verify; it cannot be checked from client code. → founder question.
- **Anon key in client is normal** for Supabase *provided* RLS is on; it is not a secret. The prior commit `eb31f0e` removed a tracked `.claude/settings.local.json` that "pointed API traffic at a third-party host with an embedded token" — good hygiene; worth a one-time check that no other secret is tracked.
- **Fragile "delete all" hack:** `deleteEntries` uses `.neq('date','0000-00-00')` to match every row (`storage.js:34`). Works but brittle.
- **No offline / no optimistic UI:** every log, question edit, and page load needs network + a live session; failures surface as `alert()`.

---

## 3. Visible bugs and gaps

1. **`DEMO_DATE_OVERRIDE='2026-06-27'` is hardcoded on (`app.js:33`).** "Today" is pinned to that date app-wide, so real daily logging writes to the wrong date and graphs are frozen. **Must be `null` for real use** — blocks production. (This is demo scaffolding, not a logic bug, but it's the top correctness issue.)
2. **Engine computes per-habit contributors but never shows them.** `runEngine` returns `thrustItems` / `dragItems` (`app.js:251-263`) and nothing in the app renders them. The user sees a score change with no "what caused it" breakdown. (Basis for the recommended slice below.)
3. **No tests, no `package.json`, no CI.** The pure scoring engine (`scoreForAnswer`, `runEngine`, `recomputeAll`, `checkBalance`) is untested despite being the product's core and having no network dependency.
4. **No password reset / email-confirm resend.** Sign-up hints that email confirmation "may" be required (`auth.js:78`) but there's no forgot-password or resend path.
5. **Single 75 KB `app.js` with globals wired via inline `onclick`.** Hard to unit-test or refactor; everything is on `window`.
6. **Error UX is `alert()`** throughout (boot, save, load, import). No retry, no inline messaging.
7. **Perf/battery:** the starfield canvas animation runs an unconditional `requestAnimationFrame` loop whenever the app is open (`app.js:1-20`).

---

## 4. Recommended first slice

**Slice: "Why did my score change?" — show the top thrust and drag contributors on the daily summary.**

Why this one: it is genuinely user-visible (answers the obvious "what moved my number"), the data **already exists** (`thrustItems`/`dragItems`), it needs **no Supabase change and no founder dependency**, and its core is the pure engine — so it's the natural vehicle for introducing the test harness. Small, reversible, fully verifiable.

**Acceptance criteria:**
- After logging a day, the summary overlay lists the day's **top 3 thrust** habits (name + `+score`) and **top 3 drag** habits (name + `−score`), each sorted by absolute score descending.
- If there are no positive (or no negative) contributors, that column shows a clear empty state ("No thrust today" / "No drag today") rather than a blank.
- Scores shown match what the engine used for that day's delta-V (same numbers, no recomputation drift).
- No change to stored data, scoring math, or the dashboard; closing the summary behaves as before.

**Files it touches:** `app.js` (`runEngine` return already has the data; add a sorted/sliced accessor + render in `showSummary`, ~`app.js:560-593`), `index.html` (summary-overlay markup + CSS for the two lists). No `storage.js`/`auth.js` changes.

**Ticket split:**
- **Jim (logic/storage):** add a pure helper, e.g. `topContributors(computed, n=3)`, returning sorted top-N thrust and drag items from `thrustItems`/`dragItems`; keep it side-effect-free and exported/testable. No storage change.
- **Pam (UI):** add two labelled lists to the summary overlay in `index.html` + CSS, and render them in `showSummary` using Jim's helper; include the empty states. Match existing summary styling (mono font, green/red accents).
- **Dwight (tests):** stand up the test harness (see §5) and unit-test `scoreForAnswer`, `runEngine` (thrust/drag/items correctness), and `topContributors` (sorting, slicing, empty cases). This is the first code to run under the new runner.

Dependency order: Jim's helper → Pam's render; Dwight can start in parallel against `scoreForAnswer`/`runEngine` and add `topContributors` tests once Jim lands.

---

## 5. Should a test setup be the first ticket?

**Yes — a minimal Node test runner should land as part of this slice, owned by Dwight, before or alongside Jim's helper.** Recommendation: **Node's built-in `node:test` + `node:assert`** (no dependency to install — the brief forbids installing packages, and this needs none). The blocker is that the engine functions live inside `app.js` as browser globals with no module exports. Smallest viable approach:
- Dwight extracts the **pure** functions (`TIER_WEIGHTS`, `scoreForAnswer`, `runEngine`, `checkBalance`, and later `topContributors`) into a small `engine.js` that works both as a browser global and a CommonJS/ESM module (a guarded `module.exports`), with `index.html` still loading it as a plain script. This keeps the app behaviour identical while making the core importable.
- Add a `package.json` with only a `"test": "node --test"` script (no deps).

Playwright is overkill for slice 1 (needs a running Supabase session and browser download). Defer end-to-end UI tests until there's a stable auth/data fixture.

---

## 6. Questions only the founder can answer (max 3)

1. **Is Supabase Row-Level Security enabled and enforced on `momentum_entries`, `user_questions`, and `user_settings`?** `loadEntries`/`loadQuestions` don't filter by `user_id`, so without RLS every user can read others' data. This may be the first thing to fix instead of a feature slice.
2. **Is this a personal/demo project or intended for real external users?** It decides whether to turn off the demo date override, verify RLS, and add password reset now — or keep moving on features.
3. **Who is the intended user and what is the one outcome they want?** (e.g. "stay consistent on my own habits" vs. "coach/track others".) No written brief exists; this anchors every prioritisation call after slice 1.
