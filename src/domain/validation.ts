export interface BalanceResult {
  ok: boolean;
  reason?: string;
  posCount?: number;
  negCount?: number;
  total?: number;
}
export const MIN_TOTAL_QUESTIONS = 10;
export const MIN_POLARITY_RATIO = 0.3;
export const QUESTION_TEXT_LIMIT = 80;
export const OPTION_TEXT_LIMIT = 80;
export function validateQuestionText(q: { text?: unknown; opts?: unknown }): void {
  if (typeof q.text !== 'string' || !q.text.trim() || q.text.length > QUESTION_TEXT_LIMIT)
    throw new Error('Question text must be 1–80 characters.');
  if (
    !Array.isArray(q.opts) ||
    q.opts.length !== 3 ||
    q.opts.some(
      (opt: unknown) => typeof opt !== 'string' || !opt.trim() || opt.length > OPTION_TEXT_LIMIT,
    )
  )
    throw new Error('Each of the three option labels must be 1–80 characters.');
}
export function checkBalance(questions: readonly { polarity: string }[]): BalanceResult {
  const total = questions.length;
  if (total === 0) return { ok: false, reason: 'No questions.' };
  const posCount = questions.filter((q) => q.polarity === 'positive').length;
  const negCount = total - posCount;
  const posRatio = posCount / total,
    negRatio = negCount / total;
  if (total < MIN_TOTAL_QUESTIONS)
    return {
      ok: false,
      reason: `Need at least ${MIN_TOTAL_QUESTIONS} questions (have ${total}).`,
      posCount,
      negCount,
      total,
    };
  if (posRatio < MIN_POLARITY_RATIO)
    return {
      ok: false,
      reason: `Too few positive-habit questions (need \u226530%, have ${Math.round(posRatio * 100)}%).`,
      posCount,
      negCount,
      total,
    };
  if (negRatio < MIN_POLARITY_RATIO)
    return {
      ok: false,
      reason: `Too few negative-habit questions (need \u226530%, have ${Math.round(negRatio * 100)}%).`,
      posCount,
      negCount,
      total,
    };
  return { ok: true, posCount, negCount, total };
}

// Storage access and error presentation remain in the app adapter.
export function parseDraft(
  raw: string | null | undefined,
  userId: string,
  date: string,
): Record<string, 1 | 2 | 3> {
  if (!raw) return {};
  if (raw.length > 1000000) throw new Error('Oversized draft');
  const draft = JSON.parse(raw) as {
    version?: unknown;
    userId?: unknown;
    date?: unknown;
    answers?: unknown;
  } | null;
  if (
    !draft ||
    draft.version !== 1 ||
    draft.userId !== userId ||
    draft.date !== date ||
    !draft.answers ||
    typeof draft.answers !== 'object' ||
    Array.isArray(draft.answers) ||
    Object.entries(draft.answers).some(([key, val]) => key.length > 128 || !isValidAnswer(val))
  )
    throw new Error('Invalid draft');
  return draft.answers as Record<string, 1 | 2 | 3>;
}

export type ValidAnswer = 1 | 2 | 3;
export function isValidAnswer(value: unknown): value is ValidAnswer {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 3;
}
export interface EligibilityOptions {
  dueKeys?: readonly string[];
  excusedKeys?: readonly string[];
  finalized?: boolean;
}
export interface Eligibility {
  eligible: boolean;
  partial: boolean;
  answeredCount: number;
  excusedCount: number;
  dueCount: number;
  status: 'scored' | 'pending' | 'no-action' | 'draft';
  answerStates: Record<string, 'answered' | 'excused' | 'unanswered' | 'invalid'>;
}
export function assessEligibility(
  questions: readonly { key: string }[],
  answers: Record<string, unknown>,
  options: EligibilityOptions = {},
): Eligibility {
  const due = new Set(options.dueKeys ?? questions.map((q) => q.key));
  const excused = new Set(options.excusedKeys ?? []);
  const keys = [...new Set(questions.map((q) => q.key))].filter((key) => due.has(key));
  let answeredCount = 0,
    excusedCount = 0;
  const states = keys.map((key) => {
    if (excused.has(key)) {
      excusedCount++;
      return [key, 'excused'] as const;
    }
    const value = Object.hasOwn(answers, key) ? answers[key] : undefined;
    if (isValidAnswer(value)) {
      answeredCount++;
      return [key, 'answered'] as const;
    }
    return [key, value === null || value === undefined ? 'unanswered' : 'invalid'] as const;
  });
  const partial = answeredCount + excusedCount < keys.length;
  const eligible = options.finalized !== false && !partial && answeredCount > 0;
  const status =
    options.finalized === false ? 'draft' : partial ? 'pending' : eligible ? 'scored' : 'no-action';
  return {
    eligible,
    partial,
    answeredCount,
    excusedCount,
    dueCount: keys.length,
    status,
    answerStates: Object.fromEntries(states),
  };
}
