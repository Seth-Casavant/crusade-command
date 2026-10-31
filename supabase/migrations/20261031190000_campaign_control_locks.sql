begin;

alter table public.campaigns
  add column registration_locked boolean not null default false,
  add column data_locked boolean not null default false;

create function private.require_campaign_registration_open(p_campaign_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  perform 1 from public.live_campaign_states where campaign_id = p_campaign_id for update;
  if not exists (select 1 from public.campaigns where id = p_campaign_id and not registration_locked and status <> 'COMPLETE') then
    raise exception 'KILL_TEAM_REGISTRATION_LOCKED';
  end if;
end;
$$;
revoke all on function private.require_campaign_registration_open(uuid) from public, anon, authenticated, service_role;


create or replace function public.discord_register_campaign_kill_team(
  p_campaign_id uuid,
  p_name text,
  p_leader_discord_user_id text,
  p_leader_display_name text
)
returns table (
  campaign_kill_team_id uuid,
  mission_team_count integer,
  new_revision bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, private
as $$
declare
  v_campaign_team_id uuid;
  v_child_team_id uuid;
  v_revision bigint;
  v_new_revision bigint;
  v_mission record;
  v_mission_count integer := 0;
  v_members jsonb;
begin
  if p_campaign_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'CAMPAIGN_REQUIRED';
  end if;

  if length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_NAME_REQUIRED';
  end if;

  if p_leader_discord_user_id is null
     or btrim(p_leader_discord_user_id) !~ '^[0-9]{17,20}$' then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_LEADER_DISCORD_USER_INVALID';
  end if;

  if length(btrim(coalesce(p_leader_display_name, ''))) = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_LEADER_DISPLAY_NAME_REQUIRED';
  end if;

  perform 1
  from public.campaigns as campaign
  where campaign.id = p_campaign_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'CAMPAIGN_NOT_FOUND';
  end if;

  perform private.require_campaign_registration_open(p_campaign_id);

  if not exists (
    select 1
    from public.missions as mission
    where mission.campaign_id = p_campaign_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'CAMPAIGN_MISSIONS_REQUIRED';
  end if;

  if exists (
    select 1
    from public.campaign_kill_teams as team
    where team.campaign_id = p_campaign_id
      and lower(btrim(team.name)) = lower(btrim(p_name))
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_NAME_TAKEN';
  end if;

  if exists (
    select 1
    from public.campaign_kill_team_members as member
    where member.campaign_id = p_campaign_id
      and member.discord_user_id = btrim(p_leader_discord_user_id)
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_MEMBER_ALREADY_REGISTERED';
  end if;

  select state.revision
  into v_revision
  from public.live_campaign_states as state
  where state.campaign_id = p_campaign_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'CAMPAIGN_STATE_NOT_FOUND';
  end if;

  insert into public.campaign_kill_teams (
    campaign_id,
    name,
    leader_discord_user_id
  )
  values (
    p_campaign_id,
    btrim(p_name),
    btrim(p_leader_discord_user_id)
  )
  returning id into v_campaign_team_id;

  insert into public.campaign_kill_team_members (
    campaign_kill_team_id,
    campaign_id,
    discord_user_id,
    display_name
  )
  values (
    v_campaign_team_id,
    p_campaign_id,
    btrim(p_leader_discord_user_id),
    btrim(p_leader_display_name)
  );

  v_members := jsonb_build_array(
    jsonb_build_object(
      'discord_user_id',
      btrim(p_leader_discord_user_id),
      'display_name',
      btrim(p_leader_display_name)
    )
  );

  for v_mission in
    select mission.id
    from public.missions as mission
    where mission.campaign_id = p_campaign_id
      and mission.status in ('DRAFT', 'READY', 'ACTIVE')
    order by mission.id
  loop
    select
      command.kill_team_id,
      command.new_revision
    into
      v_child_team_id,
      v_new_revision
    from private.create_kill_team(
      v_mission.id,
      v_revision,
      btrim(p_name),
      v_members,
      null
    ) as command;

    update public.kill_teams
    set campaign_kill_team_id = v_campaign_team_id
    where id = v_child_team_id;

    v_revision := v_new_revision;
    v_mission_count := v_mission_count + 1;
  end loop;

  return query
  select
    v_campaign_team_id,
    v_mission_count,
    v_revision;
end;
$$;

create or replace function public.discord_add_campaign_kill_team_member(
  p_campaign_id uuid,
  p_leader_discord_user_id text,
  p_member_discord_user_id text,
  p_member_display_name text
)
returns table (
  campaign_kill_team_id uuid,
  kill_team_name text,
  member_count integer,
  mission_team_count integer,
  new_revision bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, private
as $$
declare
  v_campaign_team_id uuid;
  v_team_name text;
  v_revision bigint;
  v_new_revision bigint;
  v_member_count integer;
  v_expected_mission_count integer;
  v_projected_mission_count integer;
  v_processed_mission_count integer := 0;
  v_members jsonb;
  v_child_team record;
begin
  if p_campaign_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'CAMPAIGN_REQUIRED';
  end if;

  if p_leader_discord_user_id is null
     or btrim(p_leader_discord_user_id) !~ '^[0-9]{17,20}$' then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_LEADER_DISCORD_USER_INVALID';
  end if;

  if p_member_discord_user_id is null
     or btrim(p_member_discord_user_id) !~ '^[0-9]{17,20}$' then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_MEMBER_DISCORD_USER_INVALID';
  end if;

  if length(btrim(coalesce(p_member_display_name, ''))) = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_MEMBER_DISPLAY_NAME_REQUIRED';
  end if;

  perform 1
  from public.campaigns as campaign
  where campaign.id = p_campaign_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'CAMPAIGN_NOT_FOUND';
  end if;

  perform private.require_campaign_registration_open(p_campaign_id);

  select state.revision
  into v_revision
  from public.live_campaign_states as state
  where state.campaign_id = p_campaign_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'CAMPAIGN_STATE_NOT_FOUND';
  end if;

  select
    team.id,
    team.name
  into
    v_campaign_team_id,
    v_team_name
  from public.campaign_kill_teams as team
  where team.campaign_id = p_campaign_id
    and team.leader_discord_user_id = btrim(p_leader_discord_user_id)
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_LEADER_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.campaign_kill_team_members as member
    where member.campaign_id = p_campaign_id
      and member.discord_user_id = btrim(p_member_discord_user_id)
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_MEMBER_ALREADY_REGISTERED';
  end if;

  select count(*)::integer
  into v_member_count
  from public.campaign_kill_team_members as member
  where member.campaign_kill_team_id = v_campaign_team_id;

  if v_member_count >= 4 then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_ROSTER_FULL';
  end if;

  select count(*)::integer
  into v_expected_mission_count
  from public.missions as mission
  where mission.campaign_id = p_campaign_id
    and mission.status in ('DRAFT', 'READY', 'ACTIVE');

  select count(*)::integer
  into v_projected_mission_count
  from public.kill_teams as team
  join public.missions as mission
    on mission.id = team.mission_id
  where team.campaign_kill_team_id = v_campaign_team_id
    and mission.campaign_id = p_campaign_id
    and mission.status in ('DRAFT', 'READY', 'ACTIVE');

  if v_projected_mission_count <> v_expected_mission_count then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_MISSION_PROJECTION_MISMATCH';
  end if;

  insert into public.campaign_kill_team_members (
    campaign_kill_team_id,
    campaign_id,
    discord_user_id,
    display_name
  )
  values (
    v_campaign_team_id,
    p_campaign_id,
    btrim(p_member_discord_user_id),
    btrim(p_member_display_name)
  );

  select jsonb_agg(
    jsonb_build_object(
      'discord_user_id',
      member.discord_user_id,
      'display_name',
      member.display_name
    )
    order by member.created_at, member.id
  )
  into v_members
  from public.campaign_kill_team_members as member
  where member.campaign_kill_team_id = v_campaign_team_id;

  for v_child_team in
    select team.id
    from public.kill_teams as team
    join public.missions as mission
      on mission.id = team.mission_id
    where team.campaign_kill_team_id = v_campaign_team_id
      and mission.campaign_id = p_campaign_id
      and mission.status in ('DRAFT', 'READY', 'ACTIVE')
    order by mission.id
  loop
    select command.new_revision
    into v_new_revision
    from private.update_kill_team(
      v_child_team.id,
      v_revision,
      v_team_name,
      v_members,
      null
    ) as command;

    v_revision := v_new_revision;
    v_processed_mission_count := v_processed_mission_count + 1;
  end loop;

  select count(*)::integer
  into v_member_count
  from public.campaign_kill_team_members as member
  where member.campaign_kill_team_id = v_campaign_team_id;

  return query
  select
    v_campaign_team_id,
    v_team_name,
    v_member_count,
    v_processed_mission_count,
    v_revision;
end;
$$;

create or replace function public.discord_remove_campaign_kill_team_member(
  p_campaign_id uuid,
  p_leader_discord_user_id text,
  p_member_discord_user_id text
)
returns table (
  campaign_kill_team_id uuid,
  kill_team_name text,
  member_count integer,
  mission_team_count integer,
  new_revision bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, private
as $$
declare
  v_campaign_team_id uuid;
  v_team_name text;
  v_old_leader text;
  v_next_leader text;
  v_is_self boolean;
  v_revision bigint;
  v_new_revision bigint;
  v_member_count integer;
  v_expected_mission_count integer;
  v_projected_mission_count integer;
  v_processed_mission_count integer := 0;
  v_members jsonb;
  v_child_team record;
begin
  if p_campaign_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'CAMPAIGN_REQUIRED';
  end if;

  if p_leader_discord_user_id is null
     or btrim(p_leader_discord_user_id) !~ '^[0-9]{17,20}$' then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_LEADER_DISCORD_USER_INVALID';
  end if;

  if p_member_discord_user_id is null
     or btrim(p_member_discord_user_id) !~ '^[0-9]{17,20}$' then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_MEMBER_DISCORD_USER_INVALID';
  end if;

  -- The existing parameter identifies the invoking Discord account, not a claimed role.
  v_is_self := btrim(p_leader_discord_user_id) = btrim(p_member_discord_user_id);

  perform 1
  from public.campaigns as campaign
  where campaign.id = p_campaign_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'CAMPAIGN_NOT_FOUND';
  end if;

  select state.revision
  into v_revision
  from public.live_campaign_states as state
  where state.campaign_id = p_campaign_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'CAMPAIGN_STATE_NOT_FOUND';
  end if;

  perform private.require_campaign_registration_open(p_campaign_id);

  select
    team.id,
    team.name,
    team.leader_discord_user_id
  into
    v_campaign_team_id,
    v_team_name,
    v_old_leader
  from public.campaign_kill_teams as team
  where team.campaign_id = p_campaign_id
    and (
      (not v_is_self and team.leader_discord_user_id = btrim(p_leader_discord_user_id))
      or (v_is_self and exists (
        select 1 from public.campaign_kill_team_members as caller
        where caller.campaign_kill_team_id = team.id
          and caller.discord_user_id = btrim(p_leader_discord_user_id)
      ))
    )
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_LEADER_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from public.campaign_kill_team_members as member
    where member.campaign_kill_team_id = v_campaign_team_id
      and member.discord_user_id =
        btrim(p_member_discord_user_id)
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_MEMBER_NOT_FOUND';
  end if;

  select count(*)::integer
  into v_expected_mission_count
  from public.missions as mission
  where mission.campaign_id = p_campaign_id
    and mission.status in ('DRAFT', 'READY', 'ACTIVE');

  select count(*)::integer
  into v_projected_mission_count
  from public.kill_teams as team
  join public.missions as mission
    on mission.id = team.mission_id
  where team.campaign_kill_team_id = v_campaign_team_id
    and mission.campaign_id = p_campaign_id
    and mission.status in ('DRAFT', 'READY', 'ACTIVE');

  if v_projected_mission_count <> v_expected_mission_count then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_MISSION_PROJECTION_MISMATCH';
  end if;

  delete from public.campaign_kill_team_members as departing
  where departing.campaign_kill_team_id = v_campaign_team_id
    and departing.discord_user_id = btrim(p_member_discord_user_id);

  select count(*)::integer into v_member_count
  from public.campaign_kill_team_members as member
  where member.campaign_kill_team_id = v_campaign_team_id;

  v_next_leader := v_old_leader;
  if v_is_self and v_old_leader = btrim(p_leader_discord_user_id) then
    select member.discord_user_id into v_next_leader
    from public.campaign_kill_team_members as member
    where member.campaign_kill_team_id = v_campaign_team_id
    order by member.created_at, member.id
    limit 1;
    if v_next_leader is not null then
      update public.campaign_kill_teams
      set leader_discord_user_id = v_next_leader
      where id = v_campaign_team_id;
    end if;
  end if;

  -- Record the actor's verified Discord identity and campaign-level leadership change.
  select command.new_revision into v_new_revision
  from private.record_kill_team_registration_update(
    p_campaign_id, null, v_revision, null,
    jsonb_build_object('action', 'DISCORD_MEMBER_REMOVED',
      'campaign_kill_team_id', v_campaign_team_id,
      'leader_discord_user_id', v_old_leader,
      'removed_discord_user_id', btrim(p_member_discord_user_id)),
    jsonb_build_object('action', case when v_member_count = 0 then 'EMPTY_TEAM_REMOVED' else 'DISCORD_MEMBER_REMOVED' end,
      'campaign_kill_team_id', v_campaign_team_id,
      'leader_discord_user_id', v_next_leader,
      'requesting_discord_user_id', btrim(p_leader_discord_user_id),
      'member_count', v_member_count)
  ) as command;
  v_revision := v_new_revision;

  select jsonb_agg(
    jsonb_build_object(
      'discord_user_id',
      member.discord_user_id,
      'display_name',
      member.display_name
    )
    order by member.created_at, member.id
  )
  into v_members
  from public.campaign_kill_team_members as member
  where member.campaign_kill_team_id = v_campaign_team_id;

  for v_child_team in
    select team.id
    from public.kill_teams as team
    join public.missions as mission
      on mission.id = team.mission_id
    where team.campaign_kill_team_id = v_campaign_team_id
      and mission.campaign_id = p_campaign_id
      and mission.status in ('DRAFT', 'READY', 'ACTIVE')
    order by mission.id
  loop
    if v_member_count = 0 then
      select command.new_revision into v_new_revision
      from private.delete_kill_team(v_child_team.id, v_revision, null) as command;
    else
      select command.new_revision into v_new_revision
      from private.update_kill_team(
        v_child_team.id, v_revision, v_team_name, v_members, null
      ) as command;
    end if;

    v_revision := v_new_revision;
    v_processed_mission_count :=
      v_processed_mission_count + 1;
  end loop;

  select count(*)::integer
  into v_member_count
  from public.campaign_kill_team_members as member
  where member.campaign_kill_team_id = v_campaign_team_id;

  if v_member_count = 0 then
    delete from public.campaign_kill_teams where id = v_campaign_team_id;
  end if;

  return query
  select
    v_campaign_team_id,
    v_team_name,
    v_member_count,
    v_processed_mission_count,
    v_revision;
end;
$$;

create or replace function private.lock_kill_team_registration(
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
    raise exception using
      errcode = 'P0001',
      message = 'MISSION_NOT_FOUND';
  end if;

  if v_mission.status not in ('DRAFT', 'READY', 'ACTIVE') then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_REGISTRATION_LOCKED';
  end if;

  perform private.require_campaign_registration_open(v_mission.campaign_id);

  select lcs.*
  into v_state
  from public.live_campaign_states as lcs
  where lcs.campaign_id = v_mission.campaign_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'LIVE_STATE_NOT_FOUND';
  end if;

  if v_state.revision <> p_expected_revision then
    raise exception using
      errcode = 'P0001',
      message = 'REVISION_CONFLICT';
  end if;

  return query select v_mission.campaign_id, v_state.revision;
end;
$$;

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

  if v_mission_status not in ('DRAFT', 'READY', 'ACTIVE') then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_REGISTRATION_LOCKED';
  end if;

  perform private.require_campaign_registration_open((select campaign_id from public.missions where id = v_mission_id));
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;


create function public.enforce_campaign_registration_toggle()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, private
as $$
begin
  if tg_op = 'UPDATE' and
     (to_jsonb(new) - array['chapter','updated_at']) = (to_jsonb(old) - array['chapter','updated_at']) then return new; end if;
  perform private.require_campaign_registration_open(case when tg_op = 'DELETE' then old.campaign_id else new.campaign_id end);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger campaign_teams_registration_toggle before insert or update or delete on public.campaign_kill_teams
for each row execute function public.enforce_campaign_registration_toggle();
create trigger campaign_members_registration_toggle before insert or update or delete on public.campaign_kill_team_members
for each row execute function public.enforce_campaign_registration_toggle();

create function public.get_campaign_controls(p_campaign_id uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, public, private
as $$
declare v_result jsonb;
begin
  perform private.require_authorized_writer();
  select jsonb_build_object('registration_locked',registration_locked,'data_locked',data_locked) into v_result
  from public.campaigns where id=p_campaign_id;
  if v_result is null then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
  return v_result;
end;
$$;

create function public.set_campaign_controls(p_campaign_id uuid, p_expected_revision bigint, p_registration_locked boolean, p_data_locked boolean)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_state public.live_campaign_states%rowtype;
  v_old jsonb;
  v_new jsonb;
  v_update uuid := extensions.gen_random_uuid();
  v_actor uuid;
begin
  perform private.require_administrator();
  if p_registration_locked is null or p_data_locked is null then raise exception 'CONTROL_VALUE_REQUIRED'; end if;
  select * into strict v_state from public.live_campaign_states where campaign_id=p_campaign_id for update;
  if v_state.revision <> p_expected_revision then raise exception 'REVISION_CONFLICT'; end if;
  v_old := public.get_campaign_controls(p_campaign_id);
  v_new := jsonb_build_object('registration_locked',p_registration_locked,'data_locked',p_data_locked);
  if v_old = v_new then return v_new; end if;
  v_actor := private.authoritative_actor(null);
  update public.campaigns set registration_locked=p_registration_locked, data_locked=p_data_locked where id=p_campaign_id;
  update public.live_campaign_states set revision=revision+1,last_update_id=v_update,updated_by=v_actor where campaign_id=p_campaign_id;
  insert into public.campaign_updates(id,campaign_id,mission_id,previous_revision,new_revision,actor_id,change_type,old_values,new_values)
  values(v_update,p_campaign_id,v_state.current_mission_id,v_state.revision,v_state.revision+1,v_actor,'LIVE_STATE_UPDATE',v_old,v_new || jsonb_build_object('action','SET_CAMPAIGN_CONTROLS'));
  return v_new;
end;
$$;
revoke all on function public.get_campaign_controls(uuid) from public, anon, authenticated, service_role;
revoke all on function public.set_campaign_controls(uuid,bigint,boolean,boolean) from public, anon, authenticated, service_role;
grant execute on function public.get_campaign_controls(uuid) to authenticated, service_role;
grant execute on function public.set_campaign_controls(uuid,bigint,boolean,boolean) to authenticated, service_role;

create function public.enforce_campaign_data_lock()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else null end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else null end;
  v_row jsonb := coalesce(v_new,v_old);
  v_campaign uuid;
  v_campaigns uuid[];
begin
  if tg_op='UPDATE' then
    if tg_table_name='campaigns' and
      (v_new - array['registration_locked','data_locked','updated_at']) = (v_old - array['registration_locked','data_locked','updated_at']) then return new; end if;
    if tg_table_name='objectives' and
      (v_new - array['status','updated_at']) = (v_old - array['status','updated_at']) then return new; end if;
    if (v_new - 'updated_at') = (v_old - 'updated_at') then return new; end if;
  end if;
  if tg_table_name='campaigns' then
    v_campaigns := array[(v_row->>'id')::uuid];
  elsif tg_table_name='missions' then
    v_campaigns := array[(v_new->>'campaign_id')::uuid,(v_old->>'campaign_id')::uuid];
  elsif tg_table_name='battlefields' then
    select array_agg(distinct campaign_id) into v_campaigns from public.missions where battlefield_id=(v_row->>'id')::uuid;
  elsif tg_table_name='event_briefing' then
    select array_agg(id) into v_campaigns from public.campaigns where status='ACTIVE';
  else
    select array_agg(distinct campaign_id) into v_campaigns from public.missions
    where id in ((v_new->>'mission_id')::uuid,(v_old->>'mission_id')::uuid);
  end if;
  for v_campaign in select distinct unnest(v_campaigns) order by 1 loop
    perform 1 from public.live_campaign_states where campaign_id=v_campaign for update;
    if exists(select 1 from public.campaigns where id=v_campaign and data_locked) then raise exception 'CAMPAIGN_DATA_LOCKED'; end if;
  end loop;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
create trigger campaigns_data_lock before update or delete on public.campaigns for each row execute function public.enforce_campaign_data_lock();
create trigger missions_data_lock before insert or update or delete on public.missions for each row execute function public.enforce_campaign_data_lock();
create trigger objectives_data_lock before insert or update or delete on public.objectives for each row execute function public.enforce_campaign_data_lock();
create trigger enemies_data_lock before insert or update or delete on public.mission_enemy_entries for each row execute function public.enforce_campaign_data_lock();
create trigger targets_data_lock before insert or update or delete on public.mission_crusade_scoring_targets for each row execute function public.enforce_campaign_data_lock();
create trigger checkpoints_data_lock before insert or update or delete on public.mission_battlefield_checkpoints for each row execute function public.enforce_campaign_data_lock();
create trigger battlefields_data_lock before update or delete on public.battlefields for each row execute function public.enforce_campaign_data_lock();
create trigger briefing_data_lock before insert or update or delete on public.event_briefing for each row execute function public.enforce_campaign_data_lock();

comment on column public.campaigns.registration_locked is 'Administrator-controlled registration gate; ACTIVE missions accept new teams and roster changes while false.';
comment on column public.campaigns.data_locked is 'Protects campaign and mission settings; evidence intake, review, objective progress, and score ledger remain available.';
create or replace function private.update_kill_team(
  p_kill_team_id uuid,
  p_expected_revision bigint,
  p_name text,
  p_members jsonb,
  p_actor_id uuid
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
  v_team public.kill_teams%rowtype;
  v_campaign_id uuid;
  v_previous_revision bigint;
  v_update_id uuid;
  v_new_revision bigint;
  v_old_members jsonb;
  v_new_members jsonb;
begin
  if length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_NAME_REQUIRED';
  end if;

  perform private.validate_kill_team_members(p_members);

  select team.*
  into v_team
  from public.kill_teams as team
  where team.id = p_kill_team_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_NOT_FOUND';
  end if;

  select lock.campaign_id, lock.previous_revision
  into v_campaign_id, v_previous_revision
  from private.lock_kill_team_registration(
    v_team.mission_id,
    p_expected_revision
  ) as lock;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', member.id,
        'discord_user_id', member.discord_user_id,
        'display_name', member.display_name
      ) order by member.discord_user_id, member.id
    ),
    '[]'::jsonb
  )
  into v_old_members
  from public.kill_team_members as member
  where member.kill_team_id = v_team.id;

  update public.kill_teams
  set name = p_name
  where id = v_team.id;

  if exists (
    select 1 from public.kill_team_members km join public.crusade_submissions cs
      on cs.kill_team_id=km.kill_team_id and cs.submitting_discord_user_id=km.discord_user_id
    where km.kill_team_id=v_team.id and not exists (
      select 1 from jsonb_to_recordset(p_members) as member(discord_user_id text,display_name text)
      where member.discord_user_id=km.discord_user_id
    )
  ) then raise exception 'KILL_TEAM_MEMBER_HAS_SUBMISSIONS'; end if;
  delete from public.kill_team_members km
  where km.kill_team_id=v_team.id and not exists (
    select 1 from jsonb_to_recordset(p_members) as member(discord_user_id text,display_name text)
    where member.discord_user_id=km.discord_user_id
  );
  update public.kill_team_members km set display_name=member.display_name
  from jsonb_to_recordset(p_members) as member(discord_user_id text,display_name text)
  where km.kill_team_id=v_team.id and km.discord_user_id=member.discord_user_id
    and km.display_name is distinct from member.display_name;

  insert into public.kill_team_members (
    kill_team_id,
    mission_id,
    discord_user_id,
    display_name
  )
  select
    v_team.id,
    v_team.mission_id,
    member.discord_user_id,
    member.display_name
  from jsonb_to_recordset(p_members) as member(
    discord_user_id text,
    display_name text
  ) where not exists (
    select 1 from public.kill_team_members km
    where km.kill_team_id=v_team.id and km.discord_user_id=member.discord_user_id
  );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', member.id,
        'discord_user_id', member.discord_user_id,
        'display_name', member.display_name
      ) order by member.discord_user_id, member.id
    ),
    '[]'::jsonb
  )
  into v_new_members
  from public.kill_team_members as member
  where member.kill_team_id = v_team.id;

  select record.update_id, record.new_revision
  into v_update_id, v_new_revision
  from private.record_kill_team_registration_update(
    v_campaign_id,
    v_team.mission_id,
    v_previous_revision,
    p_actor_id,
    jsonb_build_object(
      'action', 'UPDATED',
      'kill_team_id', v_team.id,
      'name', v_team.name,
      'members', v_old_members
    ),
    jsonb_build_object(
      'action', 'UPDATED',
      'kill_team_id', v_team.id,
      'name', p_name,
      'members', v_new_members
    )
  ) as record;

  return query select v_update_id, v_new_revision;
end;
$$;
commit;
