-- JobScout AI Database Schema Migration
-- Matches DATABASE.md specifications

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- 1. Profiles Table (extends auth.users)
create table if not exists public.profiles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    name text not null,
    headline text,
    summary text,
    years_experience integer default 0,
    location text,
    portfolio_url text,
    linkedin_url text,
    resume_text text,
    preferences jsonb default '{
        "target_roles": ["Product Designer", "UI/UX Designer", "Design Engineer", "Product Engineer"],
        "preferred_locations": ["Remote", "Nigeria", "United Kingdom", "Canada", "United States", "Europe"],
        "employment_types": ["Full-time", "Contract", "Freelance"],
        "remote_only": true,
        "min_match_score": 75,
        "notify_telegram": true
    }'::jsonb,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

-- 2. Skills Table
create table if not exists public.skills (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid references public.profiles(id) on delete cascade not null,
    name text not null,
    category text default 'design', -- design, technical, tool, domain
    proficiency text default 'intermediate', -- beginner, intermediate, advanced, expert
    created_at timestamptz default now() not null
);

-- 3. Companies Table
create table if not exists public.companies (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    website text,
    careers_url text,
    ats_type text not null, -- greenhouse, lever, ashby, custom
    ats_identifier text not null, -- company board slug/token (e.g. "stripe", "airbnb", "linear")
    active boolean default true not null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null,
    constraint unique_company_ats unique (ats_type, ats_identifier)
);

-- 4. Sources Table
create table if not exists public.sources (
    id uuid primary key default gen_random_uuid(),
    company_id uuid references public.companies(id) on delete cascade not null,
    source_type text not null, -- greenhouse, lever, ashby, custom
    source_url text not null,
    active boolean default true not null,
    last_checked_at timestamptz,
    last_success_at timestamptz,
    last_error text,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

-- 5. Jobs Table
create table if not exists public.jobs (
    id uuid primary key default gen_random_uuid(),
    company_id uuid references public.companies(id) on delete cascade not null,
    source_id uuid references public.sources(id) on delete set null,
    external_id text not null,
    title text not null,
    description text not null,
    location text,
    remote_status text default 'unknown', -- remote, hybrid, onsite, unknown
    employment_type text default 'full_time', -- full_time, part_time, contract, internship
    seniority text default 'unknown', -- internship, entry, junior, mid, senior, lead, principal, director, unknown
    salary_min numeric,
    salary_max numeric,
    salary_currency text default 'USD',
    posted_at timestamptz,
    application_url text not null,
    source_url text,
    raw_data jsonb default '{}'::jsonb,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null,
    constraint unique_company_external_job unique (company_id, external_id)
);

-- 6. Job Skills Table
create table if not exists public.job_skills (
    id uuid primary key default gen_random_uuid(),
    job_id uuid references public.jobs(id) on delete cascade not null,
    skill text not null,
    required boolean default false not null,
    confidence numeric default 1.0
);

-- 7. Job Matches Table
create table if not exists public.job_matches (
    id uuid primary key default gen_random_uuid(),
    job_id uuid references public.jobs(id) on delete cascade not null,
    profile_id uuid references public.profiles(id) on delete cascade not null,
    match_score integer not null check (match_score >= 0 and match_score <= 100),
    summary text,
    matching_factors jsonb default '[]'::jsonb,
    skill_gaps jsonb default '[]'::jsonb,
    concerns jsonb default '[]'::jsonb,
    recommendation text default 'standard', -- high_priority, standard, low_priority, consider
    model text default 'gpt-4o-mini',
    created_at timestamptz default now() not null,
    constraint unique_job_profile_match unique (job_id, profile_id)
);

-- 8. Saved Jobs Table
create table if not exists public.saved_jobs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    job_id uuid references public.jobs(id) on delete cascade not null,
    created_at timestamptz default now() not null,
    constraint unique_user_saved_job unique (user_id, job_id)
);

-- 9. Applications Table
create table if not exists public.applications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    job_id uuid references public.jobs(id) on delete cascade not null,
    status text not null default 'discovered', 
    -- Statuses: discovered, saved, applying, applied, assessment, interview, offer, rejected, withdrawn, archived
    applied_at timestamptz,
    notes text,
    updated_at timestamptz default now() not null,
    constraint unique_user_job_application unique (user_id, job_id),
    constraint valid_application_status check (
        status in ('discovered', 'saved', 'applying', 'applied', 'assessment', 'interview', 'offer', 'rejected', 'withdrawn', 'archived')
    )
);

-- 10. Scan Logs Table
create table if not exists public.scan_logs (
    id uuid primary key default gen_random_uuid(),
    source_id uuid references public.sources(id) on delete cascade not null,
    started_at timestamptz default now() not null,
    completed_at timestamptz,
    jobs_found integer default 0,
    jobs_new integer default 0,
    jobs_updated integer default 0,
    error text,
    status text default 'running' check (status in ('running', 'completed', 'failed'))
);

-- Performance Indexes
create index if not exists idx_jobs_company_id on public.jobs(company_id);
create index if not exists idx_jobs_posted_at on public.jobs(posted_at desc);
create index if not exists idx_jobs_remote_status on public.jobs(remote_status);
create index if not exists idx_job_matches_score on public.job_matches(match_score desc);
create index if not exists idx_job_matches_profile on public.job_matches(profile_id);
create index if not exists idx_applications_user on public.applications(user_id);
create index if not exists idx_applications_status on public.applications(status);
create index if not exists idx_companies_active on public.companies(active);
create index if not exists idx_sources_active on public.sources(active);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.skills enable row level security;
alter table public.companies enable row level security;
alter table public.sources enable row level security;
alter table public.jobs enable row level security;
alter table public.job_skills enable row level security;
alter table public.job_matches enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.applications enable row level security;
alter table public.scan_logs enable row level security;

-- Policies
-- Profiles: Users manage their own profile
create policy "Users can view their own profile" on public.profiles
    for select using (auth.uid() = user_id);
create policy "Users can update their own profile" on public.profiles
    for update using (auth.uid() = user_id);
create policy "Users can insert their own profile" on public.profiles
    for insert with check (auth.uid() = user_id);

-- Skills: Profile owner only
create policy "Users can view skills for their profile" on public.skills
    for select using (exists (select 1 from public.profiles where profiles.id = skills.profile_id and profiles.user_id = auth.uid()));
create policy "Users can manage skills for their profile" on public.skills
    for all using (exists (select 1 from public.profiles where profiles.id = skills.profile_id and profiles.user_id = auth.uid()));

-- Companies & Sources & Jobs: Readable by authenticated users
create policy "Authenticated users can view companies" on public.companies
    for select to authenticated using (true);
create policy "Authenticated users can view sources" on public.sources
    for select to authenticated using (true);
create policy "Authenticated users can view jobs" on public.jobs
    for select to authenticated using (true);
create policy "Authenticated users can view job skills" on public.job_skills
    for select to authenticated using (true);

-- Job Matches: Profile owner only
create policy "Users can view matches for their profile" on public.job_matches
    for select using (exists (select 1 from public.profiles where profiles.id = job_matches.profile_id and profiles.user_id = auth.uid()));

-- Saved Jobs: User only
create policy "Users can manage saved jobs" on public.saved_jobs
    for all using (auth.uid() = user_id);

-- Applications: User only
create policy "Users can manage their applications" on public.applications
    for all using (auth.uid() = user_id);

-- Scan Logs: Authenticated view
create policy "Authenticated users can view scan logs" on public.scan_logs
    for select to authenticated using (true);
