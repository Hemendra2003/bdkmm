import { runEngine } from './scoring';
import type { Answers, EngineResult, ScoreQuestion } from './scoring';
export interface EntryRow {
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
// Sorting, prior-row shadow, null/orphan completion counts and historical
// re-tiering intentionally retain the golden characterization behavior.
export function recomputeAll(
  questions: readonly ScoreQuestion[],
  rows: readonly EntryRow[],
): HistoryCache {
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : 1));
  const cache: HistoryCache = {};
  let prevV = 100,
    posS = 0,
    negS = 0;
  sorted.forEach((row) => {
    if (!row.answers) return;
    const answers = row.answers;
    const c = runEngine(questions, answers, prevV, posS, negS);
    const pd = Object.keys(cache).sort();
    let shadow = 0;
    if (pd.length >= 1) shadow += (cache[pd[pd.length - 1]].computed.drag || 0) * 0.6;
    if (pd.length >= 2) shadow += (cache[pd[pd.length - 2]].computed.drag || 0) * 0.4 * 0.6;
    const sp = Math.round(shadow * 0.5);
    c.newVelocity = Math.max(0, c.newVelocity - sp);
    c.finalDv -= sp;
    c.shadow = sp;
    c.posStreak = c.finalDv > 0 ? posS + 1 : 0;
    c.negStreak = c.finalDv < 0 ? negS + 1 : 0;
    prevV = c.newVelocity;
    posS = c.posStreak;
    negS = c.negStreak;
    const ac = Object.keys(answers).filter((k) => answers[k] !== undefined).length;
    cache[row.date] = { answers, computed: c, partial: ac < questions.length, answeredCount: ac };
  });
  return cache;
}
