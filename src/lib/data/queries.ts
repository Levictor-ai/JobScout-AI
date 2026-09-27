import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSessionViewerId } from '@/lib/supabase/auth';
import type {
  Application,
  ApplicationStatus,
  Company,
  DashboardStats,
  Job,
  JobMatch,
  JobWithDetails,
  Profile,
  SavedJob,
} from '@/types';
import { initialProfile, sampleJobs } from '@/data/seed-data';

/**
 * Read-side data access for the dashboard.
 *
 * Two providers sit behind one contract:
 *  - `database`: Supabase rows (jobs + company + latest match + saved + application).
 *  - `demo`: the shipped seed data, used only when Supabase is not configured.
 *
 * Every function degrades to demo data instead of throwing, so the UI always renders.
 */

export type DataSource = 'database' | 'demo';

export interface JobFeedFilters {
  roleCategory?: string;
  remoteOnly?: boolean;
  sourceType?: string;
  minMatchScore?: number;
  searchQuery?: string;
  limit?: number;
}

export interface JobFeed {
  source: DataSource;
  jobs: JobWithDetails[];
  stats: DashboardStats;
  totalInDatabase: number;
}

const JOB_SELECT = `
  id, company_id, source_id, external_id, title, description, location, remote_status,
  employment_type, seniority, salary_min, salary_max, salary_currency, posted_at,
  application_url, source_url, raw_data, created_at, updated_at,
  company:companies(id, name, website, careers_url, ats_type, ats_identifier, active, created_at, updated_at),
  job_matches(id, job_id, profile_id, match_score, summary, matching_factors, skill_gaps, concerns, recommendation, model, created_at)
`;

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asRemoteStatus(value: unknown): Job['remote_status'] {
  return value === 'remote' || value === 'hybrid' || value === 'onsite' ? value : 'unknown';
}

function asEmploymentType(value: unknown): Job['employment_type'] {
  return value === 'part_time' || value === 'contract' || value === 'internship' ? value : 'full_time';
}

function asSeniority(value: unknown): Job['seniority'] {
  const allowed = ['internship', 'entry', 'junior', 'mid', 'senior', 'lead', 'principal', 'director'];
  return allowed.includes(value as string) ? (value as Job['seniority']) : 'unknown';
}

function asCompany(value: unknown): Company {
  const row = (value ?? {}) as Record<string, unknown>;

  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? 'Unknown company'),
    website: (row.website as string | null) ?? null,
    careers_url: (row.careers_url as string | null) ?? null,
    ats_type: (['greenhouse', 'lever', 'ashby', 'custom'] as const).includes(row.ats_type as never)
      ? (row.ats_type as Company['ats_type'])
      : 'custom',
    ats_identifier: String(row.ats_identifier ?? ''),
    active: row.active !== false,
    created_at: String(row.created_at ?? new Date(0).toISOString()),
    updated_at: String(row.updated_at ?? new Date(0).toISOString()),
  };
}

function asMatch(value: unknown): JobMatch | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;

  return {
    id: String(row.id ?? ''),
    job_id: String(row.job_id ?? ''),
    profile_id: String(row.profile_id ?? ''),
    match_score: toNumber(row.match_score) ?? 0,
    summary: (row.summary as string | null) ?? null,
    matching_factors: toStringArray(row.matching_factors),
    skill_gaps: toStringArray(row.skill_gaps),
    concerns: toStringArray(row.concerns),
    recommendation: (['high_priority', 'standard', 'low_priority', 'consider'] as const).includes(
      row.recommendation as never
    )
      ? (row.recommendation as JobMatch['recommendation'])
      : 'standard',
    model: String(row.model ?? ''),
    created_at: String(row.created_at ?? new Date(0).toISOString()),
  };
}

