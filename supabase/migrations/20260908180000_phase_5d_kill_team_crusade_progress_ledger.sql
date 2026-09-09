begin;

create type public.kill_team_progress_event_type as enum (
  'TERMINUS_KILL',
  'OBJECTIVE',
  'MISSION_COMPLETION',
  'CORRECTION'
);

alter type public.campaign_update_type
  add value if not exists 'KILL_TEAM_PROGRESS';

create table public.kill_team_progress_ledger (
  id uuid primary key default extensions.gen_random_uuid(),
  campaign_id uuid not null,
  mission_id uuid not null,
  kill_team_id uuid not null,
  event_type public.kill_team_progress_event_type not null,
  point_delta integer not null,
  description text,
  scoring_target_key text,
  campaign_revision bigint not null,
  actor_id uuid not null references auth.users(id)
    on update restrict on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  constraint kill_team_progress_campaign_mission_fk foreign key (
    campaign_id,
    mission_id
  ) references public.missions(campaign_id, id)
    on update restrict on delete restrict,
  constraint kill_team_progress_team_mission_fk foreign key (
    kill_team_id,
    mission_id
  ) references public.kill_teams(id, mission_id)
    on update restrict on delete restrict,
  constraint kill_team_progress_scoring_target_fk foreign key (
    mission_id,
    scoring_target_key
  ) references public.mission_crusade_scoring_targets(mission_id, target_key)
    on update restrict on delete restrict,
  constraint kill_team_progress_delta_nonzero check (point_delta <> 0),
  constraint kill_team_progress_description_not_blank check (
    description is null or length(btrim(description)) > 0
  ),
  constraint kill_team_progress_revision_positive check (
    campaign_revision >= 1
  ),
  constraint kill_team_progress_target_event check (
    scoring_target_key is null or event_type = 'TERMINUS_KILL'
  )
);

create index kill_team_progress_ledger_team_created_idx
  on public.kill_team_progress_ledger(kill_team_id, created_at, id);
create index kill_team_progress_ledger_mission_idx
  on public.kill_team_progress_ledger(mission_id);
create index kill_team_progress_ledger_campaign_revision_idx
  on public.kill_team_progress_ledger(campaign_id, campaign_revision);

create or replace function public.prevent_kill_team_progress_ledger_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  raise exception using
    errcode = 'P0001',
    message = 'KILL_TEAM_PROGRESS_LEDGER_IMMUTABLE';
end;
$$;

create trigger kill_team_progress_ledger_immutable
before update or delete on public.kill_team_progress_ledger
for each row execute function public.prevent_kill_team_progress_ledger_mutation();

alter table public.kill_team_progress_ledger enable row level security;

revoke all on table public.kill_team_progress_ledger
  from public, anon, authenticated;
grant select on table public.kill_team_progress_ledger to authenticated;

create policy kill_team_progress_ledger_staff_read
on public.kill_team_progress_ledger
for select
to authenticated
using (
  (select public.current_app_role()) in ('ADMINISTRATOR', 'MODERATOR')
);

