'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getViewerId } from '@/lib/data/queries';
import type { ApplicationStatus } from '@/types';

/**
 * Mutations for saved jobs and the application pipeline.
 *
 * These are Server Functions, so they are reachable by direct POST. Every one of them
 * re-checks the viewer and rejects the request when Supabase is not configured, rather
 * than silently pretending to persist. Email/Auth login is not built yet: the viewer is
 * resolved from the single profile row this deployment is scoped to.
 */

export interface ActionResult {
  ok: boolean;
  message: string;
  saved?: boolean;
  status?: ApplicationStatus;
}

const TRACKABLE_STATUSES: ApplicationStatus[] = [
  'discovered',
  'saved',
  'applying',
  'applied',
  'assessment',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
  'archived',
];

function notReady(): ActionResult {
  return {
    ok: false,
    message: 'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then apply the migrations.',
  };
}

function invalid(message: string): ActionResult {
  return { ok: false, message };
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function toggleSavedJob(jobId: string): Promise<ActionResult> {
  if (!isUuid(jobId)) return invalid('Invalid job id.');

  const supabase = getSupabaseServerClient();
  if (!supabase) return notReady();

  const viewerId = await getViewerId();
  if (!viewerId) return invalid('Sign in to track this role.');

  const { data: existing } = await supabase
    .from('saved_jobs')
    .select('id')
    .eq('user_id', viewerId)
    .eq('job_id', jobId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from('saved_jobs').delete().eq('id', existing.id);
    if (error) return invalid(error.message);

    await supabase
      .from('applications')
      .update({ status: 'discovered', updated_at: new Date().toISOString() })
      .eq('user_id', viewerId)
      .eq('job_id', jobId)
      .eq('status', 'saved');

    revalidatePath('/', 'layout');
    return { ok: true, saved: false, message: 'Removed from saved jobs.' };
  }

  const { error } = await supabase.from('saved_jobs').insert({ user_id: viewerId, job_id: jobId });
  if (error) return invalid(error.message);

  revalidatePath('/', 'layout');
  return { ok: true, saved: true, message: 'Saved.' };
}

export async function setApplicationStatus(jobId: string, status: string): Promise<ActionResult> {
  if (!isUuid(jobId)) return invalid('Invalid job id.');
  if (!TRACKABLE_STATUSES.includes(status as ApplicationStatus)) return invalid('Unsupported application status.');

  const supabase = getSupabaseServerClient();
  if (!supabase) return notReady();

  const viewerId = await getViewerId();
  if (!viewerId) return invalid('Sign in to track this role.');

  if (status === 'discovered') {
    const { error } = await supabase
      .from('applications')
      .delete()
      .eq('user_id', viewerId)
      .eq('job_id', jobId);

    if (error) return invalid(error.message);

    revalidatePath('/', 'layout');
    return { ok: true, status: 'discovered', message: 'Moved back to Discovered.' };
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from('applications').upsert(
    {
      user_id: viewerId,
      job_id: jobId,
      status,
      applied_at: status === 'applied' || status === 'interview' || status === 'offer' ? now : null,
      updated_at: now,
    },
    { onConflict: 'user_id,job_id' },
  );

  if (error) return invalid(error.message);

  revalidatePath('/', 'layout');
  return { ok: true, status: status as ApplicationStatus, message: `Status set to ${status}.` };
}

export async function updateApplicationNotes(jobId: string, notes: string): Promise<ActionResult> {
  if (!isUuid(jobId)) return invalid('Invalid job id.');

  const supabase = getSupabaseServerClient();
  if (!supabase) return notReady();

  const viewerId = await getViewerId();
  if (!viewerId) return invalid('Sign in to track this role.');

  const { error } = await supabase
    .from('applications')
    .update({ notes: notes.slice(0, 4_000), updated_at: new Date().toISOString() })
    .eq('user_id', viewerId)
    .eq('job_id', jobId);

  if (error) return invalid(error.message);

  revalidatePath('/', 'layout');
  return { ok: true, message: 'Notes saved.' };
}
