begin;

create extension if not exists pgtap;
set local search_path = public, extensions, pg_catalog;

grant usage on schema extensions to anon, authenticated;
grant execute on function extensions.has_table(name, name, text)
  to anon, authenticated;
grant execute on function extensions.is(anyelement, anyelement, text)
  to anon, authenticated;
grant execute on function extensions.ok(boolean, text)
  to anon, authenticated;
grant execute on function extensions.throws_ok(text, character, text, text)
  to anon, authenticated;
grant execute on function extensions.finish(boolean)
  to anon, authenticated;

select plan(33);

select has_table(
  'public',
  'kill_teams',
  'Kill Teams have an authoritative mission-scoped table'
);

select has_table(
  'public',
  'kill_team_members',
  'Kill Team members have an authoritative normalized table'
);

select is(
  (
    select c.relrowsecurity
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'kill_teams'
  ),
  true,
  'Kill Teams have RLS enabled'
);

select is(
  (
    select c.relrowsecurity
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'kill_team_members'
  ),
  true,
  'Kill Team memberships have RLS enabled'
);

select is(
  (select count(*) from public.kill_teams),
  2::bigint,
  'sandbox data supplies two representative Kill Teams'
);

select is(
  (select count(*) from public.kill_team_members),
  4::bigint,
  'sandbox data supplies multiple Kill Team members'
);

insert into public.missions (
  id,
  campaign_id,
  battlefield_id,
  name,
  description,
  enemy_faction
) values
  (
    '00000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000101',
    'Kill Team Registration Test A',
    'Transactional pgTAP fixture.',
    'Sandbox Hostile Force'
  ),
  (
    '00000000-0000-4000-8000-000000000702',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000101',
    'Kill Team Registration Test B',
    'Transactional pgTAP fixture.',
    'Sandbox Hostile Force'
  ),
  (
    '00000000-0000-4000-8000-000000000703',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000101',
    'Kill Team Registration Test C',
    'Transactional pgTAP fixture.',
    'Sandbox Hostile Force'
  );

insert into public.objectives (mission_id, title, sort_order)
values (
  '00000000-0000-4000-8000-000000000701',
  'Kill Team test objective',
  0
);

insert into public.mission_enemy_entries (mission_id, name, sort_order)
values (
  '00000000-0000-4000-8000-000000000701',
  'Kill Team test enemy',
  0
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'role', 'authenticated',
    'sub', 'a0000000-0000-4000-8000-000000000001'
  )::text,
  true
);
set local role authenticated;

select set_config(
  'crusade.kill_team_a_result',
  (
    select jsonb_build_object(
      'kill_team_id', command.kill_team_id,
      'update_id', command.update_id,
      'new_revision', command.new_revision
    )::text
    from public.create_kill_team(
      '00000000-0000-4000-8000-000000000701',
      (
        select revision
        from public.live_campaign_states
        where campaign_id = '00000000-0000-4000-8000-000000000001'
      ),
      'Registration Test Team Alpha',
      '[
        {"discord_user_id":"910000000000000001","display_name":"Registration Alpha One"},
        {"discord_user_id":"910000000000000002","display_name":"Registration Alpha Two"}
      ]'::jsonb
    ) as command
  ),
  true
);

select ok(
  (current_setting('crusade.kill_team_a_result', true)::jsonb ->> 'kill_team_id') is not null,
  'an authorized Administrator can create a Kill Team before activation'
);

select is(
  (
    select mission_id::text
    from public.kill_teams
    where id = (current_setting('crusade.kill_team_a_result', true)::jsonb ->> 'kill_team_id')::uuid
  ),
  '00000000-0000-4000-8000-000000000701',
  'a Kill Team belongs to exactly its configured mission'
);

select is(
  (
    select count(*)
    from public.kill_team_members
    where kill_team_id = (current_setting('crusade.kill_team_a_result', true)::jsonb ->> 'kill_team_id')::uuid
  ),
  2::bigint,
  'an authorized Administrator can create multiple members atomically'
);

