import type { MatchRecommendation, SeniorityLevel } from '@/types';
import type { RoleCategory } from '@/lib/sources/types';

export const ROLE_CATEGORIES: RoleCategory[] = [
  'product_design',
  'ux_ui',
  'brand_design',
  'graphic_design',
  'web_design',
  'design_engineering',
  'product_engineering',
  'research',
  'other',
];

export const SENIORITY_LEVELS: SeniorityLevel[] = [
  'internship',
  'entry',
  'junior',
  'mid',
  'senior',
  'lead',
  'principal',
  'director',
  'unknown',
];

export const RECOMMENDATIONS: MatchRecommendation[] = [
  'high_priority',
  'standard',
  'low_priority',
  'consider',
];

export const ROLE_RELEVANCE = ['high', 'medium', 'low', 'none'] as const;

export interface ExtractedSkill {
  name: string;
  required: boolean;
  confidence: number;
}

export interface JobAnalysis {
  role_category: RoleCategory;
  seniority: SeniorityLevel;
  is_target_role: boolean;
  summary: string;
  skills: ExtractedSkill[];
  requirements: string[];
  concerns: string[];
}

export interface MatchAnalysis {
  role_relevance: (typeof ROLE_RELEVANCE)[number];
  match_score: number;
  summary: string;
  matching_factors: string[];
  skill_gaps: string[];
  concerns: string[];
  recommendation: MatchRecommendation;
}

const stringArray = { type: 'array', items: { type: 'string' } } as const;

export const JOB_ANALYSIS_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    role_category: { type: 'string', enum: ROLE_CATEGORIES },
    seniority: { type: 'string', enum: SENIORITY_LEVELS },
    is_target_role: { type: 'boolean' },
    summary: {
      type: 'string',
      description: 'Two or three factual sentences about the role. No invented information.',
    },
    skills: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          required: { type: 'boolean', description: 'True only for explicitly required qualifications.' },
          confidence: { type: 'number', description: '0 to 1.' },
        },
        required: ['name', 'required', 'confidence'],
        additionalProperties: false,
      },
    },
    requirements: stringArray,
    concerns: stringArray,
  },
  required: [
    'role_category',
    'seniority',
    'is_target_role',
    'summary',
    'skills',
    'requirements',
    'concerns',
  ],
  additionalProperties: false,
};

export const MATCH_ANALYSIS_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    role_relevance: { type: 'string', enum: ROLE_RELEVANCE },
    match_score: { type: 'integer', description: '0 to 100.' },
    summary: {
      type: 'string',
      description: 'One or two sentences explaining the score in plain language.',
    },
    matching_factors: stringArray,
    skill_gaps: stringArray,
    concerns: stringArray,
    recommendation: { type: 'string', enum: RECOMMENDATIONS },
  },
  required: [
    'role_relevance',
    'match_score',
    'summary',
    'matching_factors',
    'skill_gaps',
    'concerns',
    'recommendation',
  ],
  additionalProperties: false,
};

export function clampMatchScore(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, Math.round(numeric)));
}

export function clampConfidence(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(1, Math.max(0, Number(numeric.toFixed(2))));
}

export function sanitizeStringList(value: unknown, maxItems = 12, maxLength = 240): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.replace(/\s+/g, ' ').trim().slice(0, maxLength);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= maxItems) break;
  }

  return result;
}
