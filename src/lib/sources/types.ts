import type {
  AtsType,
  EmploymentType,
  Json,
  RemoteStatus,
  SeniorityLevel,
} from '@/types';

export type RoleCategory =
  | 'product_design'
  | 'ux_ui'
  | 'brand_design'
  | 'graphic_design'
  | 'web_design'
  | 'design_engineering'
  | 'product_engineering'
  | 'research'
  | 'other';

export interface SourceConfig {
  atsType: AtsType;
  atsIdentifier: string;
  companyName?: string;
}

export interface NormalizedJob {
  externalId: string;
  title: string;
  description: string;
  location: string | null;
  team: string | null;
  remoteStatus: RemoteStatus;
  employmentType: EmploymentType;
  seniority: SeniorityLevel;
  roleCategory: RoleCategory;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  postedAt: string | null;
  applicationUrl: string;
  sourceUrl: string | null;
  rawData: Json;
}

export interface JobSourceAdapter {
  type: AtsType;
  /** Public, unauthenticated endpoint used to list postings. */
  endpoint(config: SourceConfig): string;
  /** Public, unauthenticated endpoint a human uses to apply. */
  careersUrl(config: SourceConfig): string;
  fetchJobs(config: SourceConfig): Promise<NormalizedJob[]>;
}

export class SourceError extends Error {
  readonly status: number | undefined;
  readonly atsType: AtsType;
  readonly identifier: string;

  constructor(
    message: string,
    options: { status?: number; atsType: AtsType; identifier: string }
  ) {
    super(message);
    this.name = 'SourceError';
    this.status = options.status;
    this.atsType = options.atsType;
    this.identifier = options.identifier;
  }
}
