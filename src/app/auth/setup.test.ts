import { beforeEach, expect, it, vi } from 'vitest';
import type { QuestionInput } from '../../data/repositories.ts';
const m = vi.hoisted(() => ({
  owner: 'A' as string | null,
  generation: 1,
  existing: [] as QuestionInput[],
  error: null as Error | null,
  pending: null as Promise<void> | null,
  calls: [] as { filters: [string, unknown][]; payload?: Record<string, unknown>[] }[],
}));
vi.mock('../store.ts', () => ({
  getState: () => ({ userId: m.owner, status: m.owner ? 'signed-in' : 'signed-out' }),
  getAuthContext: () => ({ userId: m.owner, generation: m.generation }),
  isAuthContextCurrent: (context: { userId: string | null; generation: number }) =>
    context.userId === m.owner && context.generation === m.generation,
}));
vi.mock('../supabase.ts', () => ({
  supabase: {
    from() {
      const call: { filters: [string, unknown][]; payload?: Record<string, unknown>[] } = {
        filters: [],
      };
      m.calls.push(call);
      return {
        eq(key: string, value: unknown) {
          call.filters.push([key, value]);
          return this;
        },
        select() {
          return this;
        },
        order() {
          return this;
        },
        upsert(payload: Record<string, unknown>[]) {
          call.payload = payload;
          return this;
        },
        async then(resolve: (value: unknown) => void) {
          if (m.pending) await m.pending;
          resolve({
            data: call.payload
              ? call.payload.map((q, index) => ({ ...q, id: index + 1 }))
              : m.existing.map((q, index) => ({
                  ...q,
                  id: index + 1,
                  is_fixed: false,
                  source: 'custom',
                  sort_order: index,
                })),
            error: m.error,
          });
        },
      };
    },
  },
}));
beforeEach(() => {
  vi.resetModules();
  window.localStorage.clear();
  m.owner = 'A';
  m.generation = 1;
  m.existing = [];
  m.error = null;
  m.pending = null;
  m.calls = [];
});
it('offers four balanced mixed-importance habits without mood/sleep scoring', async () => {
  const api = await import('./setup.ts');
  const preset = api.starterPreset();
  expect(preset).toHaveLength(4);
  expect(preset.filter((q) => q.polarity === 'positive')).toHaveLength(2);
  expect(new Set(preset.map((q) => q.tier)).size).toBe(3);
  expect(preset.some((q) => /mood|sleep/i.test(q.text))).toBe(false);
  expect(m.calls).toHaveLength(0);
});
it('skip persists only for the selected account and survives a module reload', async () => {
  let api = await import('./setup.ts');
  api.skipSetup('A');
  expect(api.setupSkipped('A')).toBe(true);
  expect(api.setupSkipped('B')).toBe(false);
  await expect(async () => api.skipSetup('B')).rejects.toThrow(/Account changed/);
  vi.resetModules();
  api = await import('./setup.ts');
  expect(api.setupSkipped('A')).toBe(true);
  expect(m.calls).toHaveLength(0);
});
it('accept saves edited snapshots with owner predicates and clears only that owner skip', async () => {
  const api = await import('./setup.ts');
  api.skipSetup('A');
  window.localStorage.setItem('momentum:setup-skipped:v1:B', 'yes');
  const preset = api.starterPreset();
  preset[0].text = 'My movement';
  const save = api.saveStarterPreset(preset);
  preset[0].text = 'Changed after click';
  await save;
  const write = m.calls.find((call) => call.payload)!;
  expect(write.filters).toEqual([['user_id', 'A']]);
  expect(write.payload).toHaveLength(4);
  expect(write.payload?.[0]).toMatchObject({ user_id: 'A', text: 'My movement', sort_order: 0 });
  expect(api.setupSkipped('A')).toBe(false);
  expect(api.setupSkipped('B')).toBe(true);
});
it('existing routine or invalid edits cannot be overwritten by setup', async () => {
  const api = await import('./setup.ts');
  m.existing = api.starterPreset();
  await expect(api.saveStarterPreset(api.starterPreset())).rejects.toThrow(
    /already have a routine/,
  );
  expect(m.calls.some((call) => call.payload)).toBe(false);
  m.existing = [];
  const preset = api.starterPreset();
  preset[0].text = '';
  await expect(api.saveStarterPreset(preset)).rejects.toThrow(/question text/);
  expect(m.calls.some((call) => call.payload)).toBe(false);
});
it('backend failure preserves skip state; a changed owner stops setup before writes', async () => {
  const api = await import('./setup.ts');
  api.skipSetup('A');
  m.error = new Error('offline');
  await expect(api.saveStarterPreset(api.starterPreset())).rejects.toThrow('offline');
  expect(api.setupSkipped('A')).toBe(true);
  m.error = null;
  let release!: () => void;
  m.pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const save = api.saveStarterPreset(api.starterPreset());
  const rejected = expect(save).rejects.toThrow(/Account changed/);
  m.owner = 'B';
  m.generation++;
  release();
  await rejected;
  expect(m.calls.some((call) => call.payload)).toBe(false);
  expect(api.setupSkipped('A')).toBe(true);
});
