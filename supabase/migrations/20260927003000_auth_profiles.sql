-- Auth: per-user profiles
--
-- 1. One profile per auth user. Without this, `getProfile` uses maybeSingle() and a
--    duplicate row makes it error instead of returning the profile.
-- 2. Create the profile automatically when someone signs up, so accounts created
--    through the dashboard or the Admin API also get a profile.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Dedupe any existing duplicate user_id rows, keeping the oldest.
-- ---------------------------------------------------------------------------
delete from public.profiles a
      using public.profiles b
      where a.user_id = b.user_id
        and a.user_id is not null
        and a.id > b.id;

-- ---------------------------------------------------------------------------
-- 2. One profile per user.
-- ---------------------------------------------------------------------------
create unique index if not exists profiles_user_id_key
    on public.profiles (user_id)
    where user_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Auto-create a profile on signup.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
as $$
begin
    insert into public.profiles (user_id, name)
    values (
        new.id,
        coalesce(
            nullif(new.raw_user_meta_data ->> 'full_name', ''),
            nullif(new.raw_user_meta_data ->> 'name', ''),
            nullif(split_part(coalesce(new.email, ''), '@', 1), '')
        )
    )
    on conflict (user_id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4. Backfill a profile for any auth user that does not have one yet.
-- ---------------------------------------------------------------------------
insert into public.profiles (user_id, name)
select u.id,
       coalesce(
           nullif(u.raw_user_meta_data ->> 'full_name', ''),
           nullif(u.raw_user_meta_data ->> 'name', ''),
           nullif(split_part(coalesce(u.email, ''), '@', 1), '')
       )
from auth.users u
where not exists (
    select 1 from public.profiles p where p.user_id = u.id
);

-- ---------------------------------------------------------------------------
-- Report
-- ---------------------------------------------------------------------------
select u.email,
       p.id is not null as has_profile,
       p.name as profile_name
from auth.users u
left join public.profiles p on p.user_id = u.id
order by u.created_at;
