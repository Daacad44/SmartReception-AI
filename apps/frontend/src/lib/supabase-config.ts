/**
 * Public Supabase project configuration.
 * Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local or Vercel.
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';

export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