function asJob(row: Record<string, unknown>, match: JobMatch | null, application: Application | null, saved: boolean): JobWithDetails {
  return {
    id: String(row.id ?? ''),
    company_id: String(row.company_id ?? ''),
    source_id: (row.source_id as string | null) ?? null,
    external_id: String(row.external_id ?? ''),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    location: (row.location as string | null) ?? null,
    remote_status: asRemoteStatus(row.remote_status),
    employment_type: asEmploymentType(row.employment_type),
    seniority: asSeniority(row.seniority),
    salary_min: toNumber(row.salary_min),
    salary_max: toNumber(row.salary_max),
    salary_currency: (row.salary_currency as string | null) ?? null,
    posted_at: (row.posted_at as string | null) ?? null,
    application_url: String(row.application_url ?? ''),
    source_url: (row.source_url as string | null) ?? null,
    raw_data: (row.raw_data as Record<string, unknown>) ?? {},
    created_at: String(row.created_at ?? new Date(0).toISOString()),
    updated_at: String(row.updated_at ?? new Date(0).toISOString()),
    company: asCompany(row.company),
    match,
    application,
    is_saved: saved,
  };
}

/**
 * The dashboard owner. Profiles are keyed to `auth.users`, so the first profile row
 * identifies the single local user this deployment is scoped to.
 */
/**
 * The signed-in viewer's auth user id.
 *
 * This used to fall back to "the first row in `profiles`", which meant every anonymous
 * visitor to the deployment was silently treated as that one user: they could read the
 * profile and, because server components use the service-role key and bypass RLS, write to
 * their saved jobs and application pipeline. It now resolves only from a verified session,
 * so an unauthenticated request gets null and sees no personal data.
 */
export const getViewerId = cache(async (): Promise<string | null> => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  return getSessionViewerId();
});

/**
 * The primary user this deployment is scoped to, for callers that have no browser session:
 * cron digests, scheduled ingestion and the analysis pipeline. Never use this to serve a
 * request that came from a person.
 */
export const getPrimaryUserId = cache(async (): Promise<string | null> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase.from('profiles').select('user_id').not('user_id', 'is', null).limit(1).maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
});

/** Session user when there is one, otherwise the primary user for system/cron callers. */
export const getActorId = cache(async (): Promise<string | null> => {
  const sessionId = await getSessionViewerId();
  if (sessionId) return sessionId;
  return getPrimaryUserId();
});

export const getProfile = cache(async (): Promise<Profile> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return initialProfile;

  const viewerId = await getViewerId();
  if (!viewerId) return initialProfile;

  const { data } = await supabase
    .from('profiles')
    .select('id, user_id, name, headline, summary, years_experience, location, portfolio_url, linkedin_url, resume_text, preferences, created_at, updated_at')
    .eq('user_id', viewerId)
    .maybeSingle();

  if (!data) return initialProfile;

  return {
    id: String(data.id),
    user_id: String(data.user_id ?? ''),
    name: String(data.name ?? initialProfile.name),
    headline: (data.headline as string | null) ?? null,
    summary: (data.summary as string | null) ?? null,
    years_experience: toNumber(data.years_experience) ?? 0,
    location: (data.location as string | null) ?? null,
    portfolio_url: (data.portfolio_url as string | null) ?? null,
    linkedin_url: (data.linkedin_url as string | null) ?? null,
    resume_text: (data.resume_text as string | null) ?? null,
    preferences: {
      target_roles: toStringArray((data.preferences as Record<string, unknown>)?.target_roles),
      preferred_locations: toStringArray((data.preferences as Record<string, unknown>)?.preferred_locations),
      employment_types: toStringArray((data.preferences as Record<string, unknown>)?.employment_types),
      remote_only: (data.preferences as Record<string, unknown>)?.remote_only !== false,
      min_match_score: toNumber((data.preferences as Record<string, unknown>)?.min_match_score) ?? 70,
      notify_telegram: (data.preferences as Record<string, unknown>)?.notify_telegram !== false,
    },
    created_at: String(data.created_at ?? new Date(0).toISOString()),
    updated_at: String(data.updated_at ?? new Date(0).toISOString()),
  };
});

function demoStats(jobs: JobWithDetails[]): DashboardStats {
  const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;

  return {
    newJobsCount: jobs.filter((job) => job.posted_at && new Date(job.posted_at).getTime() >= twoDaysAgo).length,
    highMatchesCount: jobs.filter((job) => (job.match?.match_score ?? 0) >= 80).length,
    savedJobsCount: jobs.filter((job) => job.is_saved).length,
    activeApplicationsCount: jobs.filter((job) =>
      ['applying', 'applied', 'assessment', 'interview', 'offer'].includes(job.application?.status ?? ''),
    ).length,
    interviewsCount: jobs.filter((job) => job.application?.status === 'interview').length,
  };
}

