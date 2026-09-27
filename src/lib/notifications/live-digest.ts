import { runIngestion, type CollectedJob } from '@/lib/ingestion/run-ingestion';
import { isTargetCandidate, withinDays } from '@/lib/ingestion/filter';
import { describeRelevance, scoreRelevance } from '@/lib/matching/keyword-match';
import { fetchRemoteBoards, type RemoteBoardJob } from '@/lib/sources/remote-boards';
import { initialProfile } from '@/data/seed-data';
import { sendTelegramMessage } from '@/lib/notifications/telegram';
import { jobKey, readState, writeState, type DigestState } from '@/lib/notifications/live-state';
import type { RemoteStatus } from '@/types';
import type { RoleCategory } from '@/lib/sources/types';

/**
 * Database-free digest.
 *
 * Pulls live Greenhouse and Ashby boards plus five free remote-job aggregators, keeps what is
 * remote and recently posted, drops anything already sent, and pushes the rest to Telegram.
 * Needs no Supabase and no OpenAI key, which makes it the one path that works on a fresh
 * checkout.
 *
 * There are no match scores here, so the message never claims a percentage. It reports what
 * is actually known: title, company, location, and how fresh the posting is.
 */

/** Telegram rejects `sendMessage` text past 4096 characters, so sends are chunked. */
const MESSAGE_BUDGET = 4000;
const MAX_ROWS_PER_MESSAGE = 12;

export interface LiveDigestOptions {
  postedWithinDays?: number;
  maxCompanies?: number;
  limit?: number;
  maxTotal?: number;
  includeAllRoles?: boolean;
  requireRemote?: boolean;
  allowHybrid?: boolean;
  includeAggregators?: boolean;
  dryRun?: boolean;
  markSent?: boolean;
}

export interface LiveDigestRow {
  title: string;
  company: string;
  location: string | null;
  remoteStatus: RemoteStatus;
  employmentType: string;
  applicationUrl: string;
  postedAt: string | null;
  source: string;
  /** Keyword relevance 0-100 from the target profile. Not an AI score. */
  relevance: number;
  reasons: string[];
  matchedOn: string;
}

export interface LiveDigestResult {
  ok: boolean;
  mode: 'live';
  postedWithinDays: number;
  remoteOnly: boolean;
  boardsScanned: number;
  jobsFetched: number;
  fromAggregators: number;
  droppedNotRecent: number;
  droppedNotRemote: number;
  matchedTargetRoles: number;
  titleMatched: number;
  alreadySent: number;
  newRoles: number;
  heldBack: number;
  messagesSent: number;
  rolesSent: number;
  failedMessages: number;
  dryRun: boolean;
  stateWritten: boolean;
  stateError?: string;
  sourceCounts: Record<string, number>;
  sourceFailures: Array<{ source: string; reason: string }>;
  messageIds: Array<number | null>;
  jobs: LiveDigestRow[];
  error?: string;
}

function escape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function relativeAge(isoDate: string | null): string {
  if (!isoDate) return 'date unknown';
  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) return 'date unknown';

  const hours = Math.max(0, Math.round((Date.now() - parsed) / 3_600_000));
  if (hours < 1) return 'just posted';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 45 ? `${days}d ago` : `${Math.round(days / 30)}mo ago`;
}

function renderRow(row: LiveDigestRow): string {
  const why = row.reasons.filter(Boolean).join(' Â· ');

  return [
    `<b>${escape(row.title)}</b>`,
    `${escape(row.company)} Â· ${escape(row.location ?? 'Location not specified')} Â· ${relativeAge(row.postedAt)}`,
    `<i>${escape(row.employmentType.replace(/_/g, ' '))} Â· ${escape(why)} Â· via ${escape(row.source)}</i>`,
    `<a href="${escape(row.applicationUrl)}">View and apply</a>`,
  ].join('\n');
}

