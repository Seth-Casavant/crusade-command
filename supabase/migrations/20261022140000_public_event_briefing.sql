-- Explicitly published copy, separate from private mission preparation and live state.
create table public.event_briefing (
  id boolean primary key default true check (id),
  published boolean not null default false,
  title text not null check (length(trim(title)) > 0),
  description text not null,
  targets text[] not null,
  modes text[] not null,
  rules text[] not null,
  updated_at timestamptz not null default now()
);
alter table public.event_briefing enable row level security;
revoke all on public.event_briefing from public, anon, authenticated;
grant select on public.event_briefing to anon, authenticated;
create policy "Read deliberately published event briefing"
  on public.event_briefing for select to anon, authenticated
  using (published);
comment on table public.event_briefing is
  'Public announcement copy only. No mission drafts, roster, evidence, or live scoring state.';
