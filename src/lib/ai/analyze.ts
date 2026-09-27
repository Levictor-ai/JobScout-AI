import { requestStructuredJson, type AiUsage } from './client';
import {
  JOB_ANALYSIS_SCHEMA,
  MATCH_ANALYSIS_SCHEMA,
  clampConfidence,
  clampMatchScore,
  sanitizeStringList,
  type ExtractedSkill,
  type JobAnalysis,
  type MatchAnalysis,
} from './schemas';
import {
  buildAnalysisMessages,
  buildMatchMessages,
  toRecommendation,
  toRoleCategory,
  toSeniority,
  type AnalysisJobInput,
  type ChatMessage,
  type MatchProfileInput,
} from './prompts';
import { ROLE_RELEVANCE } from './schemas';

export interface AnalysisOutcome {
  analysis: JobAnalysis;
  model: string;
  usage: AiUsage;
}

export interface MatchOutcome {
  match: MatchAnalysis;
  model: string;
  usage: AiUsage;
}

function normalizeSkills(value: unknown): ExtractedSkill[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const skills: ExtractedSkill[] = [];

  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
    if (!name) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    skills.push({
      name,
      required: record.required === true,
      confidence: clampConfidence(record.confidence),
    });

    if (skills.length >= 25) break;
  }

  return skills;
}

function normalizeSummary(value: unknown): string {
  if (typeof value !== 'string') return 'Not specified.';
  const trimmed = value.replace(/\s+/g, ' ').trim().slice(0, 600);
  return trimmed || 'Not specified.';
}

export function normalizeJobAnalysis(value: unknown): JobAnalysis {
  const record = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;

  return {
    role_category: toRoleCategory(record.role_category),
    seniority: toSeniority(record.seniority),
    is_target_role: record.is_target_role === true,
    summary: normalizeSummary(record.summary),
    skills: normalizeSkills(record.skills),
    requirements: sanitizeStringList(record.requirements, 12),
    concerns: sanitizeStringList(record.concerns, 6),
  };
}

export function normalizeMatchAnalysis(value: unknown): MatchAnalysis {
  const record = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const relevance = ROLE_RELEVANCE.includes(record.role_relevance as (typeof ROLE_RELEVANCE)[number])
    ? (record.role_relevance as MatchAnalysis['role_relevance'])
    : 'none';

  return {
    role_relevance: relevance,
    match_score: clampMatchScore(record.match_score),
    summary: normalizeSummary(record.summary),
    matching_factors: sanitizeStringList(record.matching_factors, 10),
    skill_gaps: sanitizeStringList(record.skill_gaps, 8),
    concerns: sanitizeStringList(record.concerns, 6),
    recommendation: toRecommendation(record.recommendation),
  };
}

export async function analyzeJob(job: AnalysisJobInput): Promise<AnalysisOutcome> {
  const messages: ChatMessage[] = buildAnalysisMessages(job);
  const result = await requestStructuredJson<unknown>({
    schemaName: 'job_analysis',
    schema: JOB_ANALYSIS_SCHEMA,
    messages,
    maxCompletionTokens: 1200,
  });

  return { analysis: normalizeJobAnalysis(result.data), model: result.model, usage: result.usage };
}

export async function matchJob(
  profile: MatchProfileInput,
  job: AnalysisJobInput
): Promise<MatchOutcome> {
  const messages: ChatMessage[] = buildMatchMessages(profile, job);
  const result = await requestStructuredJson<unknown>({
    schemaName: 'job_match',
    schema: MATCH_ANALYSIS_SCHEMA,
    messages,
    maxCompletionTokens: 1200,
  });

  return { match: normalizeMatchAnalysis(result.data), model: result.model, usage: result.usage };
}
