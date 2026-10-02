# MOMENTUM — Engine B specification (frozen contract)

Author: Oscar · Date: 2026-10-02 · Branch: `docs-engine-b` · Base: `b8fd290`
Decision: **Founder chose Engine B on 2026-10-02** — repair and document the current thrust/drag engine. Engine A remains documented as a future option (see `docs/ENGINE-DECISION.md` appendix), not implemented.
Source of truth for *current* behavior: `src/domain/scoring.ts`, `src/domain/history.ts`, and `tests/engine.characterization.test.mjs` (golden tests that lock today's output, including bugs). Contract source: `docs/MASTER-PLAN-1-core.md` §4 (Option B + "Engine gate acceptance").

> **Open sub-decision (founder):** the **missed-day / gap policy** is not yet chosen. Both variants are specified in §4 below and marked **PENDING**. Nothing downstream of the gap rule (decay, grace, synthetic shadow) may be implemented until the founder picks one. Everything else in this document is frozen.

Momentum is a self-reported game mechanic, not a measure of wellbeing. Engine B keeps the simulation's character and fixes its correctness, dates, history, and explanation.

---

## 1. Constants (frozen — do not change without a new engine version)

### 1.1 Per-answer weight table
Attainment is reported as `strengthIndex` 0 / 1 / 2 = **lower / partial / full**. Binary habits use the two endpoints (0 and 2). This table is `TIER_WEIGHTS` in `src/domain/scoring.ts:28-39`, preserved verbatim from the legacy engine.

| Habit type / tier | Lower (0) | Partial (1) | Full (2) |
|---|---:|---:|---:|
| Build (positive) S | −5 | 0 | +8 |
| Build A | −3 | 0 | +5 |
| Build B | −1.5 | 0 | +3 |
| Limit/Avoid (negative) S | −10 | −4 | 0 |
| Limit/Avoid A | −6 | −2 | 0 |
| Limit/Avoid B | −3 | −1 | 0 |

Notes:
- **B keeps the fractional −1.5** for Build-B lower attainment (unlike Option A, which uses integer units). It is frozen as-is.
- These are **game weights, not health advice.** Lower Build attainment also produces drag — the labels "positive/negative" must not hide that.
- Lookup fallbacks are frozen: unknown polarity → positive table; unknown tier → B row (`scoring.ts:46-47`).

### 1.2 Multiplier constants
- Positive cap **2.2**, negative cap **3.5**.
- Positive curve base `log(1.8)`, coefficient `0.25`.
- Negative curve exponent `1.4`, coefficient `0.15`.

### 1.3 Shadow constants
- Shadow weights **0.30 × drag(t−1) + 0.12 × drag(t−2)** over **calendar** dates (see §3.3). (Legacy produces the same 0.30/0.12 coefficients via `0.5 × (0.6·drag₁ + 0.24·drag₂)` but keys them to the two most-recent *cache rows*, not calendar dates — that is the bug B fixes.)

### 1.4 Other
- New accounts start at **velocity 100**.
- **Zero floor:** `velocity = max(0, …)`, applied **once** (see §3.5).
- Engine version tag: **`b-1`** (stamp on every derived result and migration record).

---

## 2. Rounding policy (frozen, versioned)

**Half-away-from-zero**, applied identically in client and server fixtures. This differs from legacy JavaScript `Math.round` (half-up / half-toward-+∞) on negative ties and **must** be versioned.

- `+2.5 → +3`, `−2.5 → −3` (B). Legacy `Math.round(−2.5) = −2`.
- Define one shared helper `roundHalfAwayFromZero(x)`; use it for the multiplier, the raw change, and the shadow. Do not mix with `Math.round`.
- Golden fixtures must include at least one negative half-tie to pin the difference from legacy.

Where rounding applies (order in §3): (a) multiplier → 2 decimals; (b) `rawChange = round(raw × mult)`; (c) `shadow = round(0.30·drag(t−1) + 0.12·drag(t−2))`.

---

## 3. Daily contract (eligible, finalized day)

A day is scored only when it is an **eligible finalized check-in** (see §5). Draft/partial/pending days produce **no score** and carry velocity unchanged.

### 3.1 Thrust, drag, raw
Sum positive contributions as **thrust**, absolute negative contributions as **drag**. `raw = thrust − drag`. Explicitly **excused** items contribute nothing and are labelled excluded (not scored as 0-attainment). Only **validated** answers (integers 1–3, see §6) are counted.

### 3.2 Multiplier (from PRIOR streaks — no circular definition)
Pick today's multiplier from the **prior** engine streak and the sign of `raw`:
- `raw > 0`: `mult = min(2.2, 1 + log(priorPositiveStreak + 1) / log(1.8) × 0.25)`
- `raw < 0`: `mult = min(3.5, 1 + (priorNegativeStreak + 1)^1.4 × 0.15)`
- `raw = 0`: `mult = 1`

Round `mult` to 2 decimals. (`scoring.ts:76-78` already reads prior `posS`/`negS` passed in — keep that; the fix is ensuring the caller passes **calendar-prior** streaks, §3.4.)

### 3.3 Shadow (from CALENDAR predecessors)
`shadow = round(0.30 × drag(t−1) + 0.12 × drag(t−2))`, where `t−1` / `t−2` are the **calendar days before this date**. Only **resolved canonical action results** supply drag; a pending or absent day contributes **0** — do not invent drag. Under the conservative gap policy this means a gap ages shadow out to 0 (fixes AUDIT-10). `history.ts:29-33` currently reads the two most-recent cache rows — replace with a calendar-keyed lookup.

### 3.4 Intended change and velocity
```
rawChange     = round(raw × mult)          // §2
intendedChange = rawChange − shadow
velocity      = max(0, previousVelocity + intendedChange)   // single floor
actualChange  = velocity − previousVelocity
```
`previousVelocity` is the velocity of the **calendar-prior eligible day** (or 100 for the first). Do **not** apply the floor twice (legacy floors in both `runEngine` and `recomputeAll`).

### 3.5 Engine streaks (from ACTUAL change, computed once)
After shadow and the single floor, compute from `actualChange`:
- `actualChange > 0`: positiveStreak += 1; negativeStreak = 0.
- `actualChange < 0`: negativeStreak += 1; positiveStreak = 0.
- `actualChange = 0`: **both reset to 0** (this candidate).

Negative intent that is absorbed by the zero floor (velocity already 0) yields `actualChange = 0` and is **not** displayed as lost velocity, and does not extend the negative streak. (Legacy computes streaks from the pre-floor `finalDv` — that is the bug this fixes.)

### 3.6 Explanation (generated from the same fixtures)
Every day's explanation shows, separately: **raw**, **multiplier**, **shadow**, **intendedChange**, and **actualChange**. UI copy is generated from fixture values — never hand-written numbers. Engine streaks are a distinct name from check-in and habit streaks (§ metric dictionary in the master plan).

---

## 4. Gap / missed-day policy — **PENDING founder choice**

Both variants share: scheduled off-days, planned rest, reflection, and excuses are **never** silently treated as failed actions; the multiplier reset is separate from the habit-success-streak rules; all adjustments are deterministic, dated, versioned, and replayable through closed dates.

### Variant 1 — Conservative carry-over (plan's recommended default)
- An unrecorded / pending / no-action day **carries velocity unchanged**.
- Multiplier streak continuity **resets only when that local day closes** with no eligible finalized check-in. An unfinished *today* cannot prematurely reset yesterday's continuity.
- Shadow applies **only on an eligible scored day**, using its calendar predecessors (§3.3); a gap day supplies no drag, so shadow ages to 0.
- No decay, no grace.

### Variant 2 — Decay + grace (plan's optional attached variant, **adds penalties**)
- Apply shadow on unlogged days; **decay velocity by 3%** per qualifying missed day.
- Permit **one** missed-day **positive-streak grace** (a single gap does not break a positive streak).
- **Retain the negative streak** across gaps.
- Requires, before implementation: exact qualifying-date set, off-day/rest/no-action behavior, precise order and rounding, zero-floor interaction, grace-reset conditions, and how backfill replaces the synthetic result. Modelled as dated, versioned **system trajectory adjustments**, separate from action scores and check-in status; they cannot fabricate answers, finalize a check-in, or earn a streak.

**Impact on the worked examples and KNOWN-BUG fixes below:** the two "month-long gap" cases (AUDIT-10) resolve identically in *outcome* for a long gap (streak resets, shadow 0) but by different mechanisms. For a **single** missed day the variants differ: Variant 1 resets the positive streak; Variant 2 grants one grace. Examples in §7 are given for **Variant 1**; the Variant-2 delta is noted inline.

---

## 5. Finalization interaction

- Distinguish **unrecorded, completed, partial, not completed, excused** (master plan §3).
- **Save draft** preserves work, publishes no score, advances no streak. Autosave never advances a streak.
- **Save check-in** is a deliberate finalization. It may contain unanswered actions and still count as a check-in, while the **action score remains pending**.
- A **score is eligible** only when **every due action is answered or excused**, with **at least one non-excused scored action**. Reflection-only / no-action / all-excused days show **No action score**.
- Editing a working draft of a finalized check-in leaves the committed result intact. Finalizing a replacement may change history — **preview the effect**; if it leaves unresolved actions, the old action contribution is removed and later results replay (§8).
- Offline finalization is provisional until a server receipt; canonical revision changes after receipt.

---

## 6. Answer validation (fixes the AUDIT-11 family)

- Valid answer values are integers **1, 2, 3** (→ strengthIndex 0/1/2). `parseDraft` in `src/domain/validation.ts` already enforces `[1,2,3]` for drafts; the **scoring path must enforce the same** instead of coercing.
- Reject / flag-invalid rather than coerce: `"garbage"`, `"0"`, `999`, non-numeric, out-of-range. An invalid answer is **not** scored and does **not** satisfy completion.
- **Completion counts only valid keys for currently-due (revision) questions.** Orphan keys from removed questions and `null` values do **not** count toward completion.
- Distinguish **unanswered**, **excused**, and **invalid** — none is a silent success, failure, or neutral.

---

## 7. Worked examples (Engine B, Variant 1 gap policy, version `b-1`)

Questions: one Build-S habit `sleep` and one Limit/Avoid-S habit `vice` unless noted. Rounding = half-away-from-zero.

**E1 — First day, one Build-S "full".** `sleep=3`. thrust 8, drag 0, raw 8, priorPos 0 → mult 1.00, rawChange 8, no predecessor → shadow 0, intendedChange 8, velocity 100→**108**, actualChange +8, posStreak 1, negStreak 0.
*(Matches current golden test; unchanged.)*

**E2 — Negative-streak amplification.** `vice=1` (lower), prevV 100, priorNeg 3. raw −10, mult `min(3.5, 1+(4)^1.4×0.15)` = 2.04, rawChange round(−20.4) = **−20**, shadow (no eligible predecessors here) 0, intendedChange −20, velocity **80**, actualChange −20, negStreak 4.
*(Matches current golden test; unchanged — no negative half-tie in this case.)*

**E3 — Partial day.** 3 due actions, 1 answered. **Not eligible → No score.** velocity carried unchanged; `partial=true`, no streak change. *(Legacy would score it; B does not.)*

**E4 — All-excused / no-action day.** Every due action excused. **No action score**; may still count as a check-in for the check-in streak; velocity unchanged.

**E5 — Backfill a gap day.** A previously-pending day is filled later. Its canonical result is computed from its **own** calendar position with historical definitions, then the **suffix replays** (§8); the explanation states what adjusted and why. Synthetic/decay values (Variant 2 only) are replaced by the real result.

**E6 — Re-tier / archive after the fact (AUDIT-05 fix).** A day saved while `sleep` was S-tier keeps its **S-tier score forever**. Changing `sleep` to B-tier later does **not** alter that saved day. Requires the immutable question-set revision + engine-version stamp per entry (WP3). Intended: the stored day stays at velocity **108**, not 103.

**E7 — Zero floor, single application.** One Limit/Avoid-S "lower" day (`vice=1`), prevV 5, priorNeg 0. raw −10; negative multiplier at priorNeg 0 = `min(3.5, 1 + (0+1)^1.4 × 0.15)` = **1.15** (per §3.2); rawChange = round(−10 × 1.15) = round(−11.5) = **−12** (half-away-from-zero); shadow 0; intendedChange −12; velocity `max(0, 5−12)` = **0**; actualChange −5. Because actualChange ≠ 0 it is negative → negStreak increments. But if prevV were already 0: velocity 0, actualChange 0 → **no streak change, not shown as a loss** (§3.5). (This example isolates the single-floor behavior; the multiplier follows the frozen §3.2 formula, so there is no `mult = 1` case for a negative day — the minimum negative multiplier is 1.15.)

---

## 8. Replay boundary and legacy cutover

### 8.1 Replay
- Derive scores by replaying from a **valid preceding checkpoint**, sorted once, paginated completely — do not recompute all history on every tap.
- A correction/backfill/delete **invalidates checkpoints from the earliest affected date** and replays the suffix with **original (revision) definitions**.
- Replay must be deterministic and idempotent; if asynchronous, expose **"Recalculating momentum"** with the last valid result's date until trusted replay completes. This is distinct from action-score-pending.

### 8.2 Cutover (from legacy to `b-1`)
- Freeze engine version `b-1` and start at a **visible boundary date**.
- **Recommended transition:** preserve the last defensible legacy **velocity** as the new-era baseline, but **reset multiplier streaks and pre-cutover shadow carry to zero** at the boundary. Record this reset in the transition manifest and the user-facing explanation.
- Pre-cutover records remain **available and read-only**, annotated with their legacy era. Ordinary editing cannot silently move a pre-cutover day into the `b-1` formula; offer an explicit legacy-review/recovery path.
- Legacy historical definitions were never versioned — reconstruct only what evidence supports and label the limitation. "B resembles the old engine" does **not** mean all fixes preserve old numeric history (E6, rounding, eligibility all change values).

---

## 9. Which KNOWN-BUG characterization tests Engine B fixes

These tests in `tests/engine.characterization.test.mjs` currently assert the **wrong** output on purpose. When B lands, each should be updated **deliberately** to the intended value. (Dwight owns this — see `docs/BACKLOG.md`.)

| Test (audit id) | Current (asserted wrong) | Engine B intended | Fix mechanism |
|---|---|---|---|
| non-numeric `"garbage"` (AUDIT-11) | `drag = 5` (coerced to worst) | answer rejected; **drag 0**; not counted toward completion | §6 validation |
| answer `"0"` (AUDIT-11) | `drag = 5` (treated as 1) | rejected; **drag 0** | §6 validation |
| out-of-range `999` (AUDIT-11) | `thrust = 8` (clamped to best) | rejected; **thrust 0** | §6 validation |
| null counts as complete (AUDIT-11) | `partial = false`, thrust 0 | **`partial = true`** (unanswered), No score / pending | §5, §6 |
| orphan key inflates count (AUDIT-11) | `answeredCount = 2`, `partial = false` | **`answeredCount = 1`, `partial = true`** | §6 (count only due keys) |
| month-gap 2-day streak (AUDIT-10) | `posStreak = 2` | **`posStreak = 1`** (gap resets continuity) | §3.5 + §4 V1 (V2: one-day grace, long gap still resets) |
| shadow survives month gap (AUDIT-10) | `shadow = 2` | **`shadow = 0`** (no calendar predecessor drag) | §3.3 calendar-keyed shadow |
| re-tier rewrites saved day (AUDIT-05) | `108 → 103` after S→B | **stays 108** (immutable revision) | §7 E6 + WP3 revisions |

Also deliberately changed from `[CURRENT-BEHAVIOR]` (not bugs, but B alters them — update or add fixtures):
- **Rounding** half-away-from-zero vs legacy half-up on negative ties (§2) — add a negative-tie fixture.
- **Streaks from actualChange** after a single floor, not pre-floor `finalDv` (§3.4–3.5).
- **Shadow keyed to calendar dates**, not most-recent cache rows (§3.3) — the "shadow accrues from two most-recent entries" test must be re-expressed over consecutive calendar dates.

---

## 10. Gate acceptance checklist (plan §4)

- [ ] Every constant, rounding step, gap rule, finalization interaction, zero-floor outcome, and replay boundary recorded here (this doc) — **gap rule pending founder**.
- [ ] Worked fixtures for first-day, gap, partial, all-excused, backfill, re-tier/archive, shadow-sign-change, and floor (§7; shadow-sign-change fixture to be added with implementation).
- [ ] UI explanations generated from the same fixture values.
- [ ] User-understanding test of negative multipliers and shadow before implementation is declared complete.
- [ ] Legacy snapshot + cutover plan (§8) approved.
- [ ] Founder picks gap Variant 1 or 2 (§4).
