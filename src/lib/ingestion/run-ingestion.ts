import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getAdapter } from '@/lib/sources';
import type { NormalizedJob, SourceConfig } from '@/lib/sources/types';
import { buildContentHash, buildDedupeKey, dedupeJobs } from './dedupe';
import { DEFAULT_COMPANIES, toCompanyRow } from './default-companies';
import type { AtsType, Json } from '@/types';

const BATCH_SIZE = 200;
const LOOKUP_CHUNK = 50;
const REQUEST_GAP_MS = 250;

export interface MonitoredCompany extends SourceConfig {
  companyId: string;
  companyName: string;
  sourceId: string | null;
  sourceUrl: string | null;
}

export interface SourceScanResult {
  companyId: string | null;
  companyName: string;
  atsType: AtsType;
  atsIdentifier: string;
  status: 'completed' | 'failed' | 'skipped';
  jobsFound: number;
  jobsNew: number;
  jobsUpdated: number;
  duplicatesSkipped: number;
  durationMs: number;
  error: string | null;
}

export interface IngestionSample {
  company: string;
  title: string;
  location: string | null;
  remoteStatus: string;
  employmentType: string;
  seniority: string;
  roleCategory: string;
  postedAt: string | null;
  applicationUrl: string;
  descriptionLength: number;
}

export interface IngestionReport {
  mode: 'persist' | 'dry-run';
  startedAt: string;
  completedAt: string;
  companiesScanned: number;
  jobsFound: number;
  jobsNew: number;
  jobsUpdated: number;
  duplicatesSkipped: number;
  failedSources: number;
  sources: SourceScanResult[];
  samples: IngestionSample[];
  jobs?: CollectedJob[];
}

export interface CollectedJob {
  companyId: string | null;
  companyName: string;
  job: NormalizedJob;
}

export interface RunIngestionOptions {
  dryRun?: boolean;
  companyIds?: string[];
  maxCompanies?: number;
  includeSamples?: number;
  collectJobs?: boolean;
}

