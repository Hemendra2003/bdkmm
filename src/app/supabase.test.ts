import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('supabase config — SUPABASE_SETUP_ERROR', () => {
  it('is set when both VITE env vars are absent', async () => {
    // In test env VITE_* vars are undefined — reimport to get a fresh evaluation.
    const { SUPABASE_SETUP_ERROR } = await import('./supabase.ts');
    expect(SUPABASE_SETUP_ERROR).toMatch(/VITE_SUPABASE_URL/);
    expect(SUPABASE_SETUP_ERROR).toMatch(/VITE_SUPABASE_PUBLISHABLE_KEY/);
  });

  it('is set when VITE_SUPABASE_URL is a non-http malformed URL', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'not-a-valid-url');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key');
    const { SUPABASE_SETUP_ERROR } = await import('./supabase.ts');
    expect(SUPABASE_SETUP_ERROR).toMatch(/not a valid/i);
    expect(SUPABASE_SETUP_ERROR).toContain('not-a-valid-url');
  });

  it('is null when both env vars are valid', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key');
    const { SUPABASE_SETUP_ERROR } = await import('./supabase.ts');
    expect(SUPABASE_SETUP_ERROR).toBeNull();
  });
});
