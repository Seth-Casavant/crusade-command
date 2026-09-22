begin;

create or replace function public.discord_get_campaign_kill_team(
  p_campaign_id uuid,
  p_discord_user_id text
)
returns table (
  campaign_kill_team_id uuid,
  kill_team_name text,
  leader_discord_user_id text,
  requester_is_leader boolean,
  member_count integer,
  mission_team_count integer,
  members jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  if p_campaign_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'CAMPAIGN_REQUIRED';
  end if;

  if p_discord_user_id is null
     or btrim(p_discord_user_id) !~ '^[0-9]{17,20}$' then
    raise exception using
      errcode = 'P0001',
      message = 'DISCORD_USER_INVALID';
  end if;

  if not exists (
    select 1
    from public.campaigns as campaign
    where campaign.id = p_campaign_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'CAMPAIGN_NOT_FOUND';
  end if;

  return query
  select
    team.id,
    team.name,
    team.leader_discord_user_id,
    team.leader_discord_user_id = btrim(p_discord_user_id),
    count(member.id)::integer,
    (
      select count(*)::integer
      from public.kill_teams as mission_team
      where mission_team.campaign_kill_team_id = team.id
    ),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'discord_user_id', member.discord_user_id,
          'display_name', member.display_name,
          'is_leader',
            member.discord_user_id = team.leader_discord_user_id
        )
        order by
          (member.discord_user_id = team.leader_discord_user_id) desc,
          member.created_at,
          member.id
      ),
      '[]'::jsonb
    )
  from public.campaign_kill_team_members as requester
  join public.campaign_kill_teams as team
    on team.id = requester.campaign_kill_team_id
  join public.campaign_kill_team_members as member
    on member.campaign_kill_team_id = team.id
  where requester.campaign_id = p_campaign_id
    and requester.discord_user_id = btrim(p_discord_user_id)
  group by
    team.id,
    team.name,
    team.leader_discord_user_id;
end;
$$;

revoke all on function public.discord_get_campaign_kill_team(
  uuid,
  text
)
from public, anon, authenticated, service_role;

grant execute on function public.discord_get_campaign_kill_team(
  uuid,
  text
)
to service_role;

comment on function public.discord_get_campaign_kill_team(
  uuid,
  text
) is
  'Service-role-only Discord lookup for a users campaign Kill Team, roster, leadership status, and mission-team projection count.';

commit;