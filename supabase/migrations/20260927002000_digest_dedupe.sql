-- JobScout AI: dedupe store for the database-free live digest
--
-- `notification_log` cannot serve the live digest: it requires a `jobs` row, and the live
-- digest deliberately never writes to `jobs` so that it works without a database. A scheduled
-- run still has to know what it already sent, so this table holds nothing but the stable
-- per-posting key produced by `jobKey()`.

create table if not exists public.digest_sent_items (
    item_key text primary key,
    channel text not null default 'telegram',
    sent_at timestamptz not null default now()
);

alter table public.digest_sent_items enable row level security;

-- The digest route uses the service role, which bypasses RLS. This policy only exists so the
-- table is readable from the authenticated app if it is ever surfaced in the UI.
create policy "Authenticated users can view digest dedupe" on public.digest_sent_items
    for select to authenticated using (true);

create index if not exists idx_digest_sent_items_sent_at
    on public.digest_sent_items(sent_at desc);

-- The scheduled route only ever asks "have I sent this key before", so channel is part of the
-- lookup path.
create index if not exists idx_digest_sent_items_channel_key
    on public.digest_sent_items(channel, item_key);
