import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Browser client backed by cookies rather than localStorage, so the session the browser holds
 * is the same one server components and `proxy.ts` can read.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        'Supabase credentials missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY). Running in demo/local fallback mode.'
      );
    }
    return null;
  }

  supabaseClient = createBrowserClient(url, anonKey);
  return supabaseClient;
}
