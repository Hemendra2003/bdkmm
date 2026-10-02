# MOMENTUM — Engine Decision: A vs B (for the founder)

Author: Oscar · Date: 2026-10-02 · Source: `docs/MASTER-PLAN-1-core.md` §4.
**This is a decision gate.** Common product, data, auth, security, and offline work (WP0/WP1) can proceed now; final score presentation, engine implementation, and cutover wait on this choice. The plan is explicit: **do not expose an A/B switcher to users and do not blend the two formulas.**

Both options share the same non-negotiables: valid immutable definitions, explicit exclusions, deterministic replay, trusted server commits, a visible legacy cutover, and a zero-velocity floor starting new accounts at 100. Neither is scientifically validated; momentum is a game mechanic over self-reported actions.

---

## The two options

| | **Option A — Normalized daily performance** | **Option B — Repair the current thrust/drag engine** |
|---|---|---|
| **Core idea** | Each day scores 0–100% of the routine you actually did, then nudges velocity by a small bounded step. | Keep the existing physics sim (thrust − drag, streak multipliers, shadow drag), fix its correctness, dates, and explanation. |
| **Daily change** | `P = round(100 × Σ(weight×attainment) / Σ(due weights))`, then `intendedChange = round((P−50)/5)`, **bounded −10..+10**. | `raw = thrust − drag`; multiplier from **prior** streak (pos ≤2.2×, neg ≤3.5×); minus shadow = `0.30×drag(t−1)+0.12×drag(t−2)`; **unbounded** in practice. |
| **Effect of routine size** | Adding habits **cannot** raise the daily ceiling (always /100). Fair across routine sizes. | Adding more high-weight habits **can** increase gains/losses. Size and composition change outcomes. |
| **Explainability** | One number out of 100, one bounded step. Easy to explain. | Raw, multiplier, shadow, intended vs actual change — must all be shown separately. Harder to explain; negative multipliers and shadow need user testing. |
| **Continuity with today** | Large change from the current rocket simulation; needs a new scoring era + user education. | Preserves the simulation's character and feel. |
| **Extra open decision** | None beyond the shared gate. | **Requires a separate missed-day/decay policy** (conservative: unknown days carry velocity unchanged; an optional 3%-decay + streak-grace variant exists but is unselected and adds penalties). |
| **Migration** | New era; preserve last legacy velocity as baseline, educate on the reset. | Preserve velocity but **reset multiplier streaks and pre-cutover shadow to zero** at the boundary (recommended transition). |

---

## Recommendation: **Option A**, unless preserving the rocket-sim feel is a hard product requirement.

**Why A.** The audit's core product finding is that the current score is hard to trust and hard to explain: more positive questions create more velocity without better behavior, partial days can earn clean streaks, and the shadow/multiplier mechanics are opaque. A fixes all of that structurally — the 0–100 normalization removes the routine-size distortion, and the bounded ±10 step makes each day predictable. It has no second open sub-decision, so it reaches a frozen, testable spec faster. For a dependable *personal reflection* app (the stated product goal), "what % of my plan did I do, and which way did it move me" is the clearer mental model.

**The tradeoff you are accepting with A.** You lose the current rocket-simulation character — the dramatic multipliers and compounding/decay that make a good streak feel exponential. A is a bigger visible change for any existing user and needs a new scoring era plus a short explanation of why numbers look different after cutover. The zero floor can also make an actual loss smaller than the intended loss, which must be shown honestly.

**When to pick B instead.** Choose B if the physics-sim identity (compounding momentum, punishing drag streaks) is central to the product's appeal and you want to keep existing users' trajectory feeling continuous. B is viable and the plan fully specifies how to repair it — but budget for (1) the extra missed-day/decay sub-decision, (2) explaining multiplier + shadow to users, and (3) the risk that people don't intuitively understand negative multipliers. Do not adopt B thinking it preserves exact historical numbers: several fixes (eligibility gate, rounding policy, streak reset at cutover) change past values anyway.

**What A and B share regardless of choice:** you must freeze the exact constants, rounding (recommended half-away-from-zero), gap rule, finalization interaction, zero-floor behavior, and replay boundary in `docs/ENGINE.md`, with worked fixtures (first day, gap, partial, all-excused, backfill, retier/archive, floor) that also generate the UI explanation copy. Test that users actually understand the chosen model before calling implementation done.

---

## What we need from you (founder) to close the gate
1. **Pick A or B.** If B, also approve the **conservative** missed-day policy (unknown days carry velocity unchanged) or explicitly request the optional 3%-decay variant.
2. Confirm the **cutover is acceptable**: a visible boundary where pre-cutover history becomes read-only/annotated, with the last legacy velocity carried as the new-era baseline.
3. Confirm you want **no user-facing engine switcher** (the plan's default; we won't build two production engines to defer the choice).
