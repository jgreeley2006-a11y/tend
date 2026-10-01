-- Calendar feed: one private link per user so their meetups show up in Apple or Google Calendar.
-- The link carries a random token; the meetup-calendar function looks it up with the service role.
create table if not exists public.calendar_feeds (
  user_id     uuid primary key default auth.uid() references auth.users on delete cascade,
  token       text not null unique check (length(token) >= 32),
  created_at  timestamptz not null default now()
);
alter table public.calendar_feeds enable row level security;

drop policy if exists "own calendar feed" on public.calendar_feeds;
create policy "own calendar feed" on public.calendar_feeds
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.calendar_feeds to authenticated, service_role;
revoke all on public.calendar_feeds from anon;
