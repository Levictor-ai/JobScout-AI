import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { runIngestion, type CollectedJob } from '@/lib/ingestion/run-ingestion';
import { normalizeForDedupe } from '@/lib/ingestion/normalize';
import type { RoleCategory } from '@/lib/sources/types';
import { analyzeJob, matchJob } from './analyze';
import { getModel } from './client';
import type { AiUsage } from './client';
import type { JobAnalysis, MatchAnalysis } from './schemas';
import type { AnalysisJobInput, ChatMessage, MatchProfileInput } from './prompts';
import { buildAnalysisMessages, buildMatchMessages } from './prompts';
import { initialProfile } from '@/data/seed-data';
import type { Json, MatchRecommendation, SeniorityLevel } from '@/types';

const DEFAULT_LIMIT = 10;
const DEFAULT_POSTED_WITHIN_DAYS = 30;
const DEFAULT_CONCURRENCY = 2;

const TARGET_ROLE_CATEGORIES: RoleCategory[] = [
  'product_design',
  'ux_ui',
  'brand_design',
  'graphic_design',
  'web_design',
  'design_engineering',
  'product_engineering',
  'research',
];

export interface AnalysisJobResult {
  jobId: string | null;
  company: string;
  title: string;
  location: string | null;
  roleCategory: RoleCategory;
  seniority: SeniorityLevel;
  summary: string;
  skills: string[];
  match: MatchAnalysis | null;
  usage: AiUsage;
  error: string | null;
}

export interface AnalysisReport {
  mode: 'preview' | 'run';
  model: string;
  startedAt: string;
  completedAt: string;
  jobsConsidered: number;
  jobsAnalyzed: number;
  jobsMatched: number;
  failed: number;
  skippedNonTarget: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  results: AnalysisJobResult[];
  errors: string[];
  promptPreview?: {
    jobTitle: string;
    company: string;
    analysis: ChatMessage[];
    match: ChatMessage[];
  };
}

export interface RunAnalysisOptions {
  mode?: 'preview' | 'run';
  limit?: number;
  postedWithinDays?: number;
  concurrency?: number;
  includeAllRoles?: boolean;
  pendingOnly?: boolean;
  inspectPrompts?: boolean;
  maxCompanies?: number;
  companyIds?: string[];
  profile?: Partial<MatchProfileInput>;
}

interface JobCandidate {
  jobId: string | null;
  company: string;
  input: AnalysisJobInput;
  roleCategory: RoleCategory;
}

function seedProfile(): MatchProfileInput {
  return {
    name: initialProfile.name,
    headline: initialProfile.headline,
    summary: initialProfile.summary,
    yearsExperience: initialProfile.years_experience,
    location: initialProfile.location,
    portfolioUrl: initialProfile.portfolio_url,
    linkedinUrl: initialProfile.linkedin_url,
    resumeText: initialProfile.resume_text,
    targetRoles: initialProfile.preferences.target_roles,
    preferredLocations: initialProfile.preferences.preferred_locations,
    employmentTypes: initialProfile.preferences.employment_types,
    remoteOnly: initialProfile.preferences.remote_only,
    skills: [],
  };
}

function mergeProfile(override?: Partial<MatchProfileInput>): MatchProfileInput {
  const base = seedProfile();
  if (!override) return base;

  return {
    ...base,
    ...override,
    targetRoles: override.targetRoles ?? base.targetRoles,
    preferredLocations: override.preferredLocations ?? base.preferredLocations,
    employmentTypes: override.employmentTypes ?? base.employmentTypes,
    skills: override.skills ?? base.skills,
  };
}