select is(
  (current_setting('crusade.kill_team_a_result', true)::jsonb ->> 'new_revision')::bigint,
  (
    select revision
    from public.live_campaign_states
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  'Kill Team creation advances the existing campaign revision exactly once'
);

select is(
  (
    select change_type::text
    from public.campaign_updates
    where id = (current_setting('crusade.kill_team_a_result', true)::jsonb ->> 'update_id')::uuid
  ),
  'KILL_TEAM_REGISTRATION',
  'Kill Team creation writes an append-only campaign audit record'
);

select is(
  (
    select actor_id::text
    from public.campaign_updates
    where id = (current_setting('crusade.kill_team_a_result', true)::jsonb ->> 'update_id')::uuid
  ),
  'a0000000-0000-4000-8000-000000000001',
  'Kill Team audit attribution uses the authenticated Administrator identity'
);

select throws_ok(
  $$
    select *
    from public.create_kill_team(
      '00000000-0000-4000-8000-000000000701',
      (current_setting('crusade.kill_team_a_result', true)::jsonb ->> 'new_revision')::bigint,
      '   ',
      '[{"discord_user_id":"910000000000000003","display_name":"Blank Team Member"}]'::jsonb
    )
  $$,
  'P0001',
  'KILL_TEAM_NAME_REQUIRED',
  'blank Kill Team names are rejected server-side'
);

select throws_ok(
  $$
    select *
    from public.create_kill_team(
      '00000000-0000-4000-8000-000000000701',
      (current_setting('crusade.kill_team_a_result', true)::jsonb ->> 'new_revision')::bigint,
      'Registration Test Team Alpha',
      '[{"discord_user_id":"910000000000000003","display_name":"Duplicate Team Name Member"}]'::jsonb
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "kill_teams_mission_name_unique"',
  'Kill Team names are unique within a mission'
);

select throws_ok(
  $$
    select *
    from public.create_kill_team(
      '00000000-0000-4000-8000-000000000701',
      (current_setting('crusade.kill_team_a_result', true)::jsonb ->> 'new_revision')::bigint,
      'Duplicate Payload Team',
      '[
        {"discord_user_id":"910000000000000004","display_name":"Duplicate One"},
        {"discord_user_id":"910000000000000004","display_name":"Duplicate Two"}
      ]'::jsonb
    )
  $$,
  'P0001',
  'KILL_TEAM_MEMBER_DUPLICATE',
  'duplicate membership in one Kill Team is rejected before mutation'
);

select throws_ok(
  $$
    select *
    from public.create_kill_team(
      '00000000-0000-4000-8000-000000000701',
      (current_setting('crusade.kill_team_a_result', true)::jsonb ->> 'new_revision')::bigint,
      'Second Team Same Mission',
      '[{"discord_user_id":"910000000000000001","display_name":"Registration Alpha One"}]'::jsonb
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "kill_team_members_mission_discord_user_unique"',
  'a Discord user cannot belong to two Kill Teams in one mission'
);

select set_config(
  'crusade.kill_team_b_result',
  (
    select jsonb_build_object(
      'kill_team_id', command.kill_team_id,
      'update_id', command.update_id,
      'new_revision', command.new_revision
    )::text
    from public.create_kill_team(
      '00000000-0000-4000-8000-000000000702',
      (current_setting('crusade.kill_team_a_result', true)::jsonb ->> 'new_revision')::bigint,
      'Registration Test Team Bravo',
      '[{"discord_user_id":"910000000000000001","display_name":"Registration Alpha One"}]'::jsonb
    ) as command
  ),
  true
);

select is(
  (
    select count(*)
    from public.kill_team_members
    where discord_user_id = '910000000000000001'
  ),
  2::bigint,
  'the same Discord user may join teams for different missions'
);

reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'role', 'authenticated',
    'sub', 'a0000000-0000-4000-8000-000000000002'
  )::text,
  true
);
set local role authenticated;

