import { describe, it, expect } from 'vitest';
import { SUPABASE_SETUP_ERROR } from './supabase.ts';

describe('supabase config', () => {
  it('exports SUPABASE_SETUP_ERROR when VITE env vars are absent', () => {
    // In the test environment VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
    // are not defined; the exported error must name both env vars.
    expect(SUPABASE_SETUP_ERROR).toMatch(/VITE_SUPABASE_URL/);
    expect(SUPABASE_SETUP_ERROR).toMatch(/VITE_SUPABASE_PUBLISHABLE_KEY/);
  });
});