function buildMessages(rows: LiveDigestRow[], scanned: number, days: number): string[] {
  const chunks: LiveDigestRow[][] = [];
  let current: LiveDigestRow[] = [];

  for (const row of rows) {
    if (current.length >= MAX_ROWS_PER_MESSAGE) {
      chunks.push(current);
      current = [];
    }
    current.push(row);
  }
  if (current.length > 0) chunks.push(current);

  return chunks.map((chunk, index) => {
    const suffix = chunks.length > 1 ? ` (part ${index + 1}/${chunks.length})` : '';
    const head = [
      '<b>JobScout AI</b>',
      `${chunk.length} new remote role${chunk.length === 1 ? '' : 's'} from the last ${days} day${days === 1 ? '' : 's'}${suffix}.`,
      `<i>${scanned} boards scanned. Ordered by keyword match to your target profile, then newest. Not AI scored.</i>`,
    ].join('\n');

    return `${head}\n\n${chunk.map(renderRow).join('\n\n')}`;
  });
}

function toRow(job: RemoteBoardJob): LiveDigestRow {
  const relevance = scoreRelevance(job.title, job.descriptionText);

  return {
    title: job.title,
    company: job.companyName,
    location: job.location,
    remoteStatus: job.remoteStatus,
    employmentType: job.employmentType,
    applicationUrl: job.applicationUrl,
    postedAt: job.postedAt,
    source: job.source,
    relevance: relevance.score,
    reasons: describeRelevance(relevance).split(': '),
    matchedOn: 'remote and recent',
  };
}

