export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AtsType = 'greenhouse' | 'lever' | 'ashby' | 'custom';
export type RemoteStatus = 'remote' | 'hybrid' | 'onsite' | 'unknown';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'internship';
export type SeniorityLevel =
  | 'internship'
  | 'entry'
  | 'junior'
  | 'mid'
  | 'senior'
  | 'lead'
  | 'principal'
  | 'director'
  | 'unknown';

export type ApplicationStatus =
  | 'discovered'
  | 'saved'
  | 'applying'
  | 'applied'
  | 'assessment'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'withdrawn'
  | 'archived';

export type MatchRecommendation =
  | 'high_priority'
  | 'standard'
  | 'low_priority'
  | 'consider';

export interface UserPreferences {
  target_roles: string[];
  preferred_locations: string[];
  employment_types: string[];
  remote_only: boolean;
  min_match_score: number;
  notify_telegram: boolean;
}

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  headline: string | null;
  summary: string | null;
  years_experience: number;
  location: string | null;
  portfolio_url: string | null;
  linkedin_url: string | null;
  resume_text: string | null;
  preferences: UserPreferences;
  created_at: string;
  updated_at: string;
}

export interface Skill {
  id: string;
  profile_id: string;
  name: string;
  category: 'design' | 'technical' | 'tool' | 'domain';
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  website: string | null;
  careers_url: string | null;
  ats_type: AtsType;
  ats_identifier: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Source {
  id: string;
  company_id: string;
  source_type: AtsType;
  source_url: string;
  active: boolean;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  company_id: string;
  source_id: string | null;
  external_id: string;
  title: string;
  description: string;
  location: string | null;
  remote_status: RemoteStatus;
  employment_type: EmploymentType;
  seniority: SeniorityLevel;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  posted_at: string | null;
  application_url: string;
  source_url: string | null;
  raw_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface JobSkill {
  id: string;
  job_id: string;
  skill: string;
  required: boolean;
  confidence: number;
}

export interface JobMatch {
  id: string;
  job_id: string;
  profile_id: string;
  match_score: number;
  summary: string | null;
  matching_factors: string[];
  skill_gaps: string[];
  concerns: string[];
  recommendation: MatchRecommendation;
  model: string;
  created_at: string;
}

export interface SavedJob {
  id: string;
  user_id: string;
  job_id: string;
  created_at: string;
}

export interface Application {
  id: string;
  user_id: string;
  job_id: string;
  status: ApplicationStatus;
  applied_at: string | null;
  notes: string | null;
  updated_at: string;
}

export interface ScanLog {
  id: string;
  source_id: string;
  started_at: string;
  completed_at: string | null;
  jobs_found: number;
  jobs_new: number;
  jobs_updated: number;
  error: string | null;
  status: 'running' | 'completed' | 'failed';
}

// Joined types for UI views
export interface JobWithDetails extends Job {
  company: Company;
  match?: JobMatch | null;
  application?: Application | null;
  is_saved?: boolean;
}
