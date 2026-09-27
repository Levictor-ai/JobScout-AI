'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createAuthServerClient, isAuthConfigured } from '@/lib/supabase/auth';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export interface AuthFormState {
  error: string | null;
  message: string | null;
}

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isAuthConfigured()) {
    return { error: 'Authentication is not configured on this deployment.', message: null };
  }

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Enter your email and password.', message: null };
  }

  const supabase = await createAuthServerClient();
  if (!supabase) return { error: 'Authentication is not configured.', message: null };

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Deliberately vague: do not reveal whether the address exists.
    return { error: 'That email and password combination did not work.', message: null };
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isAuthConfigured()) {
    return { error: 'Authentication is not configured on this deployment.', message: null };
  }

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const name = String(formData.get('name') ?? '').trim();

  if (!email || !password) {
    return { error: 'Enter your email and a password.', message: null };
  }

  if (password.length < 8) {
    return { error: 'Use a password of at least 8 characters.', message: null };
  }

  const supabase = await createAuthServerClient();
  if (!supabase) return { error: 'Authentication is not configured.', message: null };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name || email.split('@')[0] } },
  });

  if (error) {
    return { error: error.message, message: null };
  }

  // When email confirmation is on there is no session yet, so the profile cannot be created
  // from the request. The `handle_new_user` trigger is the real fix; this is a fallback for
  // deployments with confirmation disabled. It checks before inserting rather than upserting
  // because `profiles.user_id` only becomes uniquely indexed in the auth migration.
  if (!data.session && data.user) {
    const service = getSupabaseServerClient();
    if (service) {
      const { data: existingProfile } = await service
        .from('profiles')
        .select('id')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (!existingProfile) {
        await service.from('profiles').insert({
          user_id: data.user.id,
          name: name || email.split('@')[0],
        });
      }
    }
  }

  revalidatePath('/', 'layout');

  if (!data.session) {
    return { error: null, message: 'Check your inbox to confirm the address, then sign in.' };
  }

  redirect('/');
}

export async function signOutAction(): Promise<void> {
  const supabase = await createAuthServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }

  revalidatePath('/', 'layout');
  redirect('/login');
}
