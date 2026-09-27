import { fetchJson, asString, asNumber, asBoolean, toIsoDate, isJsonObject } from './http';
import { htmlToText } from './text';
import { formatSalary } from '@/lib/format';
import type { EmploymentType, Json, RemoteStatus } from '@/types';

/**
 * Free, key-less remote job boards.
 *
 * The company ATS adapters cover big employers but skew onsite/hybrid, and they only cover
 * the 12 companies in `default-companies`. These aggregators are remote by construction and
 * need no credential, so they fill exactly the gap this digest cares about: newly posted
 * remote work from companies nobody has heard of.
 *
 * What this deliberately does not do: X/Twitter, LinkedIn, Indeed, and Glassdoor. None of
 * them offer a job-search API. The X API's cheapest tier that permits search costs $100/mo,
 * and scraping LinkedIn or Indeed violates their terms and gets IPs blocked. A scraper here
 * would rot within weeks and quietly start returning nothing, so the honest move is five
 * stable JSON endpoints instead of six brittle ones.
 *
 * Field names differ per board and were verified against live responses, not documentation.
 */

export interface RemoteBoardJob {
  source: string;
  externalId: string;
  companyName: string;
  title: string;
  location: string | null;
  remoteStatus: RemoteStatus;
  employmentType: EmploymentType;
  applicationUrl: string;
  postedAt: string | null;
  /** Truncated, used only for keyword matching. Never shown in the digest. */
  descriptionText: string | null;
  /** Pre-formatted by the source, null when the board does not disclose pay. */
  salaryText: string | null;
}

export interface RemoteBoardResult {
  jobs: RemoteBoardJob[];
  /** Boards that failed, so one dead endpoint cannot silently shrink a digest. */
  failed: Array<{ source: string; reason: string }>;
  counts: Record<string, number>;
}

