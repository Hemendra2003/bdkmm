import { recoveryIntent, clearRecoveryIntent, recoveryLinkFailed } from './auth/redirect.ts';
import type { Session } from '../state/session.ts';
import { createSessionController } from '../state/session.ts';
import {
  createRepositories,
  type QuestionRow,
  type EntryRow,
  type Answers,
} from '../data/repositories.ts';
import { localDateKey, calendarKeyOffset } from '../domain/dates.ts';
import { recomputeAll, type HistoryCache } from '../domain/history.ts';
import type { EngineResult } from '../domain/scoring.ts';
import { supabase, SUPABASE_SETUP_ERROR } from './supabase.ts';

export interface AppState {
  recoveryMode: boolean;
  recoveryReady: boolean;
  status: 'loading' | 'signed-out' | 'signed-in' | 'error';
  userId: string | null;
  todayKey: string | null;
  questions: QuestionRow[];
  todayEntry: EntryRow | null;
  loadError: string | null;
  lastScored: { date: string; velocity: number } | null;
  weekCheckIns: number;
  entries: EntryRow[];
  history: HistoryCache;
  savingDate: string | null;
}

type Listener = (state: AppState) => void;

const initialState: AppState = {
  recoveryMode: recoveryIntent(),
  recoveryReady: false,
  status: 'loading',
  userId: null,
  todayKey: null,
  questions: [],
  todayEntry: null,
  loadError: null,
  lastScored: null,
  weekCheckIns: 0,
  entries: [],
  history: {},
  savingDate: null,
};

function findLastScored(
  history: HistoryCache,
  todayKey: string,
): { date: string; velocity: number } | null {
  const eligibleDates = Object.keys(history)
    .filter((d) => d <= todayKey && history[d].computed.eligible)
    .sort()
    .reverse();
  if (eligibleDates.length === 0) return null;
  const date = eligibleDates[0];
  return { date, velocity: history[date].computed.newVelocity };
}

function countWeekCheckIns(allEntries: readonly { date: string }[], todayKey: string): number {
  const weekStart = calendarKeyOffset(todayKey, -6);
  return allEntries.filter((e) => e.date >= weekStart && e.date <= todayKey).length;
}

let state: AppState = { ...initialState };
const listeners = new Set<Listener>();

function notify() {
  for (const l of listeners) l(state);
}

function setState(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  notify();
}

export function getState(): AppState {
  return state;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let _userId: string | null = null;
let accountGeneration = 0;

const repos = createRepositories({
  client: supabase,
  getUserId: () => _userId,
  now: () => new Date(),
});

const controller = createSessionController({
  subscribe(receive) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      receive(event, session as Session | null);
      if (event === 'PASSWORD_RECOVERY') setState({ recoveryMode: true, recoveryReady: !!session });
    });
    return () => data.subscription.unsubscribe();
  },
  async readSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);
    return data.session as Session | null;
  },
  publish(session) {
    const next = session?.user.id ?? null;
    if (next !== _userId) accountGeneration++;
    _userId = next;
    setState({ recoveryReady: state.recoveryMode && !!session && !recoveryLinkFailed });
  },
  clear(_previous, current) {
    const recoveryMode = recoveryIntent();
    setState({
      ...initialState,
      recoveryMode,
      recoveryReady: recoveryMode && !!current && !recoveryLinkFailed,
      status: current ? 'loading' : 'signed-out',
      userId: current,
    });
  },
  async boot(session, _event, context) {
    if (!session) return;
    const userId = session.user.id;
    setState({
      status: 'loading',
      userId,
      questions: [],
      todayEntry: null,
      loadError: null,
      lastScored: null,
      weekCheckIns: 0,
      entries: [],
      history: {},
      savingDate: null,
    });
    try {
      const todayKey = localDateKey(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
      const [questions, todayEntry, allEntries] = await Promise.all([
        repos.questions.list(),
        repos.entries.get(todayKey),
        repos.entries.list(),
      ]);
      if (!controller.isCurrent(context)) return;
      const history = recomputeAll(questions, allEntries, { todayKey });
      const lastScored = findLastScored(history, todayKey);
      const weekCheckIns = countWeekCheckIns(allEntries, todayKey);
      setState({
        status: 'signed-in',
        userId,
        todayKey,
        questions,
        todayEntry,
        loadError: null,
        lastScored,
        weekCheckIns,
        entries: allEntries,
        history,
      });
    } catch (err) {
      if (!controller.isCurrent(context)) return;
      const msg = err instanceof Error ? err.message : 'Could not load your data.';
      setState({ status: 'error', userId, loadError: msg });
    }
  },
  schedule(work) {
    setTimeout(work, 0);
  },
  onError(err) {
    const msg = err instanceof Error ? err.message : 'Authentication error.';
    setState({ status: 'error', loadError: msg });
  },
});

