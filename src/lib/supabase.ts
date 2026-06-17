import { createClient } from '@supabase/supabase-js';

// Accessing public variables safely with standard Vite static replacement syntax
// @ts-ignore
const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseUrl = rawSupabaseUrl.endsWith('/') ? rawSupabaseUrl.slice(0, -1) : rawSupabaseUrl;
// @ts-ignore
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

let supabaseClientSingle: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  // Ensure supabaseAnonKey is a valid JWT token string (contains exactly three dot-separated sections/payloads)
  // Dummy or placeholder strings config will be ignored gracefully.
  const isDummy = supabaseAnonKey.startsWith('your-') || supabaseAnonKey.includes('placeholder') || supabaseAnonKey === 'undefined';
  const partsCount = supabaseAnonKey.split('.').length;
  if (isDummy || partsCount !== 3) {
    return null;
  }
  
  if (!supabaseClientSingle) {
    supabaseClientSingle = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return supabaseClientSingle;
}
