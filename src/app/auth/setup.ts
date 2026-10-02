import { createRepositories, type QuestionInput } from '../../data/repositories.ts';
import { supabase } from '../supabase.ts';
import { getState, getAuthContext, isAuthContextCurrent } from '../store.ts';

export function starterPreset(): QuestionInput[] {
  return [
    {
      key: 'starter-move',
      text: 'Move for a few minutes',
      opts: ['Not today', 'A little', 'Done'],
      polarity: 'positive',
      tier: 'S',
    },
    {
      key: 'starter-read',
      text: 'Read a few pages',
      opts: ['Not today', 'A little', 'Done'],
      polarity: 'positive',
      tier: 'B',
    },
    {
      key: 'starter-scroll',
      text: 'Unplanned scrolling',
      opts: ['Often', 'A little', 'Not today'],
      polarity: 'negative',
      tier: 'A',
    },
    {
      key: 'starter-delay',
      text: 'Putting off a planned task',
      opts: ['Often', 'A little', 'Not today'],
      polarity: 'negative',
      tier: 'B',
    },
  ];
}
const skipKey = (userId: string) => 'momentum:setup-skipped:v1:' + encodeURIComponent(userId);
export function setupSkipped(userId: string): boolean {
  try {
    return window.localStorage.getItem(skipKey(userId)) === 'yes';
  } catch {
    return false;
  }
}
export function skipSetup(userId: string): void {
  if (getState().userId !== userId) throw new Error('Account changed. Open setup again.');
  try {
    window.localStorage.setItem(skipKey(userId), 'yes');
  } catch {
    /* Skip still works for this screen visit. */
  }
}
export async function saveStarterPreset(questions: QuestionInput[]): Promise<void> {
  const context = getAuthContext();
  if (!context.userId || getState().status !== 'signed-in')
    throw new Error('Sign in before choosing your routine.');
  const snapshot = questions.map((q, index) => ({
    ...q,
    opts: [...q.opts] as [string, string, string],
    sort_order: index,
  }));
  const repos = createRepositories({
    client: supabase,
    getUserId: () => (isAuthContextCurrent(context) ? context.userId : null),
    now: () => new Date(),
  });
  const existing = await repos.questions.list();
  if (existing.length) throw new Error('You already have a routine. Open Habits to edit it.');
  await repos.questions.saveMany(snapshot);
  if (!isAuthContextCurrent(context)) throw new Error('Account changed. Open setup again.');
  try {
    window.localStorage.removeItem(skipKey(context.userId));
  } catch {
    /* Saved questions determine setup completion. */
  }
}