export async function sendLiveDigest(options: LiveDigestOptions = {}): Promise<LiveDigestResult> {
  const postedWithinDays = options.postedWithinDays ?? 3;
  const includeAllRoles = options.includeAllRoles !== false;
  const requireRemote = options.requireRemote !== false;
  const allowHybrid = options.allowHybrid === true;
  const includeAggregators = options.includeAggregators !== false;
  const maxTotal = options.maxTotal ?? 250;
  const dryRun = options.dryRun === true;

  const base: LiveDigestResult = {
    ok: false,
    mode: 'live',
    postedWithinDays,
    remoteOnly: requireRemote,
    boardsScanned: 0,
    jobsFetched: 0,
    fromAggregators: 0,
    droppedNotRecent: 0,
    droppedNotRemote: 0,
    matchedTargetRoles: 0,
    titleMatched: 0,
    alreadySent: 0,
    newRoles: 0,
    heldBack: 0,
    messagesSent: 0,
    rolesSent: 0,
    failedMessages: 0,
    dryRun,
    stateWritten: false,
    messageIds: [],
    sourceCounts: {},
    sourceFailures: [],
    jobs: [],
  };

  let atsJobs: CollectedJob[] = [];
  let boardsScanned = 0;

  try {
    const report = await runIngestion({
      dryRun: true,
      collectJobs: true,
      includeSamples: 0,
      maxCompanies: options.maxCompanies ?? 15,
    });
    atsJobs = report.jobs ?? [];
    boardsScanned = report.companiesScanned;
  } catch {
    // Aggregators still work without the ATS boards, so this is not fatal.
  }

  let aggregatorJobs: RemoteBoardJob[] = [];
  const sourceCounts: Record<string, number> = {};
  const sourceFailures: LiveDigestResult['sourceFailures'] = [];

  if (includeAggregators) {
    try {
      const boards = await fetchRemoteBoards();
      aggregatorJobs = boards.jobs;
      Object.assign(sourceCounts, boards.counts);
      sourceFailures.push(...boards.failed);
    } catch (error) {
      sourceFailures.push({
        source: 'aggregators',
        reason: error instanceof Error ? error.message : 'Aggregator request failed',
      });
    }
  }

  const totalScanned = boardsScanned + Object.values(sourceCounts).filter((n) => n > 0).length;
  const now = Date.now();
  const seen = new Set<string>();
  const candidates: LiveDigestRow[] = [];
  let droppedNotRecent = 0;
  let droppedNotRemote = 0;

  const push = (row: LiveDigestRow, postedAt: string | null, remoteStatus: RemoteStatus) => {
    // An undated posting cannot be proven to fall inside the window, so it is dropped
    // rather than assumed fresh.
    if (!withinDays(postedAt, postedWithinDays, now)) {
      droppedNotRecent += 1;
      return;
    }

    if (requireRemote) {
      const allowed: RemoteStatus[] = allowHybrid ? ['remote', 'hybrid'] : ['remote'];
      if (!allowed.includes(remoteStatus)) {
        droppedNotRemote += 1;
        return;
      }
    }

    const key = jobKey({ company: row.company, title: row.title, url: row.applicationUrl });
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(row);
  };

  for (const entry of atsJobs) {
    const { job } = entry;
    if (!includeAllRoles) {
      const roleCategory = job.roleCategory as RoleCategory;
      if (!isTargetCandidate(job.title, roleCategory, initialProfile.preferences.target_roles, false)) continue;
    }

    const relevance = scoreRelevance(job.title, job.description);
    push(
      {
        title: job.title,
        company: entry.companyName,
        location: job.location,
        remoteStatus: job.remoteStatus,
        employmentType: job.employmentType,
        applicationUrl: job.applicationUrl,
        postedAt: job.postedAt,
        source: entry.companyName,
        relevance: relevance.score,
        reasons: describeRelevance(relevance).split(': '),
        matchedOn: includeAllRoles ? 'all roles' : 'target role',
      },
      job.postedAt,
      job.remoteStatus
    );
  }

  for (const job of aggregatorJobs) {
    push(toRow(job), job.postedAt, job.remoteStatus);
  }

  // Best profile match first, then newest, so the top of the digest is the most relevant
  // rather than merely the most recent.
  candidates.sort((a, b) => {
    if (b.relevance !== a.relevance) return b.relevance - a.relevance;
    return (Date.parse(b.postedAt ?? '') || 0) - (Date.parse(a.postedAt ?? '') || 0);
  });

  const titleMatched = candidates.filter((row) => row.reasons[0]?.startsWith('title')).length;

  const state = await readState();
  const fresh = candidates.filter(
    (row) => !state.sent[jobKey({ company: row.company, title: row.title, url: row.applicationUrl })]
  );

  const selected = fresh.slice(0, maxTotal);
  const messages = buildMessages(selected, totalScanned, postedWithinDays);

  const result: LiveDigestResult = {
    ...base,
    ok: true,
    boardsScanned: totalScanned,
    jobsFetched: atsJobs.length + aggregatorJobs.length,
    fromAggregators: aggregatorJobs.length,
    droppedNotRecent,
    droppedNotRemote,
    matchedTargetRoles: candidates.length,
    titleMatched,
    alreadySent: candidates.length - fresh.length,
    newRoles: selected.length,
    heldBack: fresh.length - selected.length,
    sourceCounts,
    sourceFailures,
    jobs: selected,
  };

  if (selected.length === 0) return result;
  if (dryRun) return result;

  const errors: string[] = [];

  for (const message of messages) {
    if (message.length > MESSAGE_BUDGET) {
      result.failedMessages += 1;
      errors.push('A message exceeded the Telegram size limit and was skipped.');
      continue;
    }

    const sent = await sendTelegramMessage(message);
    result.messageIds.push(sent.messageId);
    if (sent.ok) {
      result.messagesSent += 1;
    } else {
      result.failedMessages += 1;
      errors.push(sent.error ?? 'Telegram rejected a message.');
    }
  }

  result.rolesSent = Math.round((result.newRoles * result.messagesSent) / Math.max(1, messages.length));
  result.ok = result.messagesSent > 0;
  if (errors.length > 0) result.error = errors[0];

  if (result.ok && options.markSent !== false) {
    const next: DigestState = { sent: { ...state.sent } };
    for (const row of selected) {
      next.sent[jobKey({ company: row.company, title: row.title, url: row.applicationUrl })] =
        new Date().toISOString();
    }

    const written = await writeState(next);
    result.stateWritten = written.ok;
    if (!written.ok) result.stateError = written.error;
  }

  return result;
}
