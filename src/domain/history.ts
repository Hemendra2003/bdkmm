import { runEngine } from './scoring';
import { calendarKeyOffset } from './dates';
import { roundHalfAwayFromZero } from './rounding';
import type { Answers, EngineResult, ScoreQuestion } from './scoring';
import { assessEligibility } from './validation';
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

// Founder chose Variant1: closed days without eligible action scores reset
// multiplier continuity. They carry velocity and never invent drag or answers.
export interface GapContext {
  velocity: number;
  posS: number;
  negS: number;
  previousDate: string | null;
  currentDate: string;
  eligible: boolean;
  todayKey?: string;
}
export function applyConservativeCarryOver(state: GapContext): GapContext {
  const closedGap =
    state.previousDate !== null && calendarKeyOffset(state.previousDate, 1) < state.currentDate;
  const closedUnscoredDay =
    !state.eligible && (!state.todayKey || state.currentDate < state.todayKey);
  return {
    ...state,
    posS: closedGap || closedUnscoredDay ? 0 : state.posS,
    negS: closedGap || closedUnscoredDay ? 0 : state.negS,
  };
}
export interface HistoryOptions {
  // The adapter supplies its local today. Offline fixtures may omit it to
  // replay a closed historical batch; no ambient clock is read by the domain.
  todayKey?: string;
}
export function recomputeAll(
  questions: readonly ScoreQuestion[],
  rows: readonly EntryRow[],
  options: HistoryOptions = {},
): HistoryCache {
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : 1));
  const cache: HistoryCache = {};
  let prevV = 100,
    posS = 0,
    negS = 0;
  let previousDate: string | null = null;
  sorted.forEach((row) => {
    if (!row.answers) return; // Preserve legacy absent-answer-row handling.
    const prior = applyConservativeCarryOver({
      velocity: prevV,
      posS,
      negS,
      previousDate,
      currentDate: row.date,
      eligible: assessEligibility(questions, row.answers, row).eligible,
      todayKey: options.todayKey,
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