create or replace function private.record_kill_team_progress(
  p_kill_team_id uuid,
  p_event_type public.kill_team_progress_event_type,
  p_point_delta integer,
  p_expected_revision bigint,
  p_description text,
  p_scoring_target_key text,
  p_actor_id uuid
)
returns table (
  ledger_entry_id uuid,
  update_id uuid,
  new_revision bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, private
as $$
declare
  v_team public.kill_teams%rowtype;
  v_mission public.missions%rowtype;
  v_state public.live_campaign_states%rowtype;
  v_ledger_entry_id uuid := extensions.gen_random_uuid();
  v_update_id uuid := extensions.gen_random_uuid();
  v_new_revision bigint;
  v_description text := nullif(btrim(p_description), '');
  v_scoring_target_key text := nullif(btrim(p_scoring_target_key), '');
begin
  if p_point_delta = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_PROGRESS_DELTA_ZERO';
  end if;

  if p_description is not null and v_description is null then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_PROGRESS_DESCRIPTION_INVALID';
  end if;

  if p_scoring_target_key is not null and v_scoring_target_key is null then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_PROGRESS_TARGET_INVALID';
  end if;

  if v_scoring_target_key is not null and p_event_type <> 'TERMINUS_KILL' then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_PROGRESS_TARGET_EVENT_INVALID';
  end if;

  select team.*
  into v_team
  from public.kill_teams as team
  where team.id = p_kill_team_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'KILL_TEAM_NOT_FOUND';
  end if;

  select mission.*
  into v_mission
  from public.missions as mission
  where mission.id = v_team.mission_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MISSION_NOT_FOUND';
  end if;

  if v_mission.status <> 'ACTIVE' then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_PROGRESS_LOCKED';
  end if;

  select state.*
  into v_state
  from public.live_campaign_states as state
  where state.campaign_id = v_mission.campaign_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'LIVE_STATE_NOT_FOUND';
  end if;

  if v_state.revision <> p_expected_revision then
    raise exception using errcode = 'P0001', message = 'REVISION_CONFLICT';
  end if;

  if v_scoring_target_key is not null and not exists (
    select 1
    from public.mission_crusade_scoring_targets as target
    where target.mission_id = v_mission.id
      and target.target_key = v_scoring_target_key
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_PROGRESS_TARGET_NOT_FOUND_FOR_MISSION';
  end if;

  update public.live_campaign_states as state
  set revision = state.revision + 1,
      last_update_id = v_update_id,
      updated_by = p_actor_id
  where state.campaign_id = v_mission.campaign_id
    and state.revision = v_state.revision
  returning state.revision into v_new_revision;

  if not found then
    raise exception using errcode = 'P0001', message = 'REVISION_CONFLICT';
  end if;

  insert into public.campaign_updates (
    id,
    campaign_id,
    mission_id,
    previous_revision,
    new_revision,
    actor_id,
    change_type,
    old_values,
    new_values
  ) values (
    v_update_id,
    v_mission.campaign_id,
    v_mission.id,
    v_state.revision,
    v_new_revision,
    p_actor_id,
    'KILL_TEAM_PROGRESS',
    '{}'::jsonb,
    jsonb_strip_nulls(jsonb_build_object(
      'action', 'PROGRESS_RECORDED',
      'ledger_entry_id', v_ledger_entry_id,
      'kill_team_id', v_team.id,
      'event_type', p_event_type,
      'point_delta', p_point_delta,
      'description', v_description,
      'scoring_target_key', v_scoring_target_key
    ))
  );

  insert into public.kill_team_progress_ledger (
    id,
    campaign_id,
    mission_id,
    kill_team_id,
    event_type,
    point_delta,
    description,
    scoring_target_key,
    campaign_revision,
    actor_id
  ) values (
    v_ledger_entry_id,
    v_mission.campaign_id,
    v_mission.id,
    v_team.id,
    p_event_type,
    p_point_delta,
    v_description,
    v_scoring_target_key,
    v_new_revision,
    p_actor_id
  );

  return query select v_ledger_entry_id, v_update_id, v_new_revision;
end;
$$;

create or replace function public.record_kill_team_progress(
  p_kill_team_id uuid,
  p_event_type public.kill_team_progress_event_type,
  p_point_delta integer,
  p_expected_revision bigint,
  p_description text default null,
  p_scoring_target_key text default null,
  p_actor_id uuid default null
)
returns table (
  ledger_entry_id uuid,
  update_id uuid,
  new_revision bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor_id uuid;
begin
  perform private.require_authorized_writer();
  v_actor_id := private.authoritative_actor(p_actor_id);

  return query
  select command.ledger_entry_id, command.update_id, command.new_revision
  from private.record_kill_team_progress(
    p_kill_team_id,
    p_event_type,
    p_point_delta,
    p_expected_revision,
    p_description,
    p_scoring_target_key,
    v_actor_id
  ) as command;
end;
$$;

revoke all on function public.prevent_kill_team_progress_ledger_mutation()
  from public, anon, authenticated;
revoke all on function private.record_kill_team_progress(
  uuid,
  public.kill_team_progress_event_type,
  integer,
  bigint,
  text,
  text,
  uuid
) from public, anon, authenticated;
revoke all on function public.record_kill_team_progress(
  uuid,
  public.kill_team_progress_event_type,
  integer,
  bigint,
  text,
  text,
  uuid
) from public, anon, authenticated;

grant execute on function public.record_kill_team_progress(
  uuid,
  public.kill_team_progress_event_type,
  integer,
  bigint,
  text,
  text,
  uuid
) to authenticated;

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
  elsif new.change_type in (
    'LIVE_STATE_UPDATE',
    'KILL_TEAM_REGISTRATION',
    'KILL_TEAM_POSITION',
    'KILL_TEAM_OPERATIONAL_STATUS',
    'KILL_TEAM_PROGRESS'
  ) then
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

drop function public.get_public_sync_snapshot();
drop function public.get_public_active_campaign();

create function public.get_public_active_campaign()
returns table (
  campaign_id uuid,
  campaign_name text,
  campaign_description text,
  mission_id uuid,
  mission_name text,
  mission_description text,
  mission_status public.mission_status,
  battlefield_id uuid,
  battlefield_name text,
  battlefield_description text,
  enemy_faction text,
  campaign_progress smallint,
  crusade_points bigint,
  revision bigint,
  updated_at timestamptz,
  objectives jsonb,
  enemies jsonb,
  mission_boss jsonb,
  crusade_scoring_targets jsonb,
  battlefield_checkpoints jsonb,
  kill_teams jsonb
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    c.id,
    c.name,
    coalesce(c.description, ''),
    m.id,
    m.name,
    coalesce(m.description, ''),
    m.status,
    b.id,
    b.name,
    coalesce(b.description, ''),
    coalesce(m.enemy_faction, ''),
    lcs.campaign_progress,
    coalesce((
      select sum(entry.point_delta)
      from public.kill_team_progress_ledger as entry
      where entry.campaign_id = c.id
    ), 0),
    lcs.revision,
    lcs.updated_at,
    coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'title', o.title, 'description', o.description, 'status', o.status, 'sort_order', o.sort_order) order by o.sort_order, o.id) from public.objectives o where o.mission_id = m.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', mee.id, 'name', mee.name, 'enemy_type', mee.enemy_type, 'description', mee.description, 'sort_order', mee.sort_order) order by mee.sort_order, mee.id) from public.mission_enemy_entries mee where mee.mission_id = m.id), '[]'::jsonb),
    case when m.mission_boss_key is null then null::jsonb else jsonb_build_object('id', m.mission_boss_key, 'name', m.mission_boss_display_name, 'description', null) end,
    coalesce((select jsonb_agg(jsonb_build_object('id', target.target_key, 'name', target.display_name, 'description', null, 'sort_order', target.sort_order) order by target.sort_order, target.target_key) from public.mission_crusade_scoring_targets target where target.mission_id = m.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', checkpoint.id, 'key', checkpoint.checkpoint_key, 'name', checkpoint.name, 'x', checkpoint.normalized_x, 'y', checkpoint.normalized_y, 'sort_order', checkpoint.sort_order) order by checkpoint.sort_order, checkpoint.id) from public.mission_battlefield_checkpoints checkpoint where checkpoint.mission_id = m.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', team.id, 'name', team.name, 'current_checkpoint_id', team.current_checkpoint_id, 'operational_status', team.operational_status, 'crusade_points', coalesce((select sum(entry.point_delta) from public.kill_team_progress_ledger entry where entry.kill_team_id = team.id), 0), 'terminus_kills', (select count(*) from public.kill_team_progress_ledger entry where entry.kill_team_id = team.id and entry.event_type = 'TERMINUS_KILL'), 'objectives_completed', (select count(*) from public.kill_team_progress_ledger entry where entry.kill_team_id = team.id and entry.event_type = 'OBJECTIVE'), 'members', coalesce((select jsonb_agg(jsonb_build_object('display_name', member.display_name) order by member.display_name, member.id) from public.kill_team_members member where member.kill_team_id = team.id), '[]'::jsonb)) order by team.name, team.id) from public.kill_teams team where team.mission_id = m.id), '[]'::jsonb)
  from public.live_campaign_states lcs
  join public.campaigns c on c.id = lcs.campaign_id
  join public.missions m on m.id = lcs.current_mission_id
  join public.battlefields b on b.id = m.battlefield_id
  where c.status = 'ACTIVE'
    and m.status = 'ACTIVE'
  order by c.created_at, c.id
$$;

create function public.get_public_sync_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with active_campaigns as materialized (
    select * from public.get_public_active_campaign()
  ),
  latest_signal as materialized (
    select * from public.get_public_latest_sync_signal()
  )
  select jsonb_build_object(
    'active_campaign_count', (select count(*) from active_campaigns),
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

revoke all on function private.publish_public_campaign_sync_signal()
  from public, anon, authenticated;
revoke all on function public.get_public_active_campaign()
  from public, anon, authenticated;
revoke all on function public.get_public_sync_snapshot()
  from public, anon, authenticated;
grant execute on function public.get_public_active_campaign()
  to anon, authenticated;
grant execute on function public.get_public_sync_snapshot()
  to anon, authenticated;

commit;