select set_config(
  'crusade.kill_team_c_result',
  (
    select jsonb_build_object(
      'kill_team_id', command.kill_team_id,
      'update_id', command.update_id,
      'new_revision', command.new_revision
    )::text
    from public.create_kill_team(
      '00000000-0000-4000-8000-000000000703',
      (current_setting('crusade.kill_team_b_result', true)::jsonb ->> 'new_revision')::bigint,
      'Registration Test Team Charlie',
      '[{"discord_user_id":"910000000000000005","display_name":"Registration Charlie One"}]'::jsonb
    ) as command
  ),
  true
);

select is(
  (
    select actor_id::text
    from public.campaign_updates
    where id = (current_setting('crusade.kill_team_c_result', true)::jsonb ->> 'update_id')::uuid
  ),
  'a0000000-0000-4000-8000-000000000002',
  'the Moderator retains authorized Kill Team registration access'
);

select is(
  (select count(*) from public.kill_teams),
  5::bigint,
  'authorized staff can read the authoritative Kill Team records'
);

select throws_ok(
  $$
    insert into public.kill_teams (mission_id, name)
    values ('00000000-0000-4000-8000-000000000703', 'Direct Staff Write')
  $$,
  '42501',
  'permission denied for table kill_teams',
  'staff have no direct Kill Team write bypass'
);

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select throws_ok(
  'select count(*) from public.kill_teams',
  '42501',
  'permission denied for table kill_teams',
  'anonymous clients cannot read Kill Teams directly'
);

select throws_ok(
  $$
    insert into public.kill_team_members (
      kill_team_id,
      mission_id,
      discord_user_id,
      display_name
    ) values (
      '00000000-0000-4000-8000-000000000501',
      '00000000-0000-4000-8000-000000000201',
      '910000000000000006',
      'Anonymous Write Attempt'
    )
  $$,
  '42501',
  'permission denied for table kill_team_members',
  'anonymous clients cannot write Kill Team membership'
);

select throws_ok(
  $$
    select *
    from public.create_kill_team(
      '00000000-0000-4000-8000-000000000702',
      (current_setting('crusade.kill_team_c_result', true)::jsonb ->> 'new_revision')::bigint,
      'Anonymous RPC Attempt',
      '[{"discord_user_id":"910000000000000007","display_name":"Anonymous Attempt"}]'::jsonb
    )
  $$,
  '42501',
  'permission denied for function create_kill_team',
  'anonymous clients cannot invoke Kill Team registration commands'
);

reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'role', 'authenticated',
    'sub', 'a0000000-0000-4000-8000-000000000003'
  )::text,
  true
);
set local role authenticated;

select throws_ok(
  $$
    select *
    from public.create_kill_team(
      '00000000-0000-4000-8000-000000000702',
      (current_setting('crusade.kill_team_c_result', true)::jsonb ->> 'new_revision')::bigint,
      'Player RPC Attempt',
      '[{"discord_user_id":"910000000000000008","display_name":"Player Attempt"}]'::jsonb
    )
  $$,
  'P0001',
  'AUTHORIZATION_REQUIRED',
  'authenticated Players cannot register Kill Teams'
);

reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'role', 'authenticated',
    'sub', 'a0000000-0000-4000-8000-000000000001'
  )::text,
  true
);
set local role authenticated;

select set_config(
  'crusade.kill_team_active_revision',
  (
    select new_revision::text
    from public.transition_mission_state(
      '00000000-0000-4000-8000-000000000201',
      (current_setting('crusade.kill_team_c_result', true)::jsonb ->> 'new_revision')::bigint,
      'COMPLETE'
    )
  ),
  true
);

select set_config(
  'crusade.kill_team_active_revision',
  (
    select new_revision::text
    from public.transition_mission_state(
      '00000000-0000-4000-8000-000000000701',
      current_setting('crusade.kill_team_active_revision', true)::bigint,
      'READY'
    )
  ),
  true
);

