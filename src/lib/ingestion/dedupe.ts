import { createHash } from 'node:crypto';
import { normalizeForDedupe, normalizeWhitespace } from './normalize';
import type { NormalizedJob } from '@/lib/sources/types';

export interface DedupeCandidate {
  companyId: string;
  job: NormalizedJob;
}

export interface DedupeResult {
  unique: Array<{ companyId: string; job: NormalizedJob }>;
  duplicateCount: number;
}

/**
 * Cross-source fingerprint. The same role can appear on two boards of the same
 * company (or on a board that was migrated), so identity is derived from the
 * company plus a normalized title and location rather than the ATS id.
 */
export function buildDedupeKey(companyId: string, job: NormalizedJob): string {
  const title = normalizeForDedupe(job.title);
  const location = normalizeForDedupe(job.location ?? '');
  const team = normalizeForDedupe(job.team ?? '');
  const employment = normalizeForDedupe(job.employmentType);
  return [companyId, title, team, location, employment].join('|');
}

export function buildContentHash(job: NormalizedJob): string {
  const basis = [
    normalizeWhitespace(job.title),
    normalizeWhitespace(job.description),
    normalizeWhitespace(job.location ?? ''),
    job.salaryMin ?? '',
    job.salaryMax ?? '',
    job.salaryCurrency ?? '',
  ].join('\n');

  return createHash('sha256').update(basis).digest('hex').slice(0, 32);
}

export function dedupeJobs(candidates: DedupeCandidate[]): DedupeResult {
  const seen = new Set<string>();
  const unique: DedupeResult['unique'] = [];
  let duplicateCount = 0;

  for (const { companyId, job } of candidates) {
    const externalKey = `${companyId}::ext::${job.externalId}`;
    const contentKey = buildDedupeKey(companyId, job);

    if (seen.has(externalKey) || seen.has(contentKey)) {
      duplicateCount += 1;
      continue;
    }

    seen.add(externalKey);
    seen.add(contentKey);
    unique.push({ companyId, job });
  }

  return { unique, duplicateCount };
}
