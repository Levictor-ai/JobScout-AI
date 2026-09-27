import { SignInForm, SignUpForm } from './forms';

export const dynamic = 'force-dynamic';

/**
 * Registration is closed by default. This deployment is for a single user, so the signup form
 * is not rendered and `signUpAction` refuses regardless of how it is called.
 *
 * Set ALLOW_SIGNUP=true in the Vercel environment to reopen registration later without a
 * code change.
 */
const ALLOW_SIGNUP = process.env.ALLOW_SIGNUP === 'true';

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">JobScout</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Sign in to your account</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <SignInForm />
        </div>

        {ALLOW_SIGNUP ? (
          <details className="mt-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <summary className="cursor-pointer text-sm font-medium text-zinc-600 dark:text-zinc-300">
              Need an account?
            </summary>
            <div className="mt-4">
              <SignUpForm />
            </div>
          </details>
        ) : null}
      </div>
    </main>
  );
}
