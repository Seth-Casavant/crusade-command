begin;

create extension if not exists pgtap;
set local search_path = public, extensions, pg_catalog;

grant usage on schema extensions to anon, authenticated, service_role;
grant execute on function extensions.ok(boolean, text)
  to anon, authenticated, service_role;
grant execute on function extensions.is(anyelement, anyelement, text)
  to anon, authenticated, service_role;
grant execute on function extensions.throws_ok(text, character, text, text)
  to anon, authenticated, service_role;
grant execute on function extensions.finish(boolean)
  to anon, authenticated, service_role;

select plan(12);

select ok(
  to_regprocedure(
    'public.discord_register_campaign_kill_team(uuid,text,text,text)'
  ) is not null,
  'Discord Kill Team registration RPC exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.discord_register_campaign_kill_team(uuid,text,text,text)',
    'EXECUTE'
  ),
  'anonymous users cannot execute Kill Team registration'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.discord_register_campaign_kill_team(uuid,text,text,text)',
    'EXECUTE'
  ),
  'normal authenticated users cannot execute Discord Kill Team registration'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.discord_register_campaign_kill_team(uuid,text,text,text)',
    'EXECUTE'
  ),
  'service role can execute Discord Kill Team registration'
);

insert into public.campaigns (
  id,
  name,
  status
)
values (
  '13000000-0000-4000-8000-000000000001',
  'Discord Registration Test Campaign',
  'ACTIVE'
);

insert into public.missions (
  id,
  campaign_id,
  battlefield_id,
  name,
  description,
  enemy_faction
)
values
  (
    '23000000-0000-4000-8000-000000000001',
    '13000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000101',
    'Discord Registration Mission One',
    'Synthetic Discord registration fixture.',
    'Sandbox Hostiles'
  ),
  (
    '23000000-0000-4000-8000-000000000002',
    '13000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000101',
    'Discord Registration Mission Two',
    'Second synthetic Discord registration fixture.',
    'Sandbox Hostiles'
  );

create temporary table registration_result as
select *
from public.discord_register_campaign_kill_team(
  '13000000-0000-4000-8000-000000000001',
  'Blood Reavers',
  '930000000000000001',
  'Omnial'
);

select ok(
  (
    select campaign_kill_team_id is not null
    from registration_result
  ),
  'registration returns a campaign Kill Team ID'
);

select is(
  (
    select mission_team_count
    from registration_result
  ),
  2,
  'registration creates one mission Kill Team for each campaign mission'
);

select is(
  (
    select count(*)::integer
    from public.campaign_kill_teams
    where campaign_id =
      '13000000-0000-4000-8000-000000000001'
      and name = 'Blood Reavers'
      and leader_discord_user_id =
        '930000000000000001'
  ),
  1,
  'registration creates the campaign-level Kill Team and leader'
);

select is(
  (
    select count(*)::integer
    from public.campaign_kill_team_members
    where campaign_id =
      '13000000-0000-4000-8000-000000000001'
      and discord_user_id =
        '930000000000000001'
      and display_name = 'Omnial'
  ),
  1,
  'Kill Team Leader is also registered as the first team member'
);

select is(
  (
    select count(*)::integer
    from public.kill_teams
    where campaign_kill_team_id = (
      select campaign_kill_team_id
      from registration_result
    )
  ),
  2,
  'both mission Kill Teams link to the same campaign-level parent'
);

select is(
  (
    select count(*)::integer
    from public.kill_team_members
    where discord_user_id =
      '930000000000000001'
      and kill_team_id in (
        select id
        from public.kill_teams
        where campaign_kill_team_id = (
          select campaign_kill_team_id
          from registration_result
        )
      )
  ),
  2,
  'Kill Team Leader is provisioned into every mission-specific team'
);

select throws_ok(
  $$
    select *
    from public.discord_register_campaign_kill_team(
      '13000000-0000-4000-8000-000000000001',
      'blood reavers',
      '930000000000000002',
      'Duplicate Name User'
    )
  $$,
  'P0001',
  'KILL_TEAM_NAME_TAKEN',
  'Kill Team names are unique regardless of capitalization'
);

select throws_ok(
  $$
    select *
    from public.discord_register_campaign_kill_team(
      '13000000-0000-4000-8000-000000000001',
      'Crimson Talons',
      '930000000000000001',
      'Omnial'
    )
  $$,
  'P0001',
  'KILL_TEAM_MEMBER_ALREADY_REGISTERED',
  'one Discord user cannot register into a second Kill Team in the same campaign'
);

select * from finish();

rollback;