export function isPersistenceAvailable(): boolean {
  return getSupabaseServerClient() !== null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

async function loadMonitoredCompanies(
  supabase: SupabaseClient,
  options: RunIngestionOptions
): Promise<MonitoredCompany[]> {
  const query = supabase
    .from('companies')
    .select('id, name, ats_type, ats_identifier, sources(id, source_url, source_type, active)')
    .eq('active', true);

  const { data, error } = options.companyIds?.length
    ? await query.in('id', options.companyIds)
    : await query;

  if (error || !Array.isArray(data) || data.length === 0) {
    if (error) {
      console.warn(`[ingestion] company lookup failed: ${error.message}. Using default company list.`);
    }
    return DEFAULT_COMPANIES.map((company) => ({
      companyId: '',
      sourceId: null,
      sourceUrl: company.careersUrl,
      atsType: company.atsType,
      atsIdentifier: company.atsIdentifier,
      companyName: company.name,
    }));
  }

  const companies: MonitoredCompany[] = [];

  for (const row of data) {
    const companyId = String(row.id);
    const atsType = String(row.ats_type) as AtsType;
    const atsIdentifier = String(row.ats_identifier);
    const sourceRows = Array.isArray(row.sources) ? row.sources : [];

    const matchingSource = sourceRows.find(
      (source) => String(source.source_type) === atsType && source.active !== false
    );

    companies.push({
      companyId,
      sourceId: matchingSource ? String(matchingSource.id) : null,
      sourceUrl: matchingSource ? String(matchingSource.source_url) : null,
      atsType,
      atsIdentifier,
      companyName: String(row.name),
    });
  }

  return companies;
}

async function resolveCompanyIds(
  supabase: SupabaseClient,
  companies: MonitoredCompany[],
  persist: boolean
): Promise<void> {
  if (!persist) return;

  for (const company of companies) {
    if (company.companyId) continue;

    const { data, error } = await supabase
      .from('companies')
      .upsert([toCompanyRow(company as unknown as DefaultCompanyLike)], {
        onConflict: 'ats_type,ats_identifier',
      })
      .select('id')
      .single();

    if (error || !data) {
      console.warn(
        `[ingestion] could not register company ${company.companyName}: ${error?.message ?? 'unknown error'}`
      );
      continue;
    }

    company.companyId = String(data.id);
  }
}

type DefaultCompanyLike = {
  name: string;
  website: string;
  careersUrl: string;
  atsType: AtsType;
  atsIdentifier: string;
};

async function ensureSource(
  supabase: SupabaseClient,
  company: MonitoredCompany,
  sourceUrl: string
): Promise<void> {
  const { data, error } = await supabase
    .from('sources')
    .upsert(
      [
        {
          company_id: company.companyId,
          source_type: company.atsType,
          source_url: sourceUrl,
          active: true,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'company_id,source_type,source_url' }
    )
    .select('id')
    .single();

  if (error) {
    console.warn(`[ingestion] could not upsert source for ${company.companyName}: ${error.message}`);
    return;
  }

  if (data?.id) company.sourceId = String(data.id);
}

interface ExistingJobRow {
  id: string;
  external_id: string;
  content_hash: string | null;
  dedupe_key: string | null;
}

async function loadExistingJobs(
  supabase: SupabaseClient,
  companyId: string,
  externalIds: string[]
): Promise<ExistingJobRow[]> {
  const rows: ExistingJobRow[] = [];

  for (const ids of chunk(externalIds, LOOKUP_CHUNK)) {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, external_id, content_hash, dedupe_key')
      .eq('company_id', companyId)
      .in('external_id', ids);

    if (error) {
      console.warn(`[ingestion] existing job lookup failed: ${error.message}`);
      continue;
    }

    if (Array.isArray(data)) rows.push(...(data as unknown as ExistingJobRow[]));
  }

  return rows;
}

function buildJobRow(
  company: MonitoredCompany,
  job: NormalizedJob,
  now: string
): Record<string, Json> {
  return {
    company_id: company.companyId,
    source_id: company.sourceId,
    external_id: job.externalId,
    title: job.title,
    description: job.description,
    location: job.location,
    remote_status: job.remoteStatus,
    employment_type: job.employmentType,
    seniority: job.seniority,
    role_category: job.roleCategory,
    salary_min: job.salaryMin,
    salary_max: job.salaryMax,
    salary_currency: job.salaryCurrency,
    posted_at: job.postedAt,
    application_url: job.applicationUrl,
    source_url: job.sourceUrl,
    raw_data: job.rawData,
    dedupe_key: buildDedupeKey(company.companyId, job),
    content_hash: buildContentHash(job),
    last_seen_at: now,
    updated_at: now,
  };
}

interface PersistOutcome {
  inserted: number;
  updated: number;
  skippedDuplicates: number;
}

async function persistJobs(
  supabase: SupabaseClient,
  company: MonitoredCompany,
  jobs: NormalizedJob[],
  now: string
): Promise<PersistOutcome> {
  if (jobs.length === 0) return { inserted: 0, updated: 0, skippedDuplicates: 0 };

  const existing = await loadExistingJobs(
    supabase,
    company.companyId,
    jobs.map((job) => job.externalId)
  );

  const existingByExternalId = new Map(existing.map((row) => [row.external_id, row]));
  const claimedDedupeKeys = new Set(
    existing.map((row) => row.dedupe_key).filter((key): key is string => Boolean(key))
  );

  const inserts: Array<Record<string, Json>> = [];
  const updates: Array<Record<string, Json>> = [];
  let skippedDuplicates = 0;

  for (const job of jobs) {
    const row = buildJobRow(company, job, now);
    const key = String(row.dedupe_key);
    const match = existingByExternalId.get(job.externalId);

    if (match) {
      if (claimedDedupeKeys.has(key) && match.dedupe_key !== key) {
        skippedDuplicates += 1;
        continue;
      }
      claimedDedupeKeys.add(key);
      if (match.content_hash !== row.content_hash) updates.push(row);
      continue;
    }

    if (claimedDedupeKeys.has(key)) {
      skippedDuplicates += 1;
      continue;
    }

    claimedDedupeKeys.add(key);
    inserts.push(row);
  }

  if (inserts.length > 0) {
    for (const batch of chunk(inserts, BATCH_SIZE)) {
      const { error } = await supabase
        .from('jobs')
        .upsert(batch, { onConflict: 'company_id,external_id', ignoreDuplicates: true });
      if (error) console.warn(`[ingestion] job insert failed: ${error.message}`);
    }
  }

  if (updates.length > 0) {
    for (const batch of chunk(updates, BATCH_SIZE)) {
      const { error } = await supabase
        .from('jobs')
        .upsert(batch, { onConflict: 'company_id,external_id' });
      if (error) console.warn(`[ingestion] job update failed: ${error.message}`);
    }
  }

  const ids = jobs.map((job) => job.externalId);
  for (const idBatch of chunk(ids, LOOKUP_CHUNK)) {
    const { error } = await supabase
      .from('jobs')
      .update({ last_seen_at: now })
      .eq('company_id', company.companyId)
      .in('external_id', idBatch)
      .is('last_seen_at', null);
    if (error) console.warn(`[ingestion] last_seen_at update failed: ${error.message}`);
  }

  return {
    inserted: inserts.length,
    updated: updates.length,
    skippedDuplicates,
  };
}

async function recordScanLog(
  supabase: SupabaseClient,
  company: MonitoredCompany,
  result: SourceScanResult
): Promise<void> {
  if (!company.sourceId) return;

  const row = {
    source_id: company.sourceId,
    started_at: new Date(Date.now() - result.durationMs).toISOString(),
    completed_at: new Date().toISOString(),
    jobs_found: result.jobsFound,
    jobs_new: result.jobsNew,
    jobs_updated: result.jobsUpdated,
    error: result.error,
    status: result.status === 'completed' ? 'completed' : 'failed',
  };

  if (result.status === 'skipped') return;

  const { error } = await supabase.from('scan_logs').insert(row);
  if (error) console.warn(`[ingestion] scan log insert failed: ${error.message}`);
}

async function updateSourceState(
  supabase: SupabaseClient,
  company: MonitoredCompany,
  result: SourceScanResult
): Promise<void> {
  if (!company.sourceId) return;

  const { error } = await supabase
    .from('sources')
    .update({
      last_checked_at: new Date().toISOString(),
      last_success_at: result.status === 'completed' ? new Date().toISOString() : null,
      last_error: result.error,
    })
    .eq('id', company.sourceId);

  if (error) console.warn(`[ingestion] source state update failed: ${error.message}`);
}

export async function runIngestion(
  options: RunIngestionOptions = {}
): Promise<IngestionReport> {
  const startedAt = new Date().toISOString();
  const dryRun = options.dryRun === true;
  const supabase = dryRun ? null : getSupabaseServerClient();

  if (!dryRun && !supabase) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or run with dryRun.'
    );
  }

  let companies = supabase
    ? await loadMonitoredCompanies(supabase, options)
    : DEFAULT_COMPANIES.map((company) => ({
        companyId: '',
        sourceId: null,
        sourceUrl: company.careersUrl,
        atsType: company.atsType,
        atsIdentifier: company.atsIdentifier,
        companyName: company.name,
      }));

  if (options.maxCompanies && options.maxCompanies > 0) {
    companies = companies.slice(0, options.maxCompanies);
  }

  if (supabase) await resolveCompanyIds(supabase, companies, true);

  const results: SourceScanResult[] = [];
  const samples: IngestionSample[] = [];
  const collected: CollectedJob[] = [];
  const sampleLimit = options.includeSamples ?? (dryRun ? 10 : 0);

  for (const [index, company] of companies.entries()) {
    const companyStart = Date.now();
    const adapter = getAdapter(company.atsType);

    if (!adapter) {
      results.push({
        companyId: company.companyId || null,
        companyName: company.companyName,
        atsType: company.atsType,
        atsIdentifier: company.atsIdentifier,
        status: 'skipped',
        jobsFound: 0,
        jobsNew: 0,
        jobsUpdated: 0,
        duplicatesSkipped: 0,
        durationMs: 0,
        error: `No verified adapter for source type "${company.atsType}"`,
      });
      continue;
    }

    try {
      const jobs = await adapter.fetchJobs({
        atsType: company.atsType,
        atsIdentifier: company.atsIdentifier,
        companyName: company.companyName,
      });

      const deduped = dedupeJobs(jobs.map((job) => ({ companyId: company.companyId, job })));
      const now = new Date().toISOString();
      const sourceUrl = company.sourceUrl ?? adapter.careersUrl(company);

      let inserted = 0;
      let updated = 0;
      let duplicatesSkipped = deduped.duplicateCount;

      if (supabase) {
        await ensureSource(supabase, company, sourceUrl);
        const outcome = await persistJobs(supabase, company, deduped.unique.map((entry) => entry.job), now);
        inserted = outcome.inserted;
        updated = outcome.updated;
        duplicatesSkipped += outcome.skippedDuplicates;
      }

      const result: SourceScanResult = {
        companyId: company.companyId || null,
        companyName: company.companyName,
        atsType: company.atsType,
        atsIdentifier: company.atsIdentifier,
        status: 'completed',
        jobsFound: jobs.length,
        jobsNew: inserted,
        jobsUpdated: updated,
        duplicatesSkipped,
        durationMs: Date.now() - companyStart,
        error: null,
      };

      results.push(result);

      if (supabase) {
        await recordScanLog(supabase, company, result);
        await updateSourceState(supabase, company, result);
      }

      for (const entry of deduped.unique) {
        if (options.collectJobs) {
          collected.push({
            companyId: company.companyId || null,
            companyName: company.companyName,
            job: entry.job,
          });
        }

        if (sampleLimit > 0 && samples.length < sampleLimit) {
          samples.push({
            company: company.companyName,
            title: entry.job.title,
            location: entry.job.location,
            remoteStatus: entry.job.remoteStatus,
            employmentType: entry.job.employmentType,
            seniority: entry.job.seniority,
            roleCategory: entry.job.roleCategory,
            postedAt: entry.job.postedAt,
            applicationUrl: entry.job.applicationUrl,
            descriptionLength: entry.job.description.length,
          });
        }
      }
    } catch (error) {
      const result: SourceScanResult = {
        companyId: company.companyId || null,
        companyName: company.companyName,
        atsType: company.atsType,
        atsIdentifier: company.atsIdentifier,
        status: 'failed',
        jobsFound: 0,
        jobsNew: 0,
        jobsUpdated: 0,
        duplicatesSkipped: 0,
        durationMs: Date.now() - companyStart,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      results.push(result);

      if (supabase) {
        await recordScanLog(supabase, company, result);
        await updateSourceState(supabase, company, result);
      }
    }

    if (index < companies.length - 1) await sleep(REQUEST_GAP_MS);
  }

  return {
    mode: dryRun ? 'dry-run' : 'persist',
    startedAt,
    completedAt: new Date().toISOString(),
    companiesScanned: results.length,
    jobsFound: results.reduce((total, result) => total + result.jobsFound, 0),
    jobsNew: results.reduce((total, result) => total + result.jobsNew, 0),
    jobsUpdated: results.reduce((total, result) => total + result.jobsUpdated, 0),
    duplicatesSkipped: results.reduce((total, result) => total + result.duplicatesSkipped, 0),
    failedSources: results.filter((result) => result.status !== 'completed').length,
    sources: results,
    samples,
    ...(options.collectJobs ? { jobs: collected } : {}),
  };
}