select set_config(
  'crusade.kill_team_active_revision',
  (
    select new_revision::text
    from public.transition_mission_state(
      '00000000-0000-4000-8000-000000000701',
      current_setting('crusade.kill_team_active_revision', true)::bigint,
      'ACTIVE'
    )
  ),
  true
);

select throws_ok(
  $$
    select *
    from public.create_kill_team(
      '00000000-0000-4000-8000-000000000701',
      current_setting('crusade.kill_team_active_revision', true)::bigint,
      'Post Activation Team',
      '[{"discord_user_id":"910000000000000009","display_name":"Post Activation Member"}]'::jsonb
    )
  $$,
  'P0001',
  'KILL_TEAM_REGISTRATION_LOCKED',
  'team creation is rejected once the mission is ACTIVE'
);

select throws_ok(
  $$
    select *
    from public.update_kill_team(
      (current_setting('crusade.kill_team_a_result', true)::jsonb ->> 'kill_team_id')::uuid,
      current_setting('crusade.kill_team_active_revision', true)::bigint,
      'Renamed After Activation',
      '[
        {"discord_user_id":"910000000000000001","display_name":"Registration Alpha One"},
        {"discord_user_id":"910000000000000002","display_name":"Registration Alpha Two"}
      ]'::jsonb
    )
  $$,
  'P0001',
  'KILL_TEAM_REGISTRATION_LOCKED',
  'team renaming is rejected once the mission is ACTIVE'
);

select throws_ok(
  $$
    select *
    from public.update_kill_team(
      (current_setting('crusade.kill_team_a_result', true)::jsonb ->> 'kill_team_id')::uuid,
      current_setting('crusade.kill_team_active_revision', true)::bigint,
      'Registration Test Team Alpha',
      '[{"discord_user_id":"910000000000000001","display_name":"Registration Alpha One"}]'::jsonb
    )
  $$,
  'P0001',
  'KILL_TEAM_REGISTRATION_LOCKED',
  'member removal is rejected once the mission is ACTIVE'
);

select throws_ok(
  $$
    select *
    from public.update_kill_team(
      (current_setting('crusade.kill_team_a_result', true)::jsonb ->> 'kill_team_id')::uuid,
      current_setting('crusade.kill_team_active_revision', true)::bigint,
      'Registration Test Team Alpha',
      '[
        {"discord_user_id":"910000000000000001","display_name":"Registration Alpha One"},
        {"discord_user_id":"910000000000000002","display_name":"Registration Alpha Two"},
        {"discord_user_id":"910000000000000010","display_name":"Registration Alpha Three"}
      ]'::jsonb
    )
  $$,
  'P0001',
  'KILL_TEAM_REGISTRATION_LOCKED',
  'member addition is rejected once the mission is ACTIVE'
);

select throws_ok(
  $$
    select *
    from public.delete_kill_team(
      (current_setting('crusade.kill_team_a_result', true)::jsonb ->> 'kill_team_id')::uuid,
      current_setting('crusade.kill_team_active_revision', true)::bigint
    )
  $$,
  'P0001',
  'KILL_TEAM_REGISTRATION_LOCKED',
  'team deletion is rejected once the mission is ACTIVE'
);

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is(
  public.get_public_sync_snapshot() -> 'campaign' -> 'kill_teams' -> 0 ->> 'name',
  'Registration Test Team Alpha',
  'the public snapshot exposes participating Kill Teams for the active mission'
);

select is(
  public.get_public_sync_snapshot() -> 'campaign' -> 'kill_teams' -> 0 -> 'members' -> 0 ->> 'display_name',
  'Registration Alpha One',
  'the public snapshot exposes presentation-safe Kill Team member names'
);

select ok(
  position(
    'discord_user_id' in public.get_public_sync_snapshot()::text
  ) = 0,
  'the public snapshot excludes private Discord user identities'
);

select is(
  public.get_public_sync_snapshot() -> 'campaign' ->> 'revision',
  public.get_public_sync_snapshot() -> 'signal' ->> 'revision',
  'Kill Team changes use the existing public revision and Realtime signal path'
);

select * from finish();
rollback;
