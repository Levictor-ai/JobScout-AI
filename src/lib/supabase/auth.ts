import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Cookie-backed Supabase client used for authentication.
 *
 * Data access deliberately keeps using the service-role client in `server.ts`, because
 * ingestion, the cron digest and the analysis pipeline run without a browser session. This
 * module exists only to answer "who is signed in?", so the viewer id comes from a verified
 * session instead of whichever profile happens to be first in the table.
 */

function getAuthConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isAuthConfigured(): boolean {
  return getAuthConfig() !== null;
}

export async function createAuthServerClient(): Promise<SupabaseClient | null> {
  const config = getAuthConfig();
  if (!config) return null;

  const cookieStore = await cookies();

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. Session refresh is handled by `proxy.ts`,
          // which runs on the request path and can write to the outgoing response.
        }
      },
    },
  });
}

/** The signed-in user, or null. Always verified against the auth server, never trusted from the cookie payload. */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await createAuthServerClient();
  if (!supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) return null;
  return user ?? null;
}

export async function getSessionViewerId(): Promise<string | null> {
  const user = await getSessionUser();
  return user?.id ?? null;
}