async function loadProfileFromDb(
  supabase: SupabaseClient
): Promise<MatchProfileInput | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, name, headline, summary, years_experience, location, portfolio_url, linkedin_url, resume_text, preferences, skills(name, category, proficiency)'
    )
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const preferences = (data.preferences ?? {}) as {
    target_roles?: string[];
    preferred_locations?: string[];
    employment_types?: string[];
    remote_only?: boolean;
  };

  const skills = Array.isArray(data.skills)
    ? data.skills
        .filter((skill): skill is { name: string; category: string; proficiency: string } =>
          Boolean(skill?.name)
        )
        .map((skill) => ({
          name: String(skill.name),
          category: String(skill.category ?? 'design'),
          proficiency: String(skill.proficiency ?? 'intermediate'),
        }))
    : [];

  return {
    name: String(data.name ?? 'Candidate'),
    headline: data.headline ?? null,
    summary: data.summary ?? null,
    yearsExperience: Number(data.years_experience ?? 0),
    location: data.location ?? null,
    portfolioUrl: data.portfolio_url ?? null,
    linkedinUrl: data.linkedin_url ?? null,
    resumeText: data.resume_text ?? null,
    targetRoles: preferences.target_roles ?? [],
    preferredLocations: preferences.preferred_locations ?? [],
    employmentTypes: preferences.employment_types ?? [],
    remoteOnly: preferences.remote_only ?? false,
    skills,
  };
}

function withinDays(isoDate: string | null, days: number): boolean {
  if (!isoDate) return false;
  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) return false;
  return Date.now() - parsed <= days * 24 * 60 * 60 * 1000;
}

function isTargetTitle(title: string, targetRoles: string[]): boolean {
  if (targetRoles.length === 0) return false;
  const haystack = normalizeForDedupe(title);
  return targetRoles.some((role) => {
    const needle = normalizeForDedupe(role);
    return needle.length > 2 && haystack.includes(needle);
  });
}

function isTargetCandidate(
  title: string,
  roleCategory: RoleCategory,
  targetRoles: string[],
  includeAllRoles: boolean
): boolean {
  if (includeAllRoles) return true;
  if (TARGET_ROLE_CATEGORIES.includes(roleCategory)) return true;
  return isTargetTitle(title, targetRoles);
}

/**
 * A job is pending when it has no stored match, or when the job row changed after the newest
 * match was written. This keeps repeated runs from paying to re-score unchanged postings.
 */
function hasFreshMatch(record: Record<string, unknown>): boolean {
  const matches = Array.isArray(record.job_matches) ? (record.job_matches as Array<Record<string, unknown>>) : [];
  if (matches.length === 0) return false;

  const newestMatch = matches
    .map((match) => (match.created_at ? Date.parse(String(match.created_at)) : 0))
    .reduce((latest, value) => (value > latest ? value : latest), 0);

  if (newestMatch === 0) return false;

  const updatedAt = record.updated_at ? Date.parse(String(record.updated_at)) : 0;
  if (updatedAt === 0) return true;

  return newestMatch >= updatedAt;
}

