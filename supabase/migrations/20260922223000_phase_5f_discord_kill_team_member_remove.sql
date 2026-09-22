begin;

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

  if btrim(p_leader_discord_user_id) =
     btrim(p_member_discord_user_id) then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_LEADER_CANNOT_REMOVE_SELF';
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
    and team.leader_discord_user_id =
      btrim(p_leader_discord_user_id)
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
    and mission.status in ('DRAFT', 'READY');

  select count(*)::integer
  into v_projected_mission_count
  from public.kill_teams as team
  join public.missions as mission
    on mission.id = team.mission_id
  where team.campaign_kill_team_id = v_campaign_team_id
    and mission.campaign_id = p_campaign_id
    and mission.status in ('DRAFT', 'READY');

  if v_projected_mission_count <> v_expected_mission_count then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_MISSION_PROJECTION_MISMATCH';
  end if;

  delete from public.campaign_kill_team_members
  where campaign_kill_team_id = v_campaign_team_id
    and discord_user_id = btrim(p_member_discord_user_id);

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
      and mission.status in ('DRAFT', 'READY')
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
    v_processed_mission_count :=
      v_processed_mission_count + 1;
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

revoke all on function public.discord_remove_campaign_kill_team_member(
  uuid,
  text,
  text
)
from public, anon, authenticated, service_role;

grant execute on function public.discord_remove_campaign_kill_team_member(
  uuid,
  text,
  text
)
to service_role;

comment on function public.discord_remove_campaign_kill_team_member(
  uuid,
  text,
  text
) is
  'Service-role-only Discord roster path. Allows a Kill Team Leader to remove a non-leader member from the campaign roster and every linked mission roster before scoring begins.';

commit;