function clean(value: string | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/** Boards return full HTML descriptions; only a slice is needed for keyword matching. */
const DESCRIPTION_LIMIT = 4000;

function description(row: JobRow, ...keys: string[]): string | null {
  for (const key of keys) {
    const text = htmlToText(asString(row[key]));
    if (text) return text.slice(0, DESCRIPTION_LIMIT);
  }
  return null;
}

function employmentType(value: unknown): EmploymentType {
  const text = clean(asString(value)).toLowerCase().replace(/[\s-]+/g, '_');
  if (text.includes('intern')) return 'internship';
  if (text.includes('part')) return 'part_time';
  if (text.includes('contract') || text.includes('temp') || text.includes('freelance')) return 'contract';
  if (text.includes('full')) return 'full_time';
  return 'full_time';
}

type JobRow = Record<string, Json>;

function rows(payload: unknown, key: string | null): JobRow[] {
  const source = key ? (payload as Record<string, unknown> | null)?.[key] : payload;
  return Array.isArray(source) ? source.filter(isJsonObject) : [];
}

async function load(source: string, url: string, key: string | null): Promise<JobRow[]> {
  const payload = await fetchJson<Json>(url, { atsType: 'custom', identifier: source, timeoutMs: 20_000, retries: 1 });
  return rows(payload, key);
}

async function remoteOk(): Promise<RemoteBoardJob[]> {
  // Record 0 is a legal notice, not a job.
  const all = await load('RemoteOK', 'https://remoteok.com/api', null);

  return all.slice(1).flatMap((row) => {
    const title = clean(asString(row.position));
    const url = clean(asString(row.apply_url) ?? asString(row.url));
    if (!title || !url) return [];

    return [{
      source: 'RemoteOK',
      externalId: asString(row.id) ?? url,
      companyName: clean(asString(row.company)) || 'Unknown company',
      title,
      location: clean(asString(row.location)) || null,
      remoteStatus: 'remote' as const,
      employmentType: employmentType(row.tags),
      applicationUrl: url,
      postedAt: toIsoDate(row.date),
      descriptionText: description(row, 'description'),
      salaryText: formatSalary(asNumber(row.salary_min), asNumber(row.salary_max), null),
    }];
  });
}

async function remotive(): Promise<RemoteBoardJob[]> {
  const all = await load('Remotive', 'https://remotive.com/api/remote-jobs', 'jobs');

  return all.flatMap((row) => {
    const title = clean(asString(row.title));
    const url = clean(asString(row.url));
    if (!title || !url) return [];

    return [{
      source: 'Remotive',
      externalId: asString(row.id) ?? url,
      companyName: clean(asString(row.company_name)) || 'Unknown company',
      title,
      location: clean(asString(row.candidate_required_location)) || null,
      remoteStatus: 'remote' as const,
      employmentType: employmentType(row.job_type),
      applicationUrl: url,
      postedAt: toIsoDate(row.publication_date),
      descriptionText: description(row, 'description'),
      salaryText: clean(asString(row.salary)) || null,
    }];
  });
}

async function arbeitnow(): Promise<RemoteBoardJob[]> {
  const all = await load('Arbeitnow', 'https://www.arbeitnow.com/api/job-board-api', 'data');

  return all.flatMap((row) => {
    const title = clean(asString(row.title));
    const url = clean(asString(row.url));
    if (!title || !url) return [];

    // Unlike the others, this board mixes in onsite roles, so the real flag is preserved
    // and the digest decides what to do with it.
    const remote = asBoolean(row.remote);

    return [{
      source: 'Arbeitnow',
      externalId: clean(asString(row.slug)) || url,
      companyName: clean(asString(row.company_name)) || 'Unknown company',
      title,
      location: clean(asString(row.location)) || null,
      remoteStatus: (remote === true ? 'remote' : remote === false ? 'onsite' : 'unknown') as RemoteStatus,
      employmentType: employmentType(row.job_types ?? row.tags),
      applicationUrl: url,
      postedAt: toIsoDate(row.created_at),
      descriptionText: description(row, 'description'),
      salaryText: null,
    }];
  });
}

async function jobicy(): Promise<RemoteBoardJob[]> {
  const all = await load('Jobicy', 'https://jobicy.com/api/v2/remote-jobs?count=50', 'jobs');

  return all.flatMap((row) => {
    const title = clean(asString(row.jobTitle));
    const url = clean(asString(row.url));
    if (!title || !url) return [];

    return [{
      source: 'Jobicy',
      externalId: asString(row.id) ?? url,
      companyName: clean(asString(row.companyName)) || 'Unknown company',
      title,
      location: clean(asString(row.jobGeo)) || null,
      remoteStatus: 'remote' as const,
      employmentType: employmentType(row.jobType),
      applicationUrl: url,
      postedAt: toIsoDate(row.pubDate),
      descriptionText: description(row, 'jobDescription', 'description'),
      salaryText: formatSalary(asNumber(row.salaryMin), asNumber(row.salaryMax), asString(row.salaryCurrency)),
    }];
  });
}

// Kept, not inlined, so the source can be re-enabled without rewriting it. See SOURCES.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function himalayas(): Promise<RemoteBoardJob[]> {
  const all = await load('Himalayas', 'https://himalayas.app/jobs/api?limit=50', 'jobs');

  return all.flatMap((row) => {
    const title = clean(asString(row.title));
    const url = clean(asString(row.applicationLink) ?? asString(row.guid));
    if (!title || !url) return [];

    return [{
      source: 'Himalayas',
      externalId: url,
      companyName: clean(asString(row.companyName)) || 'Unknown company',
      title,
      location: clean(asString(row.locationRestrictions)) || null,
      remoteStatus: 'remote' as const,
      employmentType: employmentType(row.employmentType),
      applicationUrl: url,
      postedAt: toIsoDate(row.pubDate),
      descriptionText: description(row, 'jobDescription', 'description'),
      salaryText: formatSalary(asNumber(row.minSalary), asNumber(row.maxSalary), asString(row.currency)),
    }];
  });
}

const SOURCES: Array<{ name: string; load: () => Promise<RemoteBoardJob[]> }> = [
  { name: 'RemoteOK', load: remoteOk },
  { name: 'Remotive', load: remotive },
  { name: 'Arbeitnow', load: arbeitnow },
  { name: 'Jobicy', load: jobicy },

  // Disabled: the JSON API serves fine, but every job page returns HTTP 403 behind bot
  // protection, verified across four URLs and two header sets. Shipping links that 403 is
  // worse than shipping fewer jobs. Re-enable if a real browser can reach these pages.
  // { name: 'Himalayas', load: himalayas },
];

export async function fetchRemoteBoards(): Promise<RemoteBoardResult> {
  const settled = await Promise.allSettled(SOURCES.map((source) => source.load()));

  const jobs: RemoteBoardJob[] = [];
  const failed: RemoteBoardResult['failed'] = [];
  const counts: Record<string, number> = {};

  settled.forEach((outcome, index) => {
    const name = SOURCES[index].name;

    if (outcome.status === 'rejected') {
      failed.push({ source: name, reason: outcome.reason instanceof Error ? outcome.reason.message : 'Request failed' });
      counts[name] = 0;
      return;
    }

    counts[name] = outcome.value.length;
    jobs.push(...outcome.value);
  });

  return { jobs, failed, counts };
}
