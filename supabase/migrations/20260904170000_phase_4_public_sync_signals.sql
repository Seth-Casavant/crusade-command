begin;

create table public.public_campaign_sync_signals (
  campaign_id uuid primary key references public.campaigns(id)
    on update restrict on delete restrict,
  revision bigint not null,
  update_id uuid not null unique references public.campaign_updates(id)
    on update restrict on delete restrict,
  is_active boolean not null,
  published_at timestamptz not null,
  constraint public_campaign_sync_signals_revision_positive check (
    revision >= 1
  )
);

comment on table public.public_campaign_sync_signals is
  'Minimal public Realtime notification metadata. Payloads are change signals only; clients refetch the complete public snapshot.';

alter table public.public_campaign_sync_signals enable row level security;

revoke all on table public.public_campaign_sync_signals
  from public, anon, authenticated;
grant select on table public.public_campaign_sync_signals
  to anon, authenticated;

create policy public_sync_signal_read
on public.public_campaign_sync_signals
for select
to anon, authenticated
using (true);

create or replace function private.publish_public_campaign_sync_signal()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_transition_status text;
  v_is_active boolean;
begin
  if new.change_type = 'MISSION_TRANSITION' then
    v_transition_status := new.new_values ->> 'mission_status';

    if v_transition_status = 'ACTIVE' then
      v_is_active := true;
    elsif v_transition_status in ('COMPLETE', 'ABORTED') then
      v_is_active := false;
    else
      return new;
    end if;
  elsif new.change_type = 'LIVE_STATE_UPDATE' then
    select exists (
      select 1
      from public.live_campaign_states as lcs
      join public.missions as m on m.id = lcs.current_mission_id
      where lcs.campaign_id = new.campaign_id
        and m.status = 'ACTIVE'
    ) into v_is_active;

    if not v_is_active then
      return new;
    end if;
  else
    return new;
  end if;

  insert into public.public_campaign_sync_signals (
    campaign_id,
    revision,
    update_id,
    is_active,
    published_at
  ) values (
    new.campaign_id,
    new.new_revision,
    new.id,
    v_is_active,
    new.occurred_at
  )
  on conflict (campaign_id) do update
  set revision = excluded.revision,
      update_id = excluded.update_id,
      is_active = excluded.is_active,
      published_at = excluded.published_at
  where excluded.revision > public_campaign_sync_signals.revision;

  return new;
end;
$$;

create trigger campaign_updates_publish_public_sync_signal
after insert on public.campaign_updates
for each row execute function private.publish_public_campaign_sync_signal();

revoke all on function private.publish_public_campaign_sync_signal()
  from public, anon, authenticated;

create or replace function public.get_public_latest_sync_signal()
returns table (
  campaign_id uuid,
  revision bigint,
  update_id uuid,
  is_active boolean,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    signal.campaign_id,
    signal.revision,
    signal.update_id,
    signal.is_active,
    signal.published_at
  from public.public_campaign_sync_signals as signal
  order by signal.published_at desc, signal.revision desc
  limit 1
$$;

create or replace function public.get_public_sync_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with active_campaigns as materialized (
    select *
    from public.get_public_active_campaign()
  ),
  latest_signal as materialized (
    select *
    from public.get_public_latest_sync_signal()
  )
  select jsonb_build_object(
    'active_campaign_count', (
      select count(*)
      from active_campaigns
    ),
    'campaign', (
      select to_jsonb(active_campaign)
      from active_campaigns as active_campaign
      limit 1
    ),
    'signal', (
      select to_jsonb(signal)
      from latest_signal as signal
    )
  )
$$;

revoke all on function public.get_public_latest_sync_signal()
  from public, anon, authenticated;
revoke all on function public.get_public_sync_snapshot()
  from public, anon, authenticated;

grant execute on function public.get_public_latest_sync_signal()
  to anon, authenticated;
grant execute on function public.get_public_sync_snapshot()
  to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'public_campaign_sync_signals'
  ) then
    alter publication supabase_realtime
      add table public.public_campaign_sync_signals;
  end if;
end;
$$;

commit;
