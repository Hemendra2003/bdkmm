// Public browser configuration for the future Supabase module migration.
// Legacy auth.js still uses its current configuration until WP1.3/WP1.4.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
