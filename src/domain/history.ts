import { runEngine } from './scoring';
import { calendarKeyOffset } from './dates';
import { roundHalfAwayFromZero } from './rounding';
import type { Answers, EngineResult, ScoreQuestion } from './scoring';
import type { EligibilityOptions } from './validation';
export interface EntryRow extends EligibilityOptions {
  date: string;
  answers?: Answers | null;
}
export interface HistoryEntry {
  answers: Answers;
  computed: EngineResult;
  partial: boolean;
  answeredCount: number;
}
export type HistoryCache = Record<string, HistoryEntry>;

// WP2.4 is blocked on founder policy. Keep legacy continuity explicitly behind
// this seam: no reset/decay/grace/synthetic dates until that decision is made.
export interface GapContext {
  velocity: number;
  posS: number;
  negS: number;
  previousDate: string | null;
  currentDate: string;
}
export function retainLegacyGapContinuityPendingPolicy(state: GapContext): GapContext {
  return { ...state };
}
export function recomputeAll(
  questions: readonly ScoreQuestion[],
  rows: readonly EntryRow[],
): HistoryCache {
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : 1));
  const cache: HistoryCache = {};
  let prevV = 100,
    posS = 0,
    negS = 0;
  let previousDate: string | null = null;
  sorted.forEach((row) => {
    if (!row.answers) return; // Preserve legacy absent-answer-row handling.
    const prior = retainLegacyGapContinuityPendingPolicy({
      velocity: prevV,
      posS,
      negS,
      previousDate,
      currentDate: row.date,
    });
    const yesterday = cache[calendarKeyOffset(row.date, -1)]?.computed;
    const twoDaysAgo = cache[calendarKeyOffset(row.date, -2)]?.computed;
    const shadow = roundHalfAwayFromZero(
      0.3 * (yesterday?.eligible ? yesterday.drag : 0) +
        0.12 * (twoDaysAgo?.eligible ? twoDaysAgo.drag : 0),
    );
    const c = runEngine(questions, row.answers, prior.velocity, prior.posS, prior.negS, {
      ...row,
      shadow,
    });
    previousDate = row.date;
    prevV = c.newVelocity;
    posS = c.posStreak;
    negS = c.negStreak;
    cache[row.date] = {
      answers: row.answers,
      computed: c,
      partial: c.partial,
      answeredCount: c.answeredCount,
    };
  });
  return cache;
}
