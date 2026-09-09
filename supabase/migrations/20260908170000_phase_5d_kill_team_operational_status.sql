begin;

create type public.kill_team_operational_status as enum (
  'STAGING',
  'DEPLOYED',
  'ADVANCING',
  'OBJECTIVE',
  'DELAYED',
  'COMPLETE',
  'WITHDRAWN'
);

alter type public.campaign_update_type
  add value if not exists 'KILL_TEAM_OPERATIONAL_STATUS';

alter table public.kill_teams
  add column operational_status public.kill_team_operational_status
    not null default 'STAGING';

create or replace function public.enforce_kill_team_registration_lock()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_mission_id uuid;
  v_mission_status public.mission_status;
  v_position_changed boolean := false;
  v_operational_status_changed boolean := false;
begin
  if tg_table_name = 'kill_teams' then
    if tg_op = 'UPDATE' and new.mission_id is distinct from old.mission_id then
      raise exception using
        errcode = 'P0001',
        message = 'KILL_TEAM_MISSION_IMMUTABLE';
    end if;

    if tg_op = 'INSERT' and new.operational_status <> 'STAGING' then
      raise exception using
        errcode = 'P0001',
        message = 'KILL_TEAM_OPERATIONAL_STATUS_MUST_START_STAGING';
    end if;

    v_position_changed := tg_op = 'UPDATE'
      and new.current_checkpoint_id is distinct from old.current_checkpoint_id;
    v_operational_status_changed := tg_op = 'UPDATE'
      and new.operational_status is distinct from old.operational_status;

    if v_position_changed then
      if current_setting('crusade.kill_team_position_write', true) is distinct from 'on'
         or v_operational_status_changed
         or new.name is distinct from old.name
         or new.id is distinct from old.id
         or new.created_at is distinct from old.created_at then
        raise exception using
          errcode = 'P0001',
          message = 'KILL_TEAM_POSITION_RPC_REQUIRED';
      end if;
    end if;

    if v_operational_status_changed then
      if current_setting('crusade.kill_team_operational_status_write', true)
           is distinct from 'on'
         or v_position_changed
         or new.name is distinct from old.name
         or new.id is distinct from old.id
         or new.created_at is distinct from old.created_at then
        raise exception using
          errcode = 'P0001',
          message = 'KILL_TEAM_OPERATIONAL_STATUS_RPC_REQUIRED';
      end if;
    end if;

    v_mission_id := case
      when tg_op = 'INSERT' then new.mission_id
      else old.mission_id
    end;
  else
    if tg_op = 'UPDATE' then
      if new.id is distinct from old.id then
        raise exception using
          errcode = 'P0001',
          message = 'KILL_TEAM_MEMBER_ID_IMMUTABLE';
      end if;

      if new.kill_team_id is distinct from old.kill_team_id
         or new.mission_id is distinct from old.mission_id then
        raise exception using
          errcode = 'P0001',
          message = 'KILL_TEAM_MEMBERSHIP_IMMUTABLE';
      end if;
    end if;

    v_mission_id := case
      when tg_op = 'INSERT' then new.mission_id
      else old.mission_id
    end;
  end if;

  select m.status
  into v_mission_status
  from public.missions as m
  where m.id = v_mission_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'MISSION_NOT_FOUND';
  end if;

  if v_position_changed then
    if v_mission_status in ('COMPLETE', 'ABORTED') then
      raise exception using
        errcode = 'P0001',
        message = 'KILL_TEAM_POSITION_LOCKED';
    end if;

    return new;
  end if;

  if v_operational_status_changed then
    if v_mission_status not in ('READY', 'ACTIVE') then
      raise exception using
        errcode = 'P0001',
        message = 'KILL_TEAM_OPERATIONAL_STATUS_LOCKED';
    end if;

    return new;
  end if;

  if v_mission_status not in ('DRAFT', 'READY') then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_REGISTRATION_LOCKED';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.lock_kill_team_operational_status(
  p_mission_id uuid,
  p_expected_revision bigint
)
returns table (
  campaign_id uuid,
  previous_revision bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_mission public.missions%rowtype;
  v_state public.live_campaign_states%rowtype;
begin
  select m.*
  into v_mission
  from public.missions as m
  where m.id = p_mission_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MISSION_NOT_FOUND';
  end if;

  if v_mission.status not in ('READY', 'ACTIVE') then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_OPERATIONAL_STATUS_LOCKED';
  end if;

  select lcs.*
  into v_state
  from public.live_campaign_states as lcs
  where lcs.campaign_id = v_mission.campaign_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'LIVE_STATE_NOT_FOUND';
  end if;

  if v_state.revision <> p_expected_revision then
    raise exception using errcode = 'P0001', message = 'REVISION_CONFLICT';
  end if;

  return query select v_mission.campaign_id, v_state.revision;
end;
$$;

create or replace function private.record_kill_team_operational_status_update(
  p_campaign_id uuid,
  p_mission_id uuid,
  p_previous_revision bigint,
  p_actor_id uuid,
  p_old_values jsonb,
  p_new_values jsonb
)
returns table (
  update_id uuid,
  new_revision bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, private
as $$
declare
  v_update_id uuid := extensions.gen_random_uuid();
  v_new_revision bigint;
begin
  update public.live_campaign_states as lcs
  set revision = lcs.revision + 1,
      last_update_id = v_update_id,
      updated_by = p_actor_id
  where lcs.campaign_id = p_campaign_id
    and lcs.revision = p_previous_revision
  returning lcs.revision into v_new_revision;

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
    p_campaign_id,
    p_mission_id,
    p_previous_revision,
    v_new_revision,
    p_actor_id,
    'KILL_TEAM_OPERATIONAL_STATUS',
    p_old_values,
    p_new_values
  );

  return query select v_update_id, v_new_revision;
end;
$$;

create or replace function private.update_kill_team_operational_status(
  p_kill_team_id uuid,
  p_operational_status public.kill_team_operational_status,
  p_expected_revision bigint,
  p_actor_id uuid
)
returns table (
  update_id uuid,
  new_revision bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_team public.kill_teams%rowtype;
  v_campaign_id uuid;
  v_previous_revision bigint;
  v_update_id uuid;
  v_new_revision bigint;
  v_previous_write_context text := coalesce(
    current_setting('crusade.kill_team_operational_status_write', true),
    'off'
  );
begin
  select team.*
  into v_team
  from public.kill_teams as team
  where team.id = p_kill_team_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'KILL_TEAM_NOT_FOUND';
  end if;

  select lock.campaign_id, lock.previous_revision
  into v_campaign_id, v_previous_revision
  from private.lock_kill_team_operational_status(
    v_team.mission_id,
    p_expected_revision
  ) as lock;

  if v_team.operational_status = p_operational_status then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_OPERATIONAL_STATUS_UNCHANGED';
  end if;

  perform set_config(
    'crusade.kill_team_operational_status_write',
    'on',
    true
  );

  update public.kill_teams
  set operational_status = p_operational_status
  where id = v_team.id;

  perform set_config(
    'crusade.kill_team_operational_status_write',
    v_previous_write_context,
    true
  );

  select record.update_id, record.new_revision
  into v_update_id, v_new_revision
  from private.record_kill_team_operational_status_update(
    v_campaign_id,
    v_team.mission_id,
    v_previous_revision,
    p_actor_id,
    jsonb_build_object(
      'action', 'OPERATIONAL_STATUS_UPDATED',
      'kill_team_id', v_team.id,
      'operational_status', v_team.operational_status
    ),
    jsonb_build_object(
      'action', 'OPERATIONAL_STATUS_UPDATED',
      'kill_team_id', v_team.id,
      'operational_status', p_operational_status
    )
  ) as record;

  return query select v_update_id, v_new_revision;
end;
$$;

create or replace function public.update_kill_team_operational_status(
  p_kill_team_id uuid,
  p_operational_status public.kill_team_operational_status,
  p_expected_revision bigint,
  p_actor_id uuid default null
)
returns table (
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
  select command.update_id, command.new_revision
  from private.update_kill_team_operational_status(
    p_kill_team_id,
    p_operational_status,
    p_expected_revision,
    v_actor_id
  ) as command;
end;
$$;

revoke all on function public.enforce_kill_team_registration_lock()
  from public, anon, authenticated;
revoke all on function private.lock_kill_team_operational_status(uuid, bigint)
  from public, anon, authenticated;
revoke all on function private.record_kill_team_operational_status_update(
  uuid,
  uuid,
  bigint,
  uuid,
  jsonb,
  jsonb
) from public, anon, authenticated;
revoke all on function private.update_kill_team_operational_status(
  uuid,
  public.kill_team_operational_status,
  bigint,
  uuid
) from public, anon, authenticated;
revoke all on function public.update_kill_team_operational_status(
  uuid,
  public.kill_team_operational_status,
  bigint,
  uuid
) from public, anon, authenticated;

grant execute on function public.update_kill_team_operational_status(
  uuid,
  public.kill_team_operational_status,
  bigint,
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
    'KILL_TEAM_OPERATIONAL_STATUS'
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

create or replace function public.get_public_active_campaign()
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
    lcs.revision,
    lcs.updated_at,
    coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'title', o.title, 'description', o.description, 'status', o.status, 'sort_order', o.sort_order) order by o.sort_order, o.id) from public.objectives o where o.mission_id = m.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', mee.id, 'name', mee.name, 'enemy_type', mee.enemy_type, 'description', mee.description, 'sort_order', mee.sort_order) order by mee.sort_order, mee.id) from public.mission_enemy_entries mee where mee.mission_id = m.id), '[]'::jsonb),
    case when m.mission_boss_key is null then null::jsonb else jsonb_build_object('id', m.mission_boss_key, 'name', m.mission_boss_display_name, 'description', null) end,
    coalesce((select jsonb_agg(jsonb_build_object('id', target.target_key, 'name', target.display_name, 'description', null, 'sort_order', target.sort_order) order by target.sort_order, target.target_key) from public.mission_crusade_scoring_targets target where target.mission_id = m.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', checkpoint.id, 'key', checkpoint.checkpoint_key, 'name', checkpoint.name, 'x', checkpoint.normalized_x, 'y', checkpoint.normalized_y, 'sort_order', checkpoint.sort_order) order by checkpoint.sort_order, checkpoint.id) from public.mission_battlefield_checkpoints checkpoint where checkpoint.mission_id = m.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', team.id, 'name', team.name, 'current_checkpoint_id', team.current_checkpoint_id, 'operational_status', team.operational_status, 'members', coalesce((select jsonb_agg(jsonb_build_object('display_name', member.display_name) order by member.display_name, member.id) from public.kill_team_members member where member.kill_team_id = team.id), '[]'::jsonb)) order by team.name, team.id) from public.kill_teams team where team.mission_id = m.id), '[]'::jsonb)
  from public.live_campaign_states lcs
  join public.campaigns c on c.id = lcs.campaign_id
  join public.missions m on m.id = lcs.current_mission_id
  join public.battlefields b on b.id = m.battlefield_id
  where c.status = 'ACTIVE'
    and m.status = 'ACTIVE'
  order by c.created_at, c.id
$$;

revoke all on function private.publish_public_campaign_sync_signal()
  from public, anon, authenticated;
revoke all on function public.get_public_active_campaign()
  from public, anon, authenticated;
grant execute on function public.get_public_active_campaign()
  to anon, authenticated;

commit;
