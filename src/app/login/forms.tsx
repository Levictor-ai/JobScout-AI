'use client';

import { useActionState } from 'react';
import { signInAction, signUpAction, type AuthFormState } from './actions';

const INITIAL: AuthFormState = { error: null, message: null };

const fieldClass =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-300';

function AuthForm({ mode }: { mode: 'signin' | 'signup' }) {
  const action = mode === 'signin' ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const isSignUp = mode === 'signup';

  return (
    <form action={formAction} className="space-y-4">
      {isSignUp ? (
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Name
          </label>
          <input id="name" name="name" type="text" autoComplete="name" className={fieldClass} placeholder="Your name" />
        </div>
      ) : null}

      <div>
        <label htmlFor={isSignUp ? 'signup-email' : 'email'} className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Email
        </label>
        <input
          id={isSignUp ? 'signup-email' : 'email'}
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          className={fieldClass}
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor={isSignUp ? 'signup-password' : 'password'} className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Password
        </label>
        <input
          id={isSignUp ? 'signup-password' : 'password'}
          name="password"
          type="password"
          required
          minLength={isSignUp ? 8 : undefined}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          className={fieldClass}
          placeholder={isSignUp ? 'At least 8 characters' : ''}
        />
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {pending ? 'Working…' : isSignUp ? 'Create account' : 'Sign in'}
      </button>
    </form>
  );
}

export function SignInForm() {
  return <AuthForm mode="signin" />;
}

export function SignUpForm() {
  return <AuthForm mode="signup" />;
}
