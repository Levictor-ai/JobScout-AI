import type { Json } from '@/types';
import { asString, fetchJson, isJsonObject, omitKeys, toIsoDate } from './http';
import { htmlToText, truncateText } from './text';
import type { JobSourceAdapter, NormalizedJob, SourceConfig } from './types';
import { inferEmploymentType, inferRemoteStatus, inferRoleCategory, inferSeniority } from '@/lib/ingestion/normalize';

const MAX_DESCRIPTION_LENGTH = 20_000;

interface GreenhouseJob {
  id?: number;
  title?: string;
  content?: string;
  location?: { name?: string };
  absolute_url?: string;
  updated_at?: string;
  first_published?: string;
  requisition_id?: string | number;
  company_name?: string;
  departments?: Array<{ name?: string } | null> | null;
  metadata?: unknown;
}

interface GreenhouseResponse {
  jobs?: GreenhouseJob[] | null;
}

export const greenhouseAdapter: JobSourceAdapter = {
  type: 'greenhouse',

  endpoint(config: SourceConfig): string {
    return `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(
      config.atsIdentifier
    )}/jobs?content=true`;
  },

  careersUrl(config: SourceConfig): string {
    return `https://job-boards.greenhouse.io/${config.atsIdentifier}`;
  },

  async fetchJobs(config: SourceConfig): Promise<NormalizedJob[]> {
    const payload = await fetchJson<GreenhouseResponse>(this.endpoint(config), {
      atsType: 'greenhouse',
      identifier: config.atsIdentifier,
    });

    const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
    const normalized: NormalizedJob[] = [];

    for (const job of jobs) {
      if (!isJsonObject(job as unknown as Json)) continue;

      const externalId = asString(job.id);
      const title = asString(job.title)?.trim();
      const applicationUrl = asString(job.absolute_url);

      if (!externalId || !title || !applicationUrl) continue;

      const department = Array.isArray(job.departments)
        ? job.departments.map((entry) => asString(entry?.name)).find(Boolean) ?? null
        : null;

      const location = asString(job.location?.name) ?? null;
      const description = truncateText(htmlToText(job.content), MAX_DESCRIPTION_LENGTH);

      normalized.push({
        externalId,
        title,
        description: description || 'Not specified.',
        location,
        team: department,
        remoteStatus: inferRemoteStatus(location),
        employmentType: inferEmploymentType(title),
        seniority: inferSeniority(title, department),
        roleCategory: inferRoleCategory(title, department),
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        postedAt: toIsoDate(job.first_published) ?? toIsoDate(job.updated_at),
        applicationUrl,
        sourceUrl: applicationUrl,
        rawData: omitKeys(job as unknown as Json, ['content']),
      });
    }

    return normalized;
  },
};
