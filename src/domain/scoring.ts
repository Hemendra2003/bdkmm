// Legacy engine rules, including characterized defects, are preserved verbatim.
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
export interface EngineResult {
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
  shadow?: number;
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
  const table = TIER_WEIGHTS[question.polarity] || TIER_WEIGHTS.positive;
  const tierRow = table[question.tier] || table.B;
  return tierRow[STRENGTH_LABEL[idx]];
}

export function runEngine(
  questions: readonly ScoreQuestion[],
  answers: Answers,
  prevV: number,
  posS: number,
  negS: number,
): EngineResult {
  let thrust = 0,
    drag = 0;
  const thrustItems: ScoreItem[] = [],
    dragItems: ScoreItem[] = [];
  questions.forEach((q) => {
    if (answers[q.key] === undefined || answers[q.key] === null) return;
    const idx = (parseInt(answers[q.key] as string) || 1) - 1;
    const score = scoreForAnswer(q, idx);
    if (score > 0) {
      thrust += score;
      thrustItems.push({ name: q.text, score });
    } else if (score < 0) {
      drag += Math.abs(score);
      dragItems.push({ name: q.text, score });
    }
  });
  const rawDv = thrust - drag;
  let mult = 1.0;
  if (rawDv > 0) mult = Math.min(2.2, 1 + (Math.log(posS + 1) / Math.log(1.8)) * 0.25);
  else if (rawDv < 0) mult = Math.min(3.5, 1 + Math.pow(negS + 1, 1.4) * 0.15);
  mult = Math.round(mult * 100) / 100;
  const finalDv = Math.round(rawDv * mult);
  return {
    thrust,
    drag,
    rawDv,
    mult,
    finalDv,
    newVelocity: Math.max(0, prevV + finalDv),
    posStreak: finalDv > 0 ? posS + 1 : 0,
    negStreak: finalDv < 0 ? negS + 1 : 0,
    thrustItems,
    dragItems,
  };
}