async function collectCandidatesFromDb(
  supabase: SupabaseClient,
  profile: MatchProfileInput,
  options: Required<Pick<RunAnalysisOptions, 'limit' | 'postedWithinDays' | 'includeAllRoles' | 'pendingOnly'>>
): Promise<{ candidates: JobCandidate[]; skippedNonTarget: number }> {
  const cutoff = new Date(Date.now() - options.postedWithinDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('jobs')
    .select(
      'id, title, description, location, remote_status, employment_type, seniority, role_category, posted_at, updated_at, companies(name), job_matches(created_at)'
    )
    .gte('posted_at', cutoff)
    .order('posted_at', { ascending: false })
    .limit(options.limit * 8);

  if (error) throw new Error(`Could not read jobs: ${error.message}`);

  const rows = Array.isArray(data) ? data : [];
  const candidates: JobCandidate[] = [];
  let skippedNonTarget = 0;

  for (const row of rows) {
    const record = row as Record<string, unknown>;
    const company = (record.companies as { name?: string } | null)?.name ?? 'Unknown company';
    const roleCategory = (record.role_category as RoleCategory) ?? 'other';
    const title = String(record.title ?? '');

    if (!isTargetCandidate(title, roleCategory, profile.targetRoles, options.includeAllRoles)) {
      skippedNonTarget += 1;
      continue;
    }

    if (profile.remoteOnly && record.remote_status === 'onsite') {
      skippedNonTarget += 1;
      continue;
    }

    if (options.pendingOnly && hasFreshMatch(record)) {
      skippedNonTarget += 1;
      continue;
    }

    candidates.push({
      jobId: String(record.id),
      company,
      roleCategory,
      input: {
        title,
        company,
        location: (record.location as string | null) ?? null,
        remoteStatus: String(record.remote_status ?? 'unknown'),
        employmentType: String(record.employment_type ?? 'full_time'),
        description: String(record.description ?? 'Not specified.'),
      },
    });

    if (candidates.length >= options.limit) break;
  }

  return { candidates, skippedNonTarget };
}

async function collectCandidatesLive(
  profile: MatchProfileInput,
  options: Required<Pick<RunAnalysisOptions, 'limit' | 'postedWithinDays' | 'includeAllRoles' | 'maxCompanies' | 'companyIds'>>
): Promise<{ candidates: JobCandidate[]; skippedNonTarget: number }> {
  const report = await runIngestion({
    dryRun: true,
    collectJobs: true,
    includeSamples: 0,
    maxCompanies: options.maxCompanies,
    companyIds: options.companyIds,
  });

  const collected: CollectedJob[] = report.jobs ?? [];
  const ordered = [...collected].sort((a, b) => {
    const left = a.job.postedAt ? Date.parse(a.job.postedAt) : 0;
    const right = b.job.postedAt ? Date.parse(b.job.postedAt) : 0;
    return right - left;
  });

  const candidates: JobCandidate[] = [];
  let skippedNonTarget = 0;

  for (const entry of ordered) {
    const { job } = entry;

    if (!withinDays(job.postedAt, options.postedWithinDays)) {
      skippedNonTarget += 1;
      continue;
    }

    if (!isTargetCandidate(job.title, job.roleCategory, profile.targetRoles, options.includeAllRoles)) {
      skippedNonTarget += 1;
      continue;
    }

    if (profile.remoteOnly && job.remoteStatus === 'onsite') {
      skippedNonTarget += 1;
      continue;
    }

    candidates.push({
      jobId: null,
      company: entry.companyName,
      roleCategory: job.roleCategory,
      input: {
        title: job.title,
        company: entry.companyName,
        location: job.location,
        remoteStatus: job.remoteStatus,
        employmentType: job.employmentType,
        description: job.description,
      },
    });

    if (candidates.length >= options.limit) break;
  }

  return { candidates, skippedNonTarget };
}

async function persistCandidate(
  supabase: SupabaseClient,
  candidate: JobCandidate,
  analysis: JobAnalysis,
  match: MatchAnalysis,
  model: string
): Promise<void> {
  if (!candidate.jobId) return;

  const jobId = candidate.jobId;

  const { error: jobError } = await supabase
    .from('jobs')
    .update({ role_category: analysis.role_category, seniority: analysis.seniority })
    .eq('id', jobId);

  if (jobError) throw new Error(`Could not update job ${jobId}: ${jobError.message}`);

  const { data: profileRows } = await supabase.from('profiles').select('id').limit(1).maybeSingle();
  const profileId = profileRows?.id ? String(profileRows.id) : null;

  const { error: skillError } = await supabase.from('job_skills').delete().eq('job_id', jobId);
  if (skillError) throw new Error(`Could not clear skills for ${jobId}: ${skillError.message}`);

  if (analysis.skills.length > 0) {
    const { error: insertError } = await supabase.from('job_skills').insert(
      analysis.skills.map((skill) => ({
        job_id: jobId,
        skill: skill.name,
        required: skill.required,
        confidence: skill.confidence,
      }))
    );
    if (insertError) throw new Error(`Could not save skills for ${jobId}: ${insertError.message}`);
  }

  if (!profileId) return;

  const matchRow: Record<string, Json> = {
    job_id: jobId,
    profile_id: profileId,
    match_score: match.match_score,
    summary: match.summary,
    matching_factors: match.matching_factors,
    skill_gaps: match.skill_gaps,
    concerns: match.concerns,
    recommendation: match.recommendation as MatchRecommendation,
    model,
  };

  const { error: matchError } = await supabase
    .from('job_matches')
    .upsert(matchRow, { onConflict: 'job_id,profile_id' });

  if (matchError) throw new Error(`Could not save match for ${jobId}: ${matchError.message}`);
}

async function processCandidate(
  candidate: JobCandidate,
  profile: MatchProfileInput,
  supabase: SupabaseClient | null
): Promise<AnalysisJobResult> {
  const base: AnalysisJobResult = {
    jobId: candidate.jobId,
    company: candidate.company,
    title: candidate.input.title,
    location: candidate.input.location,
    roleCategory: candidate.roleCategory,
    seniority: 'unknown',
    summary: '',
    skills: [],
    match: null,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    error: null,
  };

  try {
    const analysisOutcome = await analyzeJob(candidate.input);
    const matchOutcome = await matchJob(profile, candidate.input);

    if (supabase && candidate.jobId) {
      await persistCandidate(
        supabase,
        candidate,
        analysisOutcome.analysis,
        matchOutcome.match,
        matchOutcome.model
      );
    }

    return {
      ...base,
      roleCategory: analysisOutcome.analysis.role_category,
      seniority: analysisOutcome.analysis.seniority,
      summary: analysisOutcome.analysis.summary,
      skills: analysisOutcome.analysis.skills.map((skill) =>
        skill.required ? `${skill.name} (required)` : skill.name
      ),
      match: matchOutcome.match,
      usage: {
        promptTokens: analysisOutcome.usage.promptTokens + matchOutcome.usage.promptTokens,
        completionTokens:
          analysisOutcome.usage.completionTokens + matchOutcome.usage.completionTokens,
        totalTokens: analysisOutcome.usage.totalTokens + matchOutcome.usage.totalTokens,
      },
    };
  } catch (error) {
    return { ...base, error: error instanceof Error ? error.message : 'Unknown analysis error.' };
  }
}

async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
}

