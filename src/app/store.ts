import type { Session } from '../state/session.ts';
import { createSessionController } from '../state/session.ts';
import { createRepositories, type QuestionRow, type EntryRow } from '../data/repositories.ts';
import { localDateKey, calendarKeyOffset } from '../domain/dates.ts';
import { recomputeAll, type HistoryCache, type HistoryEntry } from '../domain/history.ts';
import { supabase, SUPABASE_SETUP_ERROR } from './supabase.ts';

export interface AppState {
  status: 'loading' | 'signed-out' | 'signed-in' | 'error';
  userId: string | null;
  todayKey: string | null;
  questions: QuestionRow[];
  todayEntry: EntryRow | null;
  loadError: string | null;
  lastScored: { date: string; velocity: number } | null;
  weekCheckIns: number;
  todayResult: HistoryEntry | null;
}

type Listener = (state: AppState) => void;

const initialState: AppState = {
  status: 'loading',
  userId: null,
  todayKey: null,
  questions: [],
  todayEntry: null,
  loadError: null,
  lastScored: null,
  weekCheckIns: 0,
  todayResult: null,
};

function findLastScored(history: HistoryCache): { date: string; velocity: number } | null {
  const eligibleDates = Object.keys(history)
    .filter((d) => history[d].computed.eligible)
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

const repos = createRepositories({
  client: supabase,
  getUserId: () => _userId,
  now: () => new Date(),
});

const controller = createSessionController({
  subscribe(receive) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      receive(event, session as Session | null);
    });
    return () => data.subscription.unsubscribe();
  },
  async readSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);
    return data.session as Session | null;
  },
  publish(session) {
    _userId = session?.user.id ?? null;
  },
  clear(_previous, current) {
    if (current === null) {
      setState({
        status: 'signed-out',
        userId: null,
        questions: [],
        todayEntry: null,
        loadError: null,
        lastScored: null,
        weekCheckIns: 0,
        todayResult: null,
      });
    }
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
      todayResult: null,
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
      const lastScored = findLastScored(history);
      const weekCheckIns = countWeekCheckIns(allEntries, todayKey);
      const todayResult = history[todayKey] ?? null;
      setState({
        status: 'signed-in',
        userId,
        todayKey,
        questions,
        todayEntry,
        loadError: null,
        lastScored,
        weekCheckIns,
        todayResult,
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

// Saves an entry and recomputes store state. Will be updated when Jim's WP2.5 lands.
export async function saveEntry(answers: import('../data/repositories.ts').Answers): Promise<void> {
  const { todayKey, questions } = state;
  if (!todayKey) throw new Error('No date set.');
  const entry = await repos.entries.save(todayKey, answers);
  const allEntries = await repos.entries.list();
  const history = recomputeAll(questions, allEntries, { todayKey });
  const lastScored = findLastScored(history);
  const weekCheckIns = countWeekCheckIns(allEntries, todayKey);
  const todayResult = history[todayKey] ?? null;
  setState({ todayEntry: entry, lastScored, weekCheckIns, todayResult });
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
