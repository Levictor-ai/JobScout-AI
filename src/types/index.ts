export * from './database';

export interface DashboardStats {
  newJobsCount: number;
  highMatchesCount: number;
  savedJobsCount: number;
  activeApplicationsCount: number;
  interviewsCount: number;
}

export interface JobFilterParams {
  role?: string;
  location?: string;
  remoteOnly?: boolean;
  minMatchScore?: number;
  seniority?: string;
  companyId?: string;
  sourceType?: string;
  searchQuery?: string;
}
