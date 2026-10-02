import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

// Exported so the app can show a setup error before any auth call fails.
export const SUPABASE_SETUP_ERROR: string | null =
  !url || !key
    ? 'App not configured: copy .env.example to .env and set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
    : null;

// Placeholder values prevent createClient from throwing when env vars are absent;
// the app renders the setup error above instead.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder-anon-key',
);