export async function runAnalysis(options: RunAnalysisOptions = {}): Promise<AnalysisReport> {
  const startedAt = new Date().toISOString();
  const mode = options.mode === 'run' ? 'run' : 'preview';
  const persist = mode === 'run';

  const limit = options.limit ?? DEFAULT_LIMIT;
  const postedWithinDays = options.postedWithinDays ?? DEFAULT_POSTED_WITHIN_DAYS;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const includeAllRoles = options.includeAllRoles === true;

  const supabase = persist ? getSupabaseServerClient() : null;
  if (persist && !supabase) {
    throw new Error(
      'Supabase is not configured. Run in preview mode or set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  const profileFromDb = supabase ? await loadProfileFromDb(supabase) : null;

  if (persist && !profileFromDb) {
    throw new Error(
      'No profile row is linked in the database, so results could not be persisted. Add a profile in Supabase, or pass a profile override in preview mode.'
    );
  }

  const profile = mergeProfile(options.profile ?? profileFromDb ?? undefined);

  const pendingOnly = options.pendingOnly !== false;

  const { candidates, skippedNonTarget } = supabase
    ? await collectCandidatesFromDb(supabase, profile, { limit, postedWithinDays, includeAllRoles, pendingOnly })
    : await collectCandidatesLive(profile, {
        limit,
        postedWithinDays,
        includeAllRoles,
        maxCompanies: options.maxCompanies ?? 3,
        companyIds: options.companyIds ?? [],
      });

  const results = options.inspectPrompts
    ? []
    : await runPool(candidates, concurrency, (candidate) =>
        processCandidate(candidate, profile, supabase)
      );

  const first = candidates[0];
  const promptPreview =
    options.inspectPrompts && first
      ? {
          jobTitle: first.input.title,
          company: first.company,
          analysis: buildAnalysisMessages(first.input),
          match: buildMatchMessages(profile, first.input),
        }
      : undefined;

  const usage = results.reduce(
    (total, result) => ({
      promptTokens: total.promptTokens + result.usage.promptTokens,
      completionTokens: total.completionTokens + result.usage.completionTokens,
      totalTokens: total.totalTokens + result.usage.totalTokens,
    }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  );

  return {
    mode,
    model: getModel(),
    startedAt,
    completedAt: new Date().toISOString(),
    jobsConsidered: candidates.length,
    jobsAnalyzed: results.filter((result) => result.error === null).length,
    jobsMatched: results.filter((result) => result.match !== null).length,
    failed: results.filter((result) => result.error !== null).length,
    skippedNonTarget,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    results,
    errors: results.map((result) => result.error).filter((error): error is string => Boolean(error)),
    ...(promptPreview ? { promptPreview } : {}),
  };
}
