import { runIngestion, type CollectedJob } from '@/lib/ingestion/run-ingestion';
import { isTargetCandidate, withinDays } from '@/lib/ingestion/filter';
import { countDesignSignals, describeRelevance, scoreRelevance } from '@/lib/matching/keyword-match';
import { formatEmployment, formatLocationLine, formatPostedAge, formatSalary } from '@/lib/format';
import { fetchRemoteBoards, type RemoteBoardJob } from '@/lib/sources/remote-boards';
import { initialProfile } from '@/data/seed-data';
import { sendTelegramMessage } from '@/lib/notifications/telegram';
import { jobKey } from '@/lib/notifications/live-state';
import { resolveDigestStore, type DigestStore, type DigestSentMap } from '@/lib/notifications/digest-store';
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
  /** Reject anything scoring below this against the target profile. */
  minRelevance?: number;
  /** Reject anything whose title does not match a target title. Strictest setting. */
  requireTitleMatch?: boolean;
  /**
   * Require actual design work, not just a design-flavoured title. Builder titles such as
   * "Product Engineer" collide with ordinary backend postings, so they must be corroborated
   * by design language in the description.
   */
  designFirst?: boolean;
  dryRun?: boolean;
  markSent?: boolean;
  /**
   * Where "already sent" is remembered. Defaults to Supabase when it is configured and
   * migrated, otherwise a local JSON file. Injected by the scheduled route so a serverless run
   * cannot silently fall back to a filesystem it cannot write to.
   */
  store?: DigestStore;
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
  salaryText: string | null;
  /** True when the only title hit was a builder-tier title like "Product Engineer". */
  builderOnly: boolean;
  designSignalCount: number;
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
  droppedOffProfile: number;
  droppedNotDesign: number;
  matchedTargetRoles: number;
  titleMatched: number;
  alreadySent: number;
  newRoles: number;
  heldBack: number;
  messagesSent: number;
  rolesSent: number;
  failedMessages: number;
  dryRun: boolean;
  /** Which store answered "already sent", so a scheduled run can be audited. */
  dedupeStore: 'supabase' | 'file';
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

function renderRow(row: LiveDigestRow): string {
  const why = row.reasons.filter(Boolean).join(' · ');

  return [
    '🆕 <b>NEW JOB MATCH</b>',
    '',
    `🎯 <a href="${escape(row.applicationUrl)}">${escape(row.title)}</a>`,
    `🏢 ${escape(row.company)}`,
    `📍 ${escape(formatLocationLine(row.remoteStatus, row.location))}`,
    `💼 ${escape(formatEmployment(row.employmentType))}`,
    `💰 ${escape(row.salaryText ?? 'Not listed')}`,
    `🕐 ${escape(formatPostedAge(row.postedAt))}`,
    why ? `<i>🎯 Matched ${escape(why)} · via ${escape(row.source)}</i>` : `<i>via ${escape(row.source)}</i>`,
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
      `<b>JobScout AI</b> — ${chunk.length} new match${chunk.length === 1 ? '' : 'es'}${suffix}`,
      `Remote, posted in the last ${days} day${days === 1 ? '' : 's'} · ${scanned} boards scanned`,
      'Ranked by keyword match to your target profile. Not AI scored.',
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
    salaryText: job.salaryText,
    builderOnly: relevance.builderOnly,
    designSignalCount: countDesignSignals(job.title, job.descriptionText),
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
  const minRelevance = options.minRelevance ?? 0;
  const requireTitleMatch = options.requireTitleMatch === true;
  const designFirst = options.designFirst !== false;
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
    droppedOffProfile: 0,
    droppedNotDesign: 0,
    matchedTargetRoles: 0,
    titleMatched: 0,
    alreadySent: 0,
    newRoles: 0,
    heldBack: 0,
    messagesSent: 0,
    rolesSent: 0,
    failedMessages: 0,
    dryRun,
    dedupeStore: 'file',
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
  let droppedOffProfile = 0;
  let droppedNotDesign = 0;

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

    // The profile gate. A job that matches nothing the user actually listed is not a match,
    // however recently it was posted and wherever it is based.
    if (requireTitleMatch && !row.reasons[0]?.startsWith('title')) {
      droppedOffProfile += 1;
      return;
    }
    if (row.relevance < minRelevance) {
      droppedOffProfile += 1;
      return;
    }

    // "Product Engineer" is a real target, but it is also a substring of a lot of backend
    // software titles. A builder-tier title only counts when the posting consistently shows
    // design work, not one incidental mention in a long engineering description.
    if (designFirst && row.builderOnly && row.designSignalCount < 2) {
      droppedNotDesign += 1;
      return;
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
        builderOnly: relevance.builderOnly,
        designSignalCount: countDesignSignals(job.title, job.description),
        salaryText: formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency),
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

  const store = options.store ?? (await resolveDigestStore());
  const sentBefore = await store.read();
  const fresh = candidates.filter(
    (row) => !sentBefore[jobKey({ company: row.company, title: row.title, url: row.applicationUrl })]
  );

  const selected = fresh.slice(0, maxTotal);
  const messages = buildMessages(selected, totalScanned, postedWithinDays);

  const result: LiveDigestResult = {
    ...base,
    ok: true,
    dedupeStore: store.name,
    boardsScanned: totalScanned,
    jobsFetched: atsJobs.length + aggregatorJobs.length,
    fromAggregators: aggregatorJobs.length,
    droppedNotRecent,
    droppedNotRemote,
    droppedOffProfile,
    droppedNotDesign,
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
    const next: DigestSentMap = { ...sentBefore };
    for (const row of selected) {
      next[jobKey({ company: row.company, title: row.title, url: row.applicationUrl })] =
        new Date().toISOString();
    }

    const written = await store.write(next);
    result.stateWritten = written.ok;
    if (!written.ok) result.stateError = written.error;
  }

  return result;
}
