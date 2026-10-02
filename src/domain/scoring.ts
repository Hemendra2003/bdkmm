// Engine B core; immutable historical definitions and the gap policy remain
// separate contracts. All state, due actions and finalization are explicit.
import { assessEligibility } from './validation';
import type { Eligibility, EligibilityOptions } from './validation';
import { ENGINE_VERSION, roundHalfAwayFromZero } from './rounding';
// Questions and prior state are explicit inputs; no ambient account or clock.
export interface ScoreQuestion {
  key: string;
  text: string;
  polarity: string;
  tier: string;
}
export type Answers = Record<string, unknown>;
export interface ScoreItem {
  name: string;
  score: number;
}
export interface EngineResult extends Eligibility {
  engineVersion: typeof ENGINE_VERSION;
  rawChange: number;
  intendedChange: number;
  actualChange: number;
  thrust: number;
  drag: number;
  rawDv: number;
  mult: number;
  finalDv: number;
  newVelocity: number;
  posStreak: number;
  negStreak: number;
  thrustItems: ScoreItem[];
  dragItems: ScoreItem[];
  shadow: number;
}

export const TIER_WEIGHTS: Record<string, Record<string, Record<string, number>>> = {
  positive: {
    S: { bad: -5, neutral: 0, good: 8 },
    A: { bad: -3, neutral: 0, good: 5 },
    B: { bad: -1.5, neutral: 0, good: 3 },
  },
  negative: {
    S: { bad: -10, neutral: -4, good: 0 },
    A: { bad: -6, neutral: -2, good: 0 },
    B: { bad: -3, neutral: -1, good: 0 },
  },
};

// strengthIndex 0/1/2 -> 'bad'/'neutral'/'good' lookup key
export const STRENGTH_LABEL = ['bad', 'neutral', 'good'];

export function scoreForAnswer(question: ScoreQuestion, strengthIndex: number): number {
  const idx = Math.max(0, Math.min(2, strengthIndex));
  const table = Object.hasOwn(TIER_WEIGHTS, question.polarity)
    ? TIER_WEIGHTS[question.polarity]
    : TIER_WEIGHTS.positive;
  const tierRow = Object.hasOwn(table, question.tier) ? table[question.tier] : table.B;
  return tierRow[STRENGTH_LABEL[idx]];
}

export interface EngineOptions extends EligibilityOptions {
  shadow?: number;
}
// The only trajectory floor: runEngine and history both use this finish step.
export function applyVelocityChange(prevV: number, rawChange: number, shadow: number) {
  const intendedChange = rawChange - shadow;
  const newVelocity = Math.max(0, prevV + intendedChange);
  return { intendedChange, newVelocity, actualChange: newVelocity - prevV };
}
export function runEngine(
  questions: readonly ScoreQuestion[],
  answers: Answers,
  prevV: number,
  posS: number,
  negS: number,
  options: EngineOptions = {},
): EngineResult {
  const eligibility = assessEligibility(questions, answers, options);
  let thrust = 0,
    drag = 0;
  const thrustItems: ScoreItem[] = [],
    dragItems: ScoreItem[] = [];
  const counted = new Set<string>();
  questions.forEach((q) => {
    if (eligibility.answerStates[q.key] !== 'answered' || counted.has(q.key)) return;
    counted.add(q.key);
    const score = scoreForAnswer(q, (answers[q.key] as number) - 1);
    if (score > 0) {
      thrust += score;
      thrustItems.push({ name: q.text, score });
    } else if (score < 0) {
      drag += Math.abs(score);
      dragItems.push({ name: q.text, score });
    }
  });
  // Valid partial answers retain candidate item totals for preview only. They
  // publish no change, shadow, score or streak until eligibility is satisfied.
  const rawDv = thrust - drag;
  let mult = 1;
  if (eligibility.eligible && rawDv > 0)
    mult = Math.min(2.2, 1 + (Math.log(posS + 1) / Math.log(1.8)) * 0.25);
  else if (eligibility.eligible && rawDv < 0)
    mult = Math.min(3.5, 1 + Math.pow(negS + 1, 1.4) * 0.15);
  mult = roundHalfAwayFromZero(mult * 100) / 100;
  const rawChange = eligibility.eligible ? roundHalfAwayFromZero(rawDv * mult) : 0;
  const shadow = eligibility.eligible ? roundHalfAwayFromZero(options.shadow ?? 0) : 0;
  const change = eligibility.eligible
    ? applyVelocityChange(prevV, rawChange, shadow)
    : { intendedChange: 0, newVelocity: prevV, actualChange: 0 };
  const posStreak = eligibility.eligible ? (change.actualChange > 0 ? posS + 1 : 0) : posS;
  const negStreak = eligibility.eligible ? (change.actualChange < 0 ? negS + 1 : 0) : negS;
  return {
    ...eligibility,
    engineVersion: ENGINE_VERSION,
    thrust,
    drag,
    rawDv,
    mult,
    rawChange,
    shadow,
    ...change,
    // Existing UI reads finalDv: it must display actual velocity gained/lost.
    finalDv: change.actualChange,
    posStreak,
    negStreak,
    thrustItems,
    dragItems,
  };
}
