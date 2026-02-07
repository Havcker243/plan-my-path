import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  (import.meta.env['supabase_URL'] as string | undefined) ??
  (import.meta.env['SUPABASE_URL'] as string | undefined);
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  (import.meta.env['supabase_Publishable_key'] as string | undefined) ??
  (import.meta.env['Supabase_Publishable_key'] as string | undefined);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or anon key');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
