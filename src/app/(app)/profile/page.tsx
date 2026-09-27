import { ProfileForm } from '@/components/profile/ProfileForm';
import { getProfile } from '@/lib/data/queries';
import { getCapabilities } from '@/lib/data/capabilities';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const [profile, capabilities] = await Promise.all([getProfile(), Promise.resolve(getCapabilities())]);
  const readOnly = !capabilities.persistence;

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Profile &amp; Matching</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          This is the exact context the matching model receives. It is data only, never instructions.
        </p>
      </div>

      {readOnly && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-medium">
          Showing the seed profile. Connect Supabase to edit it; changes are stored in the profiles table.
        </div>
      )}

      <ProfileForm profile={profile} readOnly={readOnly} />
    </>
  );
}
