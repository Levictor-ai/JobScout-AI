import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getActorId } from '@/lib/data/queries';
import {
  formatDigest,
  formatMatchNotification,
  isTelegramConfigured,
  sendTelegramMessage,
  type MatchNotificationJob,
} from './telegram';
import type { Json } from '@/types';

const CHANNEL = 'telegram';
const DEFAULT_MIN_SCORE = 75;
const DEFAULT_LIMIT = 10;

export interface NotifyReport {
  skipped: boolean;
  reason: string | null;
  considered: number;
  notified: number;
  failed: number;
  messageIds: number[];
  errors: string[];
}

interface MatchRow {
  id: string;
  match_score: number;
  summary: string | null;
  matching_factors: string[] | null;
  skill_gaps: string[] | null;
  jobs: {
    id: string;
    title: string;
    location: string | null;
    remote_status: string;
    employment_type: string;
    application_url: string;
    companies: { name: string } | null;
  } | null;
}

function toNotificationJob(row: MatchRow): MatchNotificationJob | null {
  const job = row.jobs;
  if (!job) return null;

  return {
    id: job.id,
    title: job.title,
    companyName: job.companies?.name ?? 'Unknown company',
    location: job.location,
    remoteStatus: job.remote_status,
    employmentType: job.employment_type,
    seniority: 'unknown',
    applicationUrl: job.application_url,
    matchScore: row.match_score,
    matchingFactors: Array.isArray(row.matching_factors) ? row.matching_factors : [],
    skillGaps: Array.isArray(row.skill_gaps) ? row.skill_gaps : [],
    summary: row.summary,
  };
}

export async function notifyHighMatchJobs(
  options: { minScore?: number; limit?: number; dryRun?: boolean } = {}
): Promise<NotifyReport> {
  const report: NotifyReport = {
    skipped: false,
    reason: null,
    considered: 0,
    notified: 0,
    failed: 0,
    messageIds: [],
    errors: [],
  };

  if (!isTelegramConfigured()) {
    return { ...report, skipped: true, reason: 'Telegram is not configured.' };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ...report, skipped: true, reason: 'Supabase is not configured.' };
  }

  // Cron has no browser session, so this resolves to the primary user. Scoping by actor keeps
  // the notification preferences correct once more than one account exists.
  const actorId = await getActorId();

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('user_id', actorId ?? '')
    .maybeSingle();

  const preferences = (profileRows?.preferences ?? null) as { notify_telegram?: boolean } | null;
  if (preferences && preferences.notify_telegram === false) {
    return { ...report, skipped: true, reason: 'Telegram notifications are disabled in profile preferences.' };
  }

  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  const limit = options.limit ?? DEFAULT_LIMIT;

  const { data, error } = await supabase
    .from('job_matches')
    .select(
      'id, match_score, summary, matching_factors, skill_gaps, jobs(id, title, location, remote_status, employment_type, application_url, companies(name))'
    )
    .gte('match_score', minScore)
    .order('match_score', { ascending: false })
    .limit(limit * 3);

  if (error) {
    return { ...report, skipped: true, reason: `Could not read matches: ${error.message}` };
  }

  const rows = (Array.isArray(data) ? data : []) as unknown as MatchRow[];
  if (rows.length === 0) {
    return { ...report, reason: 'No matches above threshold yet.' };
  }

  const candidates = rows
    .map(toNotificationJob)
    .filter((job): job is MatchNotificationJob => job !== null);

  const jobIds = candidates.map((job) => job.id);
  const { data: sentRows } = await supabase
    .from('notification_log')
    .select('job_id')
    .eq('channel', CHANNEL)
    .in('job_id', jobIds);

  const alreadySent = new Set(
    (Array.isArray(sentRows) ? sentRows : []).map((row) => String((row as { job_id: string }).job_id))
  );

  const pending = candidates.filter((job) => !alreadySent.has(job.id)).slice(0, limit);
  report.considered = pending.length;

  if (pending.length === 0) {
    return { ...report, reason: 'All matches above threshold were already notified.' };
  }

  if (options.dryRun) {
    return { ...report, reason: 'Dry run: no message sent.' };
  }

  const message = pending.length === 1
    ? formatMatchNotification(pending[0])
    : formatDigest(pending, {
        newJobCount: pending.length,
        highMatchCount: pending.filter((job) => job.matchScore >= 85).length,
      });

  const result = await sendTelegramMessage(message);

  if (!result.ok) {
    report.failed = pending.length;
    report.errors.push(result.error ?? 'Unknown Telegram error.');
    return report;
  }

  if (result.messageId) report.messageIds.push(result.messageId);

  const logRows: Array<Record<string, Json>> = pending.map((job) => ({
    channel: CHANNEL,
    job_id: job.id,
    match_score: job.matchScore,
    telegram_message_id: result.messageId,
    status: 'sent',
    error: null,
  }));

  const { error: logError } = await supabase.from('notification_log').insert(logRows);
  if (logError) report.errors.push(`Could not record notification: ${logError.message}`);

  report.notified = pending.length;
  return report;
}
