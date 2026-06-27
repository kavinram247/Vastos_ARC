import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Publishable (anon) key — safe to ship in the client. Override via Vite env if present.
const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL ?? 'https://weckowkvqpamnlcqwvfh.supabase.co';
const SUPABASE_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_LapPa0d0ihwF9Uic_cz0zA_mgDTbI6W';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// The single demo firm seeded in migration 10. Once Supabase Auth is wired,
// this comes from the authenticated user's profile instead.
export const DEMO_FIRM_ID = '11111111-1111-4111-8111-111111111111';
export const DEMO_USER_ID = '22222222-2222-4222-8222-222222222222';