export const getJobFeed = cache(async (filters: JobFeedFilters = {}): Promise<JobFeed> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    const jobs = sampleJobs;
    return { source: 'demo', jobs, stats: demoStats(jobs), totalInDatabase: jobs.length };
  }

  const viewerId = await getViewerId();

  let query = supabase
    .from('jobs')
    .select(JOB_SELECT)
    .order('posted_at', { ascending: false, nullsFirst: false })
    .limit(filters.limit ?? 60);

  if (filters.remoteOnly) query = query.eq('remote_status', 'remote');
  if (filters.minMatchScore) query = query.gte('job_matches.match_score', filters.minMatchScore);
  if (filters.searchQuery) query = query.ilike('title', `%${filters.searchQuery.replace(/[%_,]/g, '')}%`);

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    return { source: 'database', jobs: [], stats: demoStats([]), totalInDatabase: 0 };
  }

  const jobIds = data.map((row) => String(row.id));

  const [savedResult, applicationResult] = await Promise.all([
    viewerId
      ? supabase.from('saved_jobs').select('job_id').eq('user_id', viewerId).in('job_id', jobIds)
      : Promise.resolve({ data: [] as Array<{ job_id: string }> }),
    viewerId
      ? supabase.from('applications').select('id, user_id, job_id, status, applied_at, notes, updated_at').eq('user_id', viewerId).in('job_id', jobIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const savedIds = new Set((savedResult.data ?? []).map((row) => String(row.job_id)));
  const applications = new Map<string, Application>(
    (applicationResult.data ?? []).map((row) => [
      String(row.job_id),
      {
        id: String(row.id),
        user_id: String(row.user_id),
        job_id: String(row.job_id),
        status: String(row.status) as ApplicationStatus,
        applied_at: (row.applied_at as string | null) ?? null,
        notes: (row.notes as string | null) ?? null,
        updated_at: String(row.updated_at),
      },
    ]),
  );

  let jobs = data.map((row) => {
    const matches = Array.isArray(row.job_matches) ? (row.job_matches as unknown[]) : [];
    const latest = matches
      .map(asMatch)
      .filter((match): match is JobMatch => match !== null)
      .sort((a, b) => b.match_score - a.match_score)[0] ?? null;

    return asJob(row as Record<string, unknown>, latest, applications.get(String(row.id)) ?? null, savedIds.has(String(row.id)));
  });

  if (filters.sourceType && filters.sourceType !== 'all') {
    jobs = jobs.filter((job) => job.company.ats_type === filters.sourceType);
  }

  if (filters.roleCategory && filters.roleCategory !== 'all') {
    const needle = filters.roleCategory.toLowerCase();
    jobs = jobs.filter((job) => job.title.toLowerCase().includes(needle));
  }

  if (filters.minMatchScore) {
    jobs = jobs.filter((job) => (job.match?.match_score ?? 0) >= Number(filters.minMatchScore));
  }

  jobs.sort((a, b) => (b.match?.match_score ?? 0) - (a.match?.match_score ?? 0));

  const { count } = await supabase.from('jobs').select('id', { count: 'exact', head: true });

  return { source: 'database', jobs, stats: demoStats(jobs), totalInDatabase: count ?? jobs.length };
});

export const getSavedJobs = cache(async (): Promise<JobWithDetails[]> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return sampleJobs.filter((job) => job.is_saved);

  const viewerId = await getViewerId();
  if (!viewerId) return [];

  const { data: savedRows } = await supabase.from('saved_jobs').select('job_id').eq('user_id', viewerId);
  const jobIds = (savedRows ?? []).map((row) => String(row.job_id));
  if (jobIds.length === 0) return [];

  const { data } = await supabase
    .from('jobs')
    .select(JOB_SELECT)
    .in('id', jobIds)
    .order('posted_at', { ascending: false, nullsFirst: false });

  if (!data) return [];

  return data.map((row) => {
    const matches = Array.isArray(row.job_matches) ? (row.job_matches as unknown[]) : [];
    const latest = matches.map(asMatch).filter((match): match is JobMatch => match !== null)[0] ?? null;
    return asJob(row as Record<string, unknown>, latest, null, true);
  });
});

