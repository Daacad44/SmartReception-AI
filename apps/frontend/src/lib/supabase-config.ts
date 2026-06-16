/**
 * Public Supabase project configuration.
 * The anon key is publishable (client-side) — RLS enforces data access.
 * VITE_* env vars override these defaults when set (e.g. in Vercel or .env.local).
 */
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://hlngecipthlecwqozwhe.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsbmdlY2lwdGhsZWN3cW96d2hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MjQzNjAsImV4cCI6MjA5NzIwMDM2MH0.D6qnqCfjq8nUPEAZK-1fPRqXIC5NDSnVFuBVawVRjm8';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
