begin;

create unique index campaign_kill_teams_campaign_name_ci_unique
  on public.campaign_kill_teams (
    campaign_id,
    lower(btrim(name))
  );

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

  if exists (
    select 1
    from public.missions as mission
    where mission.campaign_id = p_campaign_id
      and mission.status not in ('DRAFT', 'READY')
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_REGISTRATION_LOCKED';
  end if;

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
      and mission.status in ('DRAFT', 'READY')
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

revoke all on function public.discord_register_campaign_kill_team(
  uuid,
  text,
  text,
  text
)
from public, anon, authenticated, service_role;

grant execute on function public.discord_register_campaign_kill_team(
  uuid,
  text,
  text,
  text
)
to service_role;

comment on function public.discord_register_campaign_kill_team(
  uuid,
  text,
  text,
  text
) is
  'Service-role-only Discord registration path. Creates one campaign Kill Team, registers the invoking Discord user as Kill Team Leader, and provisions linked mission Kill Teams.';

commit;