export const getApplicationRows = cache(async (): Promise<Array<{ application: Application; job: JobWithDetails }>> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return sampleJobs
      .filter((job) => job.application)
      .map((job) => ({ application: job.application as Application, job }));
  }

  const viewerId = await getViewerId();
  if (!viewerId) return [];

  const { data: applications } = await supabase
    .from('applications')
    .select('id, user_id, job_id, status, applied_at, notes, updated_at')
    .eq('user_id', viewerId)
    .neq('status', 'discovered')
    .order('updated_at', { ascending: false });

  if (!applications || applications.length === 0) return [];

  const jobIds = applications.map((row) => String(row.job_id));
  const { data: jobs } = await supabase
    .from('jobs')
    .select(JOB_SELECT)
    .in('id', jobIds);

  const jobById = new Map<string, JobWithDetails>(
    (jobs ?? []).map((row) => {
      const matches = Array.isArray(row.job_matches) ? (row.job_matches as unknown[]) : [];
      const latest = matches.map(asMatch).filter((match): match is JobMatch => match !== null)[0] ?? null;
      return [String(row.id), asJob(row as Record<string, unknown>, latest, null, false)];
    }),
  );

  return applications
    .map((row) => {
      const application: Application = {
        id: String(row.id),
        user_id: String(row.user_id),
        job_id: String(row.job_id),
        status: String(row.status) as ApplicationStatus,
        applied_at: (row.applied_at as string | null) ?? null,
        notes: (row.notes as string | null) ?? null,
        updated_at: String(row.updated_at),
      };
      const job = jobById.get(application.job_id);
      return job ? { application, job } : null;
    })
    .filter((entry): entry is { application: Application; job: JobWithDetails } => entry !== null);
});

export interface CompanyWithStatus extends Company {
  jobCount: number;
  lastSuccessAt: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
}

export const getCompanies = cache(async (): Promise<{ source: DataSource; companies: CompanyWithStatus[] }> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    const { DEFAULT_COMPANIES } = await import('@/lib/ingestion/default-companies');
    return {
      source: 'demo',
      companies: DEFAULT_COMPANIES.map((company) => ({
        id: `default-${company.atsType}-${company.atsIdentifier}`,
        name: company.name,
        website: company.website,
        careers_url: company.careersUrl,
        ats_type: company.atsType,
        ats_identifier: company.atsIdentifier,
        active: true,
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
        jobCount: 0,
        lastSuccessAt: null,
        lastCheckedAt: null,
        lastError: null,
      })),
    };
  }

  const { data } = await supabase
    .from('companies')
    .select('id, name, website, careers_url, ats_type, ats_identifier, active, created_at, updated_at, sources(id, last_checked_at, last_success_at, last_error)')
    .order('name');

  if (!data) return { source: 'database', companies: [] };

  const companyIds = data.map((row) => String(row.id));
  const { data: jobRows } = await supabase.from('jobs').select('id, company_id').in('company_id', companyIds);

  const counts = new Map<string, number>();
  for (const row of jobRows ?? []) {
    const key = String(row.company_id);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const companies: CompanyWithStatus[] = data.map((row) => {
    const sources = Array.isArray(row.sources) ? (row.sources as Array<Record<string, unknown>>) : [];
    const successTimes = sources.map((item) => (item.last_success_at as string | null)).filter(Boolean) as string[];
    const checkedTimes = sources.map((item) => (item.last_checked_at as string | null)).filter(Boolean) as string[];
    const errors = sources.map((item) => (item.last_error as string | null)).filter(Boolean) as string[];

    return {
      ...asCompany(row),
      jobCount: counts.get(String(row.id)) ?? 0,
      lastSuccessAt: successTimes.length > 0 ? successTimes.sort().at(-1) ?? null : null,
      lastCheckedAt: checkedTimes.length > 0 ? checkedTimes.sort().at(-1) ?? null : null,
      lastError: errors[0] ?? null,
    };
  });

  return { source: 'database', companies };
});

export const getSavedCount = cache(async (): Promise<number> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return sampleJobs.filter((job) => job.is_saved).length;

  const viewerId = await getViewerId();
  if (!viewerId) return 0;

  const { count } = await supabase
    .from('saved_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', viewerId);

  return count ?? 0;
});

export type { SupabaseClient, SavedJob };
