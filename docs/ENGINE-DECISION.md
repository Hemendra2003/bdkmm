# MOMENTUM — Engine Decision: A vs B

Author: Oscar · Date: 2026-10-02 · Source: `docs/MASTER-PLAN-1-core.md` §4.

> **DECISION (founder, 2026-10-02): Engine B** — repair and document the current thrust/drag engine. The frozen contract is in **`docs/ENGINE.md`** (version `b-1`). Engine A is kept as a **future option** (appendix below), not implemented. One sub-decision remains open: the **missed-day / gap policy** (carry-over vs 3% decay + grace) — see `docs/ENGINE.md` §4.

This file records the comparison that led to the choice and preserves Engine A for future reference. The plan is explicit: **no user-facing A/B switcher, and do not blend the two formulas.**

Both options share the same non-negotiables: valid immutable definitions, explicit exclusions, deterministic replay, trusted server commits, a visible legacy cutover, and a zero-velocity floor starting new accounts at 100. Neither is scientifically validated; momentum is a game mechanic over self-reported actions.

---

## The comparison (for the record)

| | **Option A — Normalized daily performance** | **Option B — Repair the current thrust/drag engine** (CHOSEN) |
|---|---|---|
| **Core idea** | Each day scores 0–100% of the routine you actually did, then nudges velocity by a small bounded step. | Keep the existing physics sim (thrust − drag, streak multipliers, shadow drag), fix its correctness, dates, and explanation. |
| **Daily change** | `P = round(100 × Σ(weight×attainment) / Σ(due weights))`, then `intendedChange = round((P−50)/5)`, **bounded −10..+10**. | `raw = thrust − drag`; multiplier from **prior** streak (pos ≤2.2×, neg ≤3.5×); minus shadow = `0.30×drag(t−1)+0.12×drag(t−2)`; **unbounded** in practice. |
| **Effect of routine size** | Adding habits **cannot** raise the daily ceiling (always /100). Fair across routine sizes. | Adding more high-weight habits **can** increase gains/losses. Size and composition change outcomes. |
| **Explainability** | One number out of 100, one bounded step. Easy to explain. | Raw, multiplier, shadow, intended vs actual change — must all be shown separately. Harder to explain; needs user testing. |
| **Continuity with today** | Large change from the current rocket simulation; needs a new scoring era + user education. | Preserves the simulation's character and feel. |
| **Extra open decision** | None beyond the shared gate. | **Requires a separate missed-day/decay policy** (still open). |
| **Migration** | New era; preserve last legacy velocity as baseline, educate on the reset. | Preserve velocity but **reset multiplier streaks and pre-cutover shadow to zero** at the boundary. |

## Why B was chosen
The founder prioritised **preserving the rocket-simulation identity** — compounding momentum and punishing drag streaks — and keeping existing users' trajectory feeling continuous. B keeps that character while the `b-1` contract fixes the correctness problems the audit found (retroactive rescoring, invalid-answer coercion, gap-insensitive streaks/shadow, double floor, opaque explanation).

**Tradeoffs accepted with B** (tracked, not blockers): the raw outcome still depends on routine size/composition (advisory balance does not fully fix this — avoid user-to-user rankings); multiplier + shadow must be explained and user-tested; and "B resembles the old engine" does **not** mean past numbers are preserved — the eligibility gate, half-away-from-zero rounding, and the cutover streak reset all change historical values deliberately.

---

## Remaining founder action
Pick the **missed-day / gap policy** for B (`docs/ENGINE.md` §4):
- **Variant 1 — carry-over** (plan's recommended default): unknown days carry velocity unchanged; multiplier streak resets when a gap day closes; no decay, no grace.
- **Variant 2 — decay + grace**: 3% velocity decay per missed day, one positive-streak grace, negative streak retained across gaps. Adds penalties; needs its own sub-spec before implementation.

Already settled: cutover with pre-cutover history read-only/annotated and last legacy velocity as baseline; no user-facing engine switcher.

---

## Appendix — Engine A (future option, not implemented)

Retained verbatim from the plan (`docs/MASTER-PLAN-1-core.md` §4 Option A) so it can be revisited without re-deriving it.

**Intent:** make different-sized routines easier to interpret and make each day's change predictable.

1. Attainment is 0, 0.5 or 1 (binary habits use endpoints); Limit/Avoid choices increase in the same attainment direction. Represent attainment internally as 0/1/2 and weights as integers; optional S/A/B priorities map to 3/2/1.
2. For an eligible finalized day: `P = round(100 × Σ(weight × attainment) / Σ(non-excused due weights))`. With integer units 0/1/2, equivalently `P = round(50 × Σ(weight × attainmentUnits) / Σ(due weights))` — never feed doubled units into the first formula.
3. Unrecorded due items keep the result pending; explicit excuses remove their weights from both sums and stay visible; all-excused/no-action days have no score.
4. Round `P` once. `intendedChange = round((P − 50) / 5)`, bounded −10..+10. New accounts start at 100. `velocity = max(0, previousVelocity + intendedChange)`. Show actual change after the zero floor.
5. Half-away-from-zero rounding, identical in client/server fixtures. Unknown/pending/no-action days carry velocity unchanged (not awarded 50).
6. **Remove** shadow drag and escalating negative multipliers. Resolving an earlier pending day replays later results and explains the adjustment.

**Why A would be chosen instead:** adding habits cannot raise the 100-point ceiling (fair across routine sizes), each day's change is bounded and predictable, and it is far easier to explain. **Tradeoff:** a large change from the rocket simulation, requiring a new scoring era and user education. If the product ever prioritises interpretability and fairness over the physics-sim feel, A is the ready alternative.
