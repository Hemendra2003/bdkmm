import { beforeEach, afterEach, expect, it, vi } from 'vitest';

const question = {
  id: 1,
  key: 'sleep',
  text: 'Sleep',
  opts: ['Low', 'Mid', 'High'],
  polarity: 'positive',
  tier: 'S',
  is_fixed: false,
  source: 'custom',
  sort_order: 0,
};
const stamp = '2026-10-02T12:00:00Z';
const entry = (date: string, answers: Record<string, number | null>, tier = 'S') => ({
  date,
  answers,
  updated_at: stamp,
  engine_version: 'b-1',
  question_set_revision: [{ key: 'sleep', text: 'Sleep', polarity: 'positive', tier }],
});
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-02T12:00:00'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.doUnmock('./supabase.ts');
});

async function harness(rows = [entry('2026-10-01', { sleep: 3 })], questions = [question]) {
  let receive: (event: string, session: unknown) => void = () => {};
  let owner = 'A';
  let writeError: Error | null = null;
  let pending: Promise<void> | null = null;
  const calls: {
    table: string;
    filters: [string, unknown][];
    payload?: Record<string, unknown>;
  }[] = [];
  const databases: Record<string, typeof rows> = { A: rows, B: [] };
  const supabase = {
    auth: {
      onAuthStateChange: vi.fn((fn: typeof receive) => {
        receive = fn;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      getSession: vi.fn(async () => ({ data: { session: { user: { id: owner } } }, error: null })),
    },
    from(table: string) {
      const call: {
        table: string;
        filters: [string, unknown][];
        payload?: Record<string, unknown>;
      } = { table, filters: [] };
      calls.push(call);
      let single = false;
      const query = {
        select() {
          return this;
        },
        eq(key: string, value: unknown) {
          call.filters.push([key, value]);
          return this;
        },
        order() {
          return this;
        },
        maybeSingle() {
          single = true;
          return this;
        },
        single() {
          single = true;
          return this;
        },
        upsert(payload: Record<string, unknown>) {
          call.payload = payload;
          return this;
        },
        async then(resolve: (value: unknown) => void) {
          const user = String(call.filters.find(([key]) => key === 'user_id')?.[1]);
          if (call.payload) {
            if (pending) await pending;
            if (writeError) return resolve({ data: null, error: writeError });
            const old = databases[user].find((row) => row.date === call.payload!.date);
            const saved = {
              ...call.payload,
              updated_at: stamp,
              question_set_revision:
                old?.question_set_revision ?? call.payload.question_set_revision,
              engine_version: old?.engine_version ?? call.payload.engine_version,
            } as (typeof rows)[number];
            databases[user] = [...databases[user].filter((row) => row.date !== saved.date), saved];
            return resolve({ data: saved, error: null });
          }
          if (table === 'user_questions') return resolve({ data: questions, error: null });
          let found = databases[user];
          const date = call.filters.find(([key]) => key === 'date')?.[1];
          if (date) found = found.filter((row) => row.date === date);
          resolve({ data: single ? (found[0] ?? null) : found, error: null });
        },
      };
      return query;
    },
  };
  vi.doMock('./supabase.ts', () => ({ supabase, SUPABASE_SETUP_ERROR: null }));
  const store = await import('./store.ts');
  await vi.runAllTimersAsync();
  expect(store.getState().status).toBe('signed-in');
  return {
    store,
    calls,
    setError: (error: Error | null) => {
      writeError = error;
    },
    setPending: (promise: Promise<void>) => {
      pending = promise;
    },
    switchOwner: (user: string | null) => {
      owner = user ?? '';
      receive(user ? 'SIGNED_IN' : 'SIGNED_OUT', user ? { user: { id: user } } : null);
    },
  };
}

it('selects stored-revision results, honest pending/no-score states and actual last-scored date', async () => {
  const h = await harness(
    [
      entry('2026-09-29', { sleep: 3 }),
      entry('2026-10-01', { sleep: null }),
      { ...entry('2026-10-02', {}), question_set_revision: [] },
      entry('2026-10-03', { sleep: 3 }),
    ],
    [{ ...question, tier: 'B' }],
  );
  expect(h.store.getDayScore('2026-09-29')).toMatchObject({
    state: 'scored',
    result: { newVelocity: 108, engineVersion: 'b-1', eligible: true },
  });
  expect(h.store.getDayScore('2026-10-01')).toMatchObject({
    state: 'pending',
    checkInStatus: 'partial',
  });
  expect(h.store.getDayScore('2026-10-02')).toMatchObject({
    state: 'no-score',
    checkInStatus: 'complete-unscored',
  });
  expect(h.store.getDayScore('2026-09-30')).toBeNull();
  expect(h.store.getState().lastScored).toEqual({ date: '2026-09-29', velocity: 108 });
});

it('saves an input snapshot with b-1 definitions, then publishes confirmed history and Today totals', async () => {
  const h = await harness();
  const values: { sleep: 1 | 2 | 3 | null } = { sleep: 3 };
  const save = h.store.saveCheckIn('2026-10-02', values);
  values.sleep = 1;
  expect(h.store.getState().savingDate).toBe('2026-10-02');
  await save;
  const write = h.calls.find((call) => call.payload)!;
  expect(write.payload).toMatchObject({
    user_id: 'A',
    date: '2026-10-02',
    answers: { sleep: 3 },
    engine_version: 'b-1',
    question_set_revision: [{ key: 'sleep', tier: 'S' }],
  });
  expect(h.store.getState().todayEntry?.answers).toEqual({ sleep: 3 });
  expect(h.store.getState().savingDate).toBeNull();
  expect(h.store.getState().weekCheckIns).toBe(2);
  expect(h.store.getState().lastScored).toEqual({ date: '2026-10-02', velocity: 118 });
});

it('corrects a past date using server-preserved definitions and replays the suffix', async () => {
  const h = await harness(
    [entry('2026-10-01', { sleep: 3 }), entry('2026-10-02', { sleep: 3 })],
    [{ ...question, tier: 'B' }],
  );
  await h.store.saveCheckIn('2026-10-01', { sleep: 2 });
  expect(h.store.getDayScore('2026-10-01')?.result.newVelocity).toBe(100);
  expect(h.store.getDayScore('2026-10-02')?.result.newVelocity).toBe(108);
  expect(h.store.getState().todayEntry?.date).toBe('2026-10-02');
});

it('does not publish an optimistic score on failure and supports a retry', async () => {
  const h = await harness();
  h.setError(new Error('Offline'));
  await expect(h.store.saveCheckIn('2026-10-02', { sleep: 3 })).rejects.toThrow('Offline');
  expect(h.store.getState()).toMatchObject({
    status: 'error',
    loadError: 'Offline',
    savingDate: null,
    todayEntry: null,
  });
  expect(h.store.getDayScore('2026-10-02')).toBeNull();
  h.setError(null);
  await h.store.saveCheckIn('2026-10-02', { sleep: 3 });
  expect(h.store.getState()).toMatchObject({ status: 'signed-in', loadError: null });
});

it('account switch drops a late save and clears old selectors immediately', async () => {
  const h = await harness();
  let release!: () => void;
  h.setPending(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  const save = h.store.saveCheckIn('2026-10-02', { sleep: 3 });
  const rejected = expect(save).rejects.toThrow(/Account changed/);
  h.switchOwner('B');
  expect(h.store.getDayScore('2026-10-01')).toBeNull();
  await vi.runAllTimersAsync();
  release();
  await rejected;
  expect(h.store.getState()).toMatchObject({
    userId: 'B',
    status: 'signed-in',
    loadError: null,
    lastScored: null,
    savingDate: null,
  });
  expect(h.store.getDayScore('2026-10-02')).toBeNull();
});

it('same-owner logout/login also invalidates old writes', async () => {
  const h = await harness();
  let release!: () => void;
  h.setPending(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  const save = h.store.saveCheckIn('2026-10-02', { sleep: 3 });
  const rejected = expect(save).rejects.toThrow(/Account changed/);
  h.switchOwner(null);
  h.switchOwner('A');
  await vi.runAllTimersAsync();
  release();
  await rejected;
  expect(h.store.getDayScore('2026-10-02')).toBeNull();
});

it('rejects duplicate saves without cancelling the active save', async () => {
  const h = await harness();
  let release!: () => void;
  h.setPending(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  const save = h.store.saveCheckIn('2026-10-02', { sleep: 3 });
  await expect(h.store.saveCheckIn('2026-10-02', { sleep: 1 })).rejects.toThrow(/already saving/);
  expect(h.store.getState().savingDate).toBe('2026-10-02');
  release();
  await save;
  expect(h.calls.filter((call) => call.payload)).toHaveLength(1);
});

it('zero velocity change on a complete neutral check-in is scored, never no-score', async () => {
  const h = await harness([entry('2026-10-02', { sleep: 2 })]);
  expect(h.store.getDayScore('2026-10-02')).toMatchObject({
    state: 'scored',
    checkInStatus: 'scored',
    result: { actualChange: 0, newVelocity: 100 },
  });
});

it('invalid input surfaces error without writing or erasing prior history', async () => {
  const h = await harness();
  await expect(h.store.saveCheckIn('2026-02-30', { sleep: 3 })).rejects.toThrow(/date/);
  expect(h.calls.filter((call) => call.payload)).toHaveLength(0);
  expect(h.store.getState().status).toBe('error');
  expect(h.store.getState().lastScored?.date).toBe('2026-10-01');
});

it('captured target day survives midnight and Today moves to the actual current day', async () => {
  const h = await harness();
  let release!: () => void;
  h.setPending(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  const save = h.store.saveCheckIn('2026-10-02', { sleep: 3 });
  vi.setSystemTime(new Date('2026-10-03T00:01:00'));
  release();
  await save;
  expect(h.store.getState()).toMatchObject({
    todayKey: '2026-10-03',
    todayEntry: null,
    lastScored: { date: '2026-10-02' },
  });
  expect(h.store.getDayScore('2026-10-02')?.state).toBe('scored');
});

it('same-account refresh preserves the saving context', async () => {
  const h = await harness();
  let release!: () => void;
  h.setPending(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  const save = h.store.saveCheckIn('2026-10-02', { sleep: 3 });
  h.switchOwner('A');
  expect(h.store.getState().savingDate).toBe('2026-10-02');
  release();
  await save;
  expect(h.store.getState().status).toBe('signed-in');
});

it('late save error from A cannot overwrite B error or loading state', async () => {
  const h = await harness();
  let release!: () => void;
  h.setPending(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  h.setError(new Error('A network failed'));
  const save = h.store.saveCheckIn('2026-10-02', { sleep: 3 });
  const rejected = expect(save).rejects.toThrow('A network failed');
  h.switchOwner('B');
  await vi.runAllTimersAsync();
  release();
  await rejected;
  expect(h.store.getState()).toMatchObject({
    userId: 'B',
    status: 'signed-in',
    loadError: null,
    lastScored: null,
  });
});
