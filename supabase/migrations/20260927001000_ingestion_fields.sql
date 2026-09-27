-- JobScout AI: ingestion support fields
-- Adds the columns the ingestion pipeline needs, plus updated_at automation.

alter table public.jobs
    add column if not exists role_category text default 'other',
    add column if not exists dedupe_key text,
    add column if not exists content_hash text,
    add column if not exists last_seen_at timestamptz;

create index if not exists idx_jobs_role_category on public.jobs(role_category);
create index if not exists idx_jobs_dedupe_key on public.jobs(dedupe_key);
create index if not exists idx_jobs_last_seen_at on public.jobs(last_seen_at desc);
create index if not exists idx_jobs_company_posted on public.jobs(company_id, posted_at desc);

-- Lets the ingestion pipeline upsert one source row per company board.
create unique index if not exists uniq_sources_company_type_url
    on public.sources(company_id, source_type, source_url);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_companies_updated_at on public.companies;
create trigger trg_companies_updated_at
    before update on public.companies
    for each row execute function public.touch_updated_at();

drop trigger if exists trg_sources_updated_at on public.sources;
create trigger trg_sources_updated_at
    before update on public.sources
    for each row execute function public.touch_updated_at();

drop trigger if exists trg_jobs_updated_at on public.jobs;
create trigger trg_jobs_updated_at
    before update on public.jobs
    for each row execute function public.touch_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
    before update on public.profiles
    for each row execute function public.touch_updated_at();

-- 11. Notification Log (guarantees one notification per job per channel)
create table if not exists public.notification_log (
    id uuid primary key default gen_random_uuid(),
    channel text not null,
    job_id uuid references public.jobs(id) on delete cascade not null,
    match_score integer,
    telegram_message_id bigint,
    status text not null default 'sent',
    error text,
    sent_at timestamptz default now() not null,
    constraint unique_channel_job unique (channel, job_id)
);

alter table public.notification_log enable row level security;

create policy "Authenticated users can view notification log" on public.notification_log
    for select to authenticated using (true);

create index if not exists idx_notification_log_sent_at on public.notification_log(sent_at desc);

-- job_skills has no updated_at column, so it is intentionally left out above.
