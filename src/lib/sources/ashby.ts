import type { Json } from '@/types';
import { asBoolean, asNumber, asString, fetchJson, isJsonObject, omitKeys, toIsoDate } from './http';
import { htmlToText, truncateText } from './text';
import type { JobSourceAdapter, NormalizedJob, SourceConfig } from './types';
import { inferEmploymentType, inferRemoteStatus, inferRoleCategory, inferSeniority } from '@/lib/ingestion/normalize';

const MAX_DESCRIPTION_LENGTH = 20_000;

interface AshbySecondaryLocation {
  location?: string | null;
  address?: { postalAddress?: Record<string, Json> | null } | null;
}

interface AshbyCompensationComponent {
  minValue?: number | null;
  maxValue?: number | null;
  currencyCode?: string | null;
  componentType?: string | null;
}

interface AshbyCompensation {
  summaryComponents?: AshbyCompensationComponent[] | null;
  scrapeableCompensationSalarySummary?: AshbyCompensationComponent | null;
  compensationTiers?: Array<{ components?: AshbyCompensationComponent[] | null }> | null;
}

interface AshbyJob {
  id?: string;
  title?: string;
  descriptionPlain?: string | null;
  descriptionHtml?: string | null;
  location?: string | null;
  secondaryLocations?: AshbySecondaryLocation[] | null;
  department?: string | null;
  team?: string | null;
  employmentType?: string | null;
  isRemote?: boolean | null;
  isListed?: boolean | null;
  workplaceType?: string | null;
  publishedAt?: string | null;
  jobUrl?: string | null;
  applyUrl?: string | null;
  compensation?: AshbyCompensation | null;
}

interface AshbyResponse {
  jobs?: AshbyJob[] | null;
}

function collectSalaryComponents(compensation: AshbyCompensation | null | undefined): AshbyCompensationComponent[] {
  if (!compensation) return [];

  const components: AshbyCompensationComponent[] = [
    ...(compensation.summaryComponents ?? []),
    ...(compensation.compensationTiers ?? []).flatMap((tier) => tier.components ?? []),
  ];

  if (components.length === 0 && compensation.scrapeableCompensationSalarySummary) {
    components.push(compensation.scrapeableCompensationSalarySummary);
  }

  return components.filter(
    (component) => component.minValue != null || component.maxValue != null
  );
}

function extractSalary(compensation: AshbyCompensation | null | undefined): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  const salaryComponents = collectSalaryComponents(compensation).filter(
    (component) => !component.componentType || component.componentType === 'SALARY'
  );

  if (salaryComponents.length === 0) return { min: null, max: null, currency: null };

  const minima = salaryComponents
    .map((component) => asNumber(component.minValue))
    .filter((value): value is number => value !== null);
  const maxima = salaryComponents
    .map((component) => asNumber(component.maxValue))
    .filter((value): value is number => value !== null);

  return {
    min: minima.length > 0 ? Math.min(...minima) : null,
    max: maxima.length > 0 ? Math.max(...maxima) : null,
    currency: asString(salaryComponents[0].currencyCode),
  };
}

function buildLocation(job: AshbyJob): string | null {
  const parts: string[] = [];

  const primary = asString(job.location)?.trim();
  if (primary) parts.push(primary);

  for (const secondary of job.secondaryLocations ?? []) {
    const label = asString(secondary?.location)?.trim();
    if (label && !parts.includes(label)) parts.push(label);
  }

  return parts.length > 0 ? parts.join(' / ') : null;
}

export const ashbyAdapter: JobSourceAdapter = {
  type: 'ashby',

  endpoint(config: SourceConfig): string {
    return `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(
      config.atsIdentifier
    )}?includeCompensation=true`;
  },

  careersUrl(config: SourceConfig): string {
    return `https://jobs.ashbyhq.com/${config.atsIdentifier}`;
  },

  async fetchJobs(config: SourceConfig): Promise<NormalizedJob[]> {
    const payload = await fetchJson<AshbyResponse>(this.endpoint(config), {
      atsType: 'ashby',
      identifier: config.atsIdentifier,
    });

    const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
    const normalized: NormalizedJob[] = [];

    for (const job of jobs) {
      if (!isJsonObject(job as unknown as Json)) continue;
      if (asBoolean(job.isListed) === false) continue;

      const externalId = asString(job.id);
      const title = asString(job.title)?.trim();
      const applicationUrl = asString(job.applyUrl) ?? asString(job.jobUrl);

      if (!externalId || !title || !applicationUrl) continue;

      const department = asString(job.department) ?? asString(job.team);
      const location = buildLocation(job);
      const description =
        truncateText(asString(job.descriptionPlain) ?? htmlToText(job.descriptionHtml), MAX_DESCRIPTION_LENGTH);
      const salary = extractSalary(job.compensation);

      normalized.push({
        externalId,
        title,
        description: description || 'Not specified.',
        location,
        team: department,
        remoteStatus: inferRemoteStatus(location, {
          isRemote: asBoolean(job.isRemote),
          workplaceType: asString(job.workplaceType),
        }),
        employmentType: inferEmploymentType(title, asString(job.employmentType)),
        seniority: inferSeniority(title, department),
        roleCategory: inferRoleCategory(title, department),
        salaryMin: salary.min,
        salaryMax: salary.max,
        salaryCurrency: salary.currency,
        postedAt: toIsoDate(job.publishedAt),
        applicationUrl,
        sourceUrl: asString(job.jobUrl) ?? applicationUrl,
        rawData: omitKeys(job as unknown as Json, ['descriptionHtml', 'descriptionPlain']),
      });
    }

    return normalized;
  },
};
