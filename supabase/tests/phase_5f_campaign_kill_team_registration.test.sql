begin;

create extension if not exists pgtap;
set local search_path = public, extensions, pg_catalog;

grant usage on schema extensions to anon, authenticated, service_role;
grant execute on function extensions.has_table(name, name, text)
  to anon, authenticated, service_role;
grant execute on function extensions.is(anyelement, anyelement, text)
  to anon, authenticated, service_role;
grant execute on function extensions.ok(boolean, text)
  to anon, authenticated, service_role;
grant execute on function extensions.throws_ok(text, character, text, text)
  to anon, authenticated, service_role;
grant execute on function extensions.finish(boolean)
  to anon, authenticated, service_role;

select plan(15);

select has_table(
  'public',
  'campaign_kill_teams',
  'campaign-level Kill Teams have an authoritative table'
);

select has_table(
  'public',
  'campaign_kill_team_members',
  'campaign-level Kill Team membership has an authoritative table'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kill_teams'
      and column_name = 'campaign_kill_team_id'
  ),
  'mission Kill Teams can reference a campaign-level parent'
);

select is(
  (
    select c.relrowsecurity
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n
      on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'campaign_kill_teams'
  ),
  true,
  'campaign Kill Teams have RLS enabled'
);

select is(
  (
    select c.relrowsecurity
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n
      on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'campaign_kill_team_members'
  ),
  true,
  'campaign Kill Team members have RLS enabled'
);

insert into public.campaigns (id, name, status)
values
  (
    '12000000-0000-4000-8000-000000000001',
    'Phase 5F Campaign Alpha',
    'ACTIVE'
  ),
  (
    '12000000-0000-4000-8000-000000000002',
    'Phase 5F Campaign Beta',
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
    '22000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000101',
    'Phase 5F Alpha Mission One',
    'Campaign Kill Team registration fixture.',
    'Sandbox Hostiles'
  ),
  (
    '22000000-0000-4000-8000-000000000002',
    '12000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000101',
    'Phase 5F Alpha Mission Two',
    'Second campaign Kill Team registration fixture.',
    'Sandbox Hostiles'
  ),
  (
    '22000000-0000-4000-8000-000000000003',
    '12000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000101',
    'Phase 5F Beta Mission',
    'Foreign campaign Kill Team fixture.',
    'Sandbox Hostiles'
  );

insert into public.campaign_kill_teams (
  id,
  campaign_id,
  name,
  leader_discord_user_id
)
values
  (
    '32000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000001',
    'Blood Reavers',
    '920000000000000001'
  ),
  (
    '32000000-0000-4000-8000-000000000002',
    '12000000-0000-4000-8000-000000000001',
    'Crimson Talons',
    '920000000000000003'
  ),
  (
    '32000000-0000-4000-8000-000000000003',
    '12000000-0000-4000-8000-000000000002',
    'Foreign Kill Team',
    '920000000000000004'
  );

select is(
  (
    select count(*)::integer
    from public.campaign_kill_teams
    where campaign_id = '12000000-0000-4000-8000-000000000001'
  ),
  2,
  'multiple campaign Kill Teams can exist within one campaign'
);

insert into public.campaign_kill_team_members (
  campaign_kill_team_id,
  campaign_id,
  discord_user_id,
  display_name
)
values
  (
    '32000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000001',
    '920000000000000001',
    'Kill Team Leader'
  ),
  (
    '32000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000001',
    '920000000000000002',
    'Kill Team Member'
  );

select is(
  (
    select count(*)::integer
    from public.campaign_kill_team_members
    where campaign_kill_team_id =
      '32000000-0000-4000-8000-000000000001'
  ),
  2,
  'a campaign Kill Team can contain multiple Discord members'
);

select ok(
  exists (
    select 1
    from public.campaign_kill_team_members
    where campaign_kill_team_id =
      '32000000-0000-4000-8000-000000000001'
      and discord_user_id = '920000000000000001'
  ),
  'the Kill Team Leader can also exist as a registered team member'
);

select throws_ok(
  $$
    insert into public.campaign_kill_team_members (
      campaign_kill_team_id,
      campaign_id,
      discord_user_id,
      display_name
    )
    values (
      '32000000-0000-4000-8000-000000000002',
      '12000000-0000-4000-8000-000000000001',
      '920000000000000002',
      'Duplicate Campaign Member'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "campaign_kill_team_members_campaign_discord_unique"',
  'a Discord user cannot belong to two Kill Teams in the same campaign'
);

insert into public.campaign_kill_team_members (
  campaign_kill_team_id,
  campaign_id,
  discord_user_id,
  display_name
)
values (
  '32000000-0000-4000-8000-000000000003',
  '12000000-0000-4000-8000-000000000002',
  '920000000000000002',
  'Same User Different Campaign'
);

select is(
  (
    select count(*)::integer
    from public.campaign_kill_team_members
    where discord_user_id = '920000000000000002'
  ),
  2,
  'the same Discord user may participate in a different campaign'
);

insert into public.kill_teams (
  id,
  mission_id,
  name,
  campaign_kill_team_id
)
values (
  '42000000-0000-4000-8000-000000000001',
  '22000000-0000-4000-8000-000000000001',
  'Blood Reavers - Mission One',
  '32000000-0000-4000-8000-000000000001'
);

select is(
  (
    select campaign_kill_team_id
    from public.kill_teams
    where id = '42000000-0000-4000-8000-000000000001'
  ),
  '32000000-0000-4000-8000-000000000001'::uuid,
  'a mission Kill Team can link to its campaign-level parent'
);

insert into public.kill_teams (
  id,
  mission_id,
  name,
  campaign_kill_team_id
)
values (
  '42000000-0000-4000-8000-000000000002',
  '22000000-0000-4000-8000-000000000002',
  'Blood Reavers - Mission Two',
  '32000000-0000-4000-8000-000000000001'
);

select is(
  (
    select count(*)::integer
    from public.kill_teams
    where campaign_kill_team_id =
      '32000000-0000-4000-8000-000000000001'
  ),
  2,
  'one campaign Kill Team may have child records across multiple missions'
);

select throws_ok(
  $$
    insert into public.kill_teams (
      mission_id,
      name,
      campaign_kill_team_id
    )
    values (
      '22000000-0000-4000-8000-000000000003',
      'Invalid Foreign Campaign Team',
      '32000000-0000-4000-8000-000000000001'
    )
  $$,
  'P0001',
  'KILL_TEAM_CAMPAIGN_MISMATCH',
  'a mission Kill Team cannot reference a parent from another campaign'
);

select throws_ok(
  $$
    insert into public.kill_teams (
      mission_id,
      name,
      campaign_kill_team_id
    )
    values (
      '22000000-0000-4000-8000-000000000001',
      'Duplicate Mission Parent',
      '32000000-0000-4000-8000-000000000001'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "kill_teams_mission_campaign_team_unique"',
  'one campaign Kill Team cannot have duplicate child records in the same mission'
);

select throws_ok(
  $$
    insert into public.campaign_kill_teams (
      campaign_id,
      name,
      leader_discord_user_id
    )
    values (
      '12000000-0000-4000-8000-000000000001',
      'Invalid Leader Team',
      'not-a-discord-id'
    )
  $$,
  '23514',
  'new row for relation "campaign_kill_teams" violates check constraint "campaign_kill_teams_leader_discord_user_id_format"',
  'Kill Team Leader IDs must be valid Discord snowflakes'
);

select * from finish();

rollback;