export type DayScoreState = 'pending' | 'no-score' | 'scored';
export type CheckInStatus = 'partial' | 'complete-unscored' | 'scored';
export interface DayScore {
  date: string;
  state: DayScoreState;
  checkInStatus: CheckInStatus;
  result: EngineResult;
}

// Confirmed server entries only. Missing date is unrecorded, not a synthetic score.
// Subscribe/getState (or the existing React store hook) supplies change notifications.
export function getDayScore(date: string): DayScore | null {
  const entry = state.history[date];
  if (!entry) return null;
  const result = entry.computed;
  return {
    date,
    state: result.eligible ? 'scored' : result.status === 'no-action' ? 'no-score' : 'pending',
    checkInStatus: result.partial ? 'partial' : result.eligible ? 'scored' : 'complete-unscored',
    result,
  };
}

export async function saveCheckIn(date: string, values: Answers): Promise<void> {
  const userId = _userId;
  const generation = accountGeneration;
  const current = () => _userId === userId && accountGeneration === generation;
  if (!userId || !state.todayKey || (state.status !== 'signed-in' && state.status !== 'error'))
    throw new Error('Check-in requires loaded account data.');
  if (state.savingDate) throw new Error('A check-in is already saving.');
  try {
    // Snapshot inputs before the first await; no UI edits can alter this request.
    const answers = { ...values };
    const questions = state.questions.map(({ key, text, polarity, tier }) => ({
      key,
      text,
      polarity,
      tier,
    }));
    setState({ savingDate: date, loadError: null });
    const saved = await repos.entries.save(date, answers, questions);
    if (!current()) throw new Error('Account changed during the request.');
    const entries = [...state.entries.filter((entry) => entry.date !== date), saved].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const todayKey = localDateKey(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
    const history = recomputeAll(state.questions, entries, { todayKey });
    setState({
      status: 'signed-in',
      loadError: null,
      entries,
      history,
      todayKey,
      todayEntry: entries.find((entry) => entry.date === todayKey) ?? null,
      lastScored: findLastScored(history, todayKey),
      weekCheckIns: countWeekCheckIns(entries, todayKey),
      savingDate: null,
    });
  } catch (error) {
    if (current()) {
      const message = error instanceof Error ? error.message : 'Could not save check-in.';
      setState({ status: 'error', loadError: message, savingDate: null });
    }
    throw error;
  }
}

export interface AuthContext {
  userId: string | null;
  generation: number;
}
export function getAuthContext(): AuthContext {
  return { userId: _userId, generation: accountGeneration };
}
export function isAuthContextCurrent(context: AuthContext): boolean {
  return context.userId === _userId && context.generation === accountGeneration;
}
export function finishRecovery(): void {
  clearRecoveryIntent();
  setState({ recoveryMode: false, recoveryReady: false });
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}

export async function signOut(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) setState({ status: 'error', loadError: error.message });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sign out failed.';
    setState({ status: 'error', loadError: msg });
  }
}

// Start the session controller once on module load (skip if env vars are missing).
if (SUPABASE_SETUP_ERROR) {
  setState({ status: 'error', loadError: SUPABASE_SETUP_ERROR });
} else {
  void controller.start();
}
