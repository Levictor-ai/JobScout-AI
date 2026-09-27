'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Profile } from '@/types';
import { saveProfileAction } from '@/lib/actions/profile';
import { Save } from 'lucide-react';

interface ProfileFormProps {
  profile: Profile;
  readOnly: boolean;
}

const FIELD_CLASS =
  'mt-1 w-full px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60';

const LABEL_CLASS = 'text-[11px] font-medium text-zinc-500 dark:text-zinc-400';

export function ProfileForm({ profile, readOnly }: ProfileFormProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(true);
  const router = useRouter();

  const submit = (formData: FormData) => {
    setMessage(null);
    startTransition(async () => {
      const result = await saveProfileAction(formData);
      setOk(result.ok);
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  };

  return (
    <form action={submit} className="space-y-4">
      {message && (
        <div
          className={`p-3 rounded-xl border text-xs font-medium ${
            ok
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
          }`}
        >
          {message}
        </div>
      )}

      <fieldset disabled={readOnly || pending} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className={LABEL_CLASS}>Name</span>
          <input name="name" defaultValue={profile.name} required className={FIELD_CLASS} />
        </label>

        <label className="block">
          <span className={LABEL_CLASS}>Headline</span>
          <input name="headline" defaultValue={profile.headline ?? ''} className={FIELD_CLASS} />
        </label>

        <label className="block">
          <span className={LABEL_CLASS}>Location</span>
          <input name="location" defaultValue={profile.location ?? ''} className={FIELD_CLASS} />
        </label>

        <label className="block">
          <span className={LABEL_CLASS}>Years of experience</span>
          <input name="yearsExperience" type="number" min={0} max={50} defaultValue={profile.years_experience} className={FIELD_CLASS} />
        </label>

        <label className="block">
          <span className={LABEL_CLASS}>Portfolio URL</span>
          <input name="portfolioUrl" type="url" defaultValue={profile.portfolio_url ?? ''} className={FIELD_CLASS} />
        </label>

        <label className="block">
          <span className={LABEL_CLASS}>LinkedIn URL</span>
          <input name="linkedinUrl" type="url" defaultValue={profile.linkedin_url ?? ''} className={FIELD_CLASS} />
        </label>

        <label className="block md:col-span-2">
          <span className={LABEL_CLASS}>Summary</span>
          <textarea name="summary" rows={3} defaultValue={profile.summary ?? ''} className={`${FIELD_CLASS} resize-y`} />
        </label>

        <label className="block md:col-span-2">
          <span className={LABEL_CLASS}>Resume text</span>
          <textarea
            name="resumeText"
            rows={6}
            defaultValue={profile.resume_text ?? ''}
            placeholder="Paste the plain text of your resume. It is sent to the matching model as profile context."
            className={`${FIELD_CLASS} resize-y`}
          />
        </label>
      </fieldset>

      <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Matching preferences</h2>

        <fieldset disabled={readOnly || pending} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block md:col-span-2">
            <span className={LABEL_CLASS}>Target roles (comma separated)</span>
            <input
              name="targetRoles"
              defaultValue={profile.preferences.target_roles.join(', ')}
              className={FIELD_CLASS}
            />
          </label>

          <label className="block md:col-span-2">
            <span className={LABEL_CLASS}>Preferred locations (comma separated)</span>
            <input
              name="preferredLocations"
              defaultValue={profile.preferences.preferred_locations.join(', ')}
              className={FIELD_CLASS}
            />
          </label>

          <label className="block">
            <span className={LABEL_CLASS}>Employment types (comma separated)</span>
            <input
              name="employmentTypes"
              defaultValue={profile.preferences.employment_types.join(', ')}
              className={FIELD_CLASS}
            />
          </label>

          <label className="block">
            <span className={LABEL_CLASS}>Minimum match score for alerts</span>
            <input
              name="minMatchScore"
              type="number"
              min={0}
              max={100}
              defaultValue={profile.preferences.min_match_score}
              className={FIELD_CLASS}
            />
          </label>
        </fieldset>

        <fieldset disabled={readOnly || pending} className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              name="remoteOnly"
              defaultChecked={profile.preferences.remote_only}
              className="w-3.5 h-3.5 rounded border-zinc-300"
            />
            Remote roles only
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              name="notifyTelegram"
              defaultChecked={profile.preferences.notify_telegram}
              className="w-3.5 h-3.5 rounded border-zinc-300"
            />
            Send Telegram alerts
          </label>
        </fieldset>
      </div>

      <button
        type="submit"
        disabled={readOnly || pending}
        className="px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 disabled:opacity-50 flex items-center gap-1.5"
      >
        <Save className="w-3.5 h-3.5" />
        {readOnly ? 'Connect Supabase to edit' : pending ? 'Saving...' : 'Save profile'}
      </button>
    </form>
  );
}
