import { runIngestion, type CollectedJob } from '@/lib/ingestion/run-ingestion';
import { isTargetCandidate, withinDays } from '@/lib/ingestion/filter';
import { initialProfile } from '@/data/seed-data';
import { sendTelegramMessage } from '@/lib/notifications/telegram';
import { jobKey, readState, writeState, type DigestState } from '@/lib/notifications/live-state';
import type { RoleCategory } from '@/lib/sources/types';

/**
 * Database-free digest.
 *
 * Fetches live Greenhouse and Ashby boards, keeps the roles worth seeing, drops anything
 * already sent, and pushes the rest to Telegram. Needs no Supabase and no OpenAI key, which
 * makes it the one path that works on a fresh checkout.
 *
 * Defaults are deliberately permissive: this is meant to be useful on day one, before a
 * profile is dialled in. Pass `includeAllRoles: false` to fall back to title/category
 * matching, and narrow `postedWithinDays` to only recent postings.
 *
 * There are no match scores here, so the message never claims a percentage. It reports the
 * signals that are genuinely known: title, board, location, and how fresh the posting is.
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
  dryRun?: boolean;
  markSent?: boolean;
}

export interface LiveDigestRow {
  title: string;
  company: string;
  location: string | null;
  remoteStatus: string;
  employmentType: string;
  applicationUrl: string;
  postedAt: string | null;
  matchedOn: string;
}

export interface LiveDigestResult {
  ok: boolean;
  mode: 'live';
  boardsScanned: number;
  jobsFetched: number;
  matchedTargetRoles: number;
  alreadySent: number;
  newRoles: number;
  heldBack: number;
  messagesSent: number;
  rolesSent: number;
  failedMessages: number;
  dryRun: boolean;
  stateWritten: boolean;
  stateError?: string;
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
  return [
    `<b>${escape(row.title)}</b>`,
    `${escape(row.company)} · ${escape(row.location ?? 'Location not specified')} · ${relativeAge(row.postedAt)}`,
    `<i>${escape(row.remoteStatus.replace('_', ' '))} · ${escape(row.employmentType.replace('_', ' '))}</i>`,
    `<a href="${escape(row.applicationUrl)}">View and apply</a>`,
  ].join('\n');
}

function header(count: number, scanned: number, part: number, parts: number): string {
  const suffix = parts > 1 ? ` (part ${part}/${parts})` : '';
  return [
    '<b>JobScout AI</b>',
    `${count} role${count === 1 ? '' : 's'} from ${scanned} live board${scanned === 1 ? '' : 's'}${suffix}.`,
    '<i>Filtered on title and posting age. No AI scoring on this path.</i>',
  ].join('\n');
}

function buildMessages(rows: LiveDigestRow[], scanned: number): string[] {
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
    const body = chunk.map(renderRow).join('\n\n');
    return `${header(chunk.length, scanned, index + 1, chunks.length)}\n\n${body}`;
  });
}

export async function sendLiveDigest(options: LiveDigestOptions = {}): Promise<LiveDigestResult> {
  const postedWithinDays = options.postedWithinDays ?? 365;
  const includeAllRoles = options.includeAllRoles !== false;
  const maxTotal = options.maxTotal ?? 250;
  const dryRun = options.dryRun === true;

  const base: LiveDigestResult = {
    ok: false,
    mode: 'live',
    boardsScanned: 0,
    jobsFetched: 0,
    matchedTargetRoles: 0,
    alreadySent: 0,
    newRoles: 0,
    heldBack: 0,
    messagesSent: 0,
    rolesSent: 0,
    failedMessages: 0,
    dryRun,
    stateWritten: false,
    messageIds: [],
    jobs: [],
  };

  let collected: CollectedJob[];
  let boardsScanned: number;

  try {
    const report = await runIngestion({
      dryRun: true,
      collectJobs: true,
      includeSamples: 0,
      maxCompanies: options.maxCompanies ?? 15,
    });

    collected = report.jobs ?? [];
    boardsScanned = report.companiesScanned;
  } catch (error) {
    return {
      ...base,
      error: error instanceof Error ? error.message : 'Could not reach the job boards.',
    };
  }

  const targetRoles = initialProfile.preferences.target_roles;
  const remoteOnly = initialProfile.preferences.remote_only;
  const now = Date.now();
  const seen = new Set<string>();
  const candidates: LiveDigestRow[] = [];

  const ordered = [...collected].sort((a, b) => {
    const left = a.job.postedAt ? Date.parse(a.job.postedAt) : 0;
    const right = b.job.postedAt ? Date.parse(b.job.postedAt) : 0;
    return right - left;
  });

  for (const entry of ordered) {
    const { job } = entry;

    if (!withinDays(job.postedAt, postedWithinDays, now)) continue;

    if (!includeAllRoles) {
      const roleCategory = job.roleCategory as RoleCategory;
      if (!isTargetCandidate(job.title, roleCategory, targetRoles, false)) continue;
      if (remoteOnly && job.remoteStatus === 'onsite') continue;
    }

    const key = jobKey({
      company: entry.companyName,
      title: job.title,
      url: job.applicationUrl,
    });
    if (seen.has(key)) continue;
    seen.add(key);

    candidates.push({
      title: job.title,
      company: entry.companyName,
      location: job.location,
      remoteStatus: job.remoteStatus,
      employmentType: job.employmentType,
      applicationUrl: job.applicationUrl,
      postedAt: job.postedAt,
      matchedOn: includeAllRoles ? 'all roles' : 'target role',
    });
  }

  const state = await readState();
  const fresh = candidates.filter((row) => {
    const key = jobKey({ company: row.company, title: row.title, url: row.applicationUrl });
    return !state.sent[key];
  });

  const selected = fresh.slice(0, maxTotal);
  const messages = buildMessages(selected, boardsScanned);

  const result: LiveDigestResult = {
    ...base,
    ok: true,
    boardsScanned,
    jobsFetched: collected.length,
    matchedTargetRoles: candidates.length,
    alreadySent: candidates.length - fresh.length,
    newRoles: selected.length,
    heldBack: fresh.length - selected.length,
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
      const key = jobKey({ company: row.company, title: row.title, url: row.applicationUrl });
      next.sent[key] = new Date().toISOString();
    }

    const written = await writeState(next);
    result.stateWritten = written.ok;
    if (!written.ok) result.stateError = written.error;
  }

  return result;
}
