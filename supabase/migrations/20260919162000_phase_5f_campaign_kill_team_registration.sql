begin;

create table public.campaign_kill_teams (
  id uuid primary key default extensions.gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id)
    on update restrict on delete cascade,
  name text not null,
  leader_discord_user_id text not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),

  constraint campaign_kill_teams_name_not_blank check (
    length(btrim(name)) > 0
  ),

  constraint campaign_kill_teams_leader_discord_user_id_format check (
    leader_discord_user_id ~ '^[0-9]{17,20}$'
  ),

  constraint campaign_kill_teams_campaign_and_id_unique unique (
    campaign_id,
    id
  ),

  constraint campaign_kill_teams_campaign_name_unique unique (
    campaign_id,
    name
  )
);

create table public.campaign_kill_team_members (
  id uuid primary key default extensions.gen_random_uuid(),
  campaign_kill_team_id uuid not null,
  campaign_id uuid not null,
  discord_user_id text not null,
  display_name text not null,
  created_at timestamptz not null default statement_timestamp(),

  constraint campaign_kill_team_members_team_campaign_fk foreign key (
    campaign_kill_team_id,
    campaign_id
  )
    references public.campaign_kill_teams(id, campaign_id)
    on update restrict on delete cascade,

  constraint campaign_kill_team_members_discord_user_id_format check (
    discord_user_id ~ '^[0-9]{17,20}$'
  ),

  constraint campaign_kill_team_members_display_name_not_blank check (
    length(btrim(display_name)) > 0
  ),

  constraint campaign_kill_team_members_campaign_discord_unique unique (
    campaign_id,
    discord_user_id
  ),

  constraint campaign_kill_team_members_team_discord_unique unique (
    campaign_kill_team_id,
    discord_user_id
  )
);

create index campaign_kill_teams_campaign_id_idx
  on public.campaign_kill_teams(campaign_id);

create index campaign_kill_team_members_team_id_idx
  on public.campaign_kill_team_members(campaign_kill_team_id);

create trigger campaign_kill_teams_set_updated_at
before update on public.campaign_kill_teams
for each row execute function public.set_row_updated_at();

alter table public.kill_teams
  add column campaign_kill_team_id uuid
    references public.campaign_kill_teams(id)
    on update restrict
    on delete restrict;

create index kill_teams_campaign_kill_team_id_idx
  on public.kill_teams(campaign_kill_team_id);

create unique index kill_teams_mission_campaign_team_unique
  on public.kill_teams(
    mission_id,
    campaign_kill_team_id
  )
  where campaign_kill_team_id is not null;

create or replace function public.validate_kill_team_campaign_link()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_mission_campaign_id uuid;
  v_team_campaign_id uuid;
begin
  if new.campaign_kill_team_id is null then
    return new;
  end if;

  select mission.campaign_id
  into v_mission_campaign_id
  from public.missions as mission
  where mission.id = new.mission_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'MISSION_NOT_FOUND';
  end if;

  select team.campaign_id
  into v_team_campaign_id
  from public.campaign_kill_teams as team
  where team.id = new.campaign_kill_team_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'CAMPAIGN_KILL_TEAM_NOT_FOUND';
  end if;

  if v_mission_campaign_id <> v_team_campaign_id then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_CAMPAIGN_MISMATCH';
  end if;

  return new;
end;
$$;

create trigger kill_teams_validate_campaign_link
before insert or update of campaign_kill_team_id, mission_id
on public.kill_teams
for each row
execute function public.validate_kill_team_campaign_link();

alter table public.campaign_kill_teams enable row level security;
alter table public.campaign_kill_team_members enable row level security;

revoke all on table public.campaign_kill_teams
from public, anon, authenticated;

revoke all on table public.campaign_kill_team_members
from public, anon, authenticated;

grant select on table public.campaign_kill_teams
to authenticated;

grant select on table public.campaign_kill_team_members
to authenticated;

create policy campaign_kill_teams_staff_read
on public.campaign_kill_teams
for select
to authenticated
using (
  (select public.current_app_role()) in (
    'ADMINISTRATOR',
    'MODERATOR'
  )
);

create policy campaign_kill_team_members_staff_read
on public.campaign_kill_team_members
for select
to authenticated
using (
  (select public.current_app_role()) in (
    'ADMINISTRATOR',
    'MODERATOR'
  )
);

comment on table public.campaign_kill_teams is
  'Stable campaign-level Kill Team identities shared across mission-specific Kill Team records.';

comment on table public.campaign_kill_team_members is
  'Campaign-level Discord membership. A Discord user may belong to only one Kill Team per campaign.';

comment on column public.kill_teams.campaign_kill_team_id is
  'Optional parent campaign-level Kill Team identity for this mission-specific Kill Team.';

commit;