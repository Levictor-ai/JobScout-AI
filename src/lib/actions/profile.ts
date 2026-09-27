'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSessionViewerId } from '@/lib/supabase/auth';
import type { AtsType } from '@/types';
import type { ActionResult } from './jobs';

/**
 * Profile and company mutations. Saved jobs and applications live in jobs.ts.
 */

function stringList(formData: FormData, field: string, max = 40): string[] {
  return String(formData.get(field) ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, max);
}

function cleanUrl(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return null;
  return raw.slice(0, 500);
}

function cleanText(value: FormDataEntryValue | null, max: number): string | null {
  const raw = String(value ?? '').trim();
  return raw ? raw.slice(0, max) : null;
}

function boundedInt(value: FormDataEntryValue | null, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function notReady(): ActionResult {
  return {
    ok: false,
    message: 'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then apply the migrations.',
  };
}

export async function saveProfileAction(formData: FormData): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return notReady();

  const viewerId = await getSessionViewerId();
  if (!viewerId) {
    return { ok: false, message: 'You need to be signed in to edit a profile.' };
  }

  const { data: existing } = await supabase
    .from('profiles')
    .select('id, preferences')
    .eq('user_id', viewerId)
    .maybeSingle();

  if (!existing) {
    return { ok: false, message: 'No profile row exists for your account yet. Run the profile trigger migration, or insert one linked to your auth user.' };
  }

  const preferences = (existing.preferences as Record<string, unknown>) ?? {};

  const { error } = await supabase
    .from('profiles')
    .update({
      name: cleanText(formData.get('name'), 120) ?? 'Unnamed profile',
      headline: cleanText(formData.get('headline'), 200),
      summary: cleanText(formData.get('summary'), 4_000),
      years_experience: boundedInt(formData.get('yearsExperience'), 0, 0, 50),
      location: cleanText(formData.get('location'), 200),
      portfolio_url: cleanUrl(formData.get('portfolioUrl')),
      linkedin_url: cleanUrl(formData.get('linkedinUrl')),
      resume_text: cleanText(formData.get('resumeText'), 20_000),
      preferences: {
        ...preferences,
        target_roles: stringList(formData, 'targetRoles'),
        preferred_locations: stringList(formData, 'preferredLocations'),
        employment_types: stringList(formData, 'employmentTypes'),
        remote_only: formData.get('remoteOnly') === 'on',
        min_match_score: boundedInt(formData.get('minMatchScore'), 70, 0, 100),
        notify_telegram: formData.get('notifyTelegram') === 'on',
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/', 'layout');
  return { ok: true, message: 'Profile saved. The next analysis run will use it.' };
}

const SUPPORTED_ATS: AtsType[] = ['greenhouse', 'ashby'];

export async function addCompanyAction(formData: FormData): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return notReady();

  const atsType = String(formData.get('atsType') ?? '') as AtsType;
  if (!SUPPORTED_ATS.includes(atsType)) {
    return { ok: false, message: 'Only greenhouse and ashby have verified public endpoints in this build.' };
  }

  const name = cleanText(formData.get('name'), 120);
  const atsIdentifier = cleanText(formData.get('atsIdentifier'), 120)?.toLowerCase().replace(/[^a-z0-9-]/g, '');

  if (!name || !atsIdentifier) {
    return { ok: false, message: 'Company name and board token are both required.' };
  }

  const { error } = await supabase.from('companies').upsert(
    {
      name,
      ats_type: atsType,
      ats_identifier: atsIdentifier,
      website: cleanUrl(formData.get('website')),
      careers_url: cleanUrl(formData.get('careersUrl')),
      active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'ats_type,ats_identifier' },
  );

  if (error) return { ok: false, message: error.message };

  revalidatePath('/companies');
  return { ok: true, message: `${name} is now monitored. Run an ingestion to pull its jobs.` };
}

export async function setCompanyActiveAction(companyId: string, active: boolean): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return notReady();

  if (!companyId) return { ok: false, message: 'Missing company id.' };

  const { error } = await supabase
    .from('companies')
    .update({ active, updated_at: new Date().toISOString() })
    .eq('id', companyId);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/companies');
  return { ok: true, message: active ? 'Company enabled.' : 'Company paused.' };
}
