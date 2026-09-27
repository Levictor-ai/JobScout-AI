-- JobScout AI profile seed
--
-- Run this AFTER the migrations, once an auth user exists. The app resolves its single
-- viewer from this row until authentication is built, so without it every save, every
-- application, and every match has nowhere to go.
--
-- 1. Create the user in Supabase with your own password:
--      Authentication -> Users -> Add user
--    (or Authentication -> Sign In / Providers -> Email, then sign up once)
--
-- 2. Replace the email below with the one you just used, then run this file in the SQL
--    editor. It looks the user up by email, so no credentials and no fixed UUID are
--    committed to the repository.
--
--    Safe to run more than once: the guard below skips the insert if this auth user
--    already has a profile.
--
-- `user_id` is a foreign key without a unique index, so this uses an existence check
-- rather than ON CONFLICT, which would need a constraint that does not exist.

insert into public.profiles (
  user_id,
  name,
  headline,
  summary,
  years_experience,
  location,
  preferences
)
select
  u.id,
  'Your Name',
  'Product Designer',
  'Multidisciplinary designer across product, UI/UX and brand work, with a bias toward AI assisted product development and early stage MVPs.',
  5,
  'United Kingdom',
  '{
    "target_roles": [
      "Product Designer",
      "Senior Product Designer",
      "UI/UX Designer",
      "UX Designer",
      "Brand Designer",
      "Web Designer",
      "Design Engineer",
      "Product Engineer"
    ],
    "preferred_locations": ["Remote", "United Kingdom", "Europe", "Canada", "United States", "Nigeria"],
    "employment_types": ["Full-time", "Contract", "Freelance"],
    "remote_only": true,
    "min_match_score": 70,
    "notify_telegram": true
  }'::jsonb
from auth.users u
where u.email = 'replace-me@example.com'
  and not exists (select 1 from public.profiles p where p.user_id = u.id);

-- Confirm it worked. Expect exactly one row with a real user_id.
select p.id, p.user_id, u.email, p.name, p.updated_at
from public.profiles p
left join auth.users u on u.id = p.user_id;
