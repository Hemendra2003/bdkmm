import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

function validHttpUrl(u: string): boolean {
  try {
    const { protocol } = new URL(u);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

// Exported so the app can show a setup error before any auth call fails.
export const SUPABASE_SETUP_ERROR: string | null =
  !url || !key
    ? 'App not configured: copy .env.example to .env and set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
    : !validHttpUrl(url)
      ? `VITE_SUPABASE_URL is not a valid http/https URL: "${url}".`
      : null;

// Safe placeholder values prevent createClient from throwing when env vars are
// absent or malformed; the app renders SUPABASE_SETUP_ERROR instead.
export const supabase = createClient(
  validHttpUrl(url) ? url : 'https://placeholder.supabase.co',
  key || 'placeholder-anon-key',
);
