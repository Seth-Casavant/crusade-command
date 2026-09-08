begin;

create extension if not exists pgtap;
set local search_path = public, extensions, pg_catalog;

grant usage on schema extensions to anon, authenticated;
grant execute on function extensions.has_table(name, name, text) to anon, authenticated;
grant execute on function extensions.is(anyelement, anyelement, text) to anon, authenticated;
grant execute on function extensions.ok(boolean, text) to anon, authenticated;
grant execute on function extensions.throws_ok(text, character, text, text) to anon, authenticated;
grant execute on function extensions.finish(boolean) to anon, authenticated;

select plan(36);

select has_table('public', 'mission_battlefield_checkpoints', 'mission checkpoints have an authoritative table');
select is(
  (select c.relrowsecurity from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'mission_battlefield_checkpoints'),
  true,
  'mission checkpoints have RLS enabled'
);
select is((select count(*) from public.mission_battlefield_checkpoints where mission_id = '00000000-0000-4000-8000-000000000201'), 3::bigint, 'sandbox data provides three synthetic checkpoints');
select is((select count(*) from public.kill_teams where mission_id = '00000000-0000-4000-8000-000000000201' and current_checkpoint_id = '00000000-0000-4000-8000-000000000712'), 2::bigint, 'sandbox Alpha and Beta share a representative checkpoint');
select is(
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'kill_teams' and column_name in ('normalized_x', 'normalized_y')),
  0::bigint,
  'Kill Teams do not persist arbitrary coordinates'
);

insert into public.missions (id, campaign_id, battlefield_id, name, description, enemy_faction)
values ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'Checkpoint Test Mission', 'Transactional checkpoint fixture.', 'Sandbox Hostiles');
insert into public.objectives (mission_id, title, sort_order)
values ('00000000-0000-4000-8000-000000000801', 'Checkpoint test objective', 0);
insert into public.mission_enemy_entries (mission_id, name, sort_order)
values ('00000000-0000-4000-8000-000000000801', 'Checkpoint test enemy', 0);

select throws_ok(
  $$insert into public.mission_battlefield_checkpoints (mission_id, checkpoint_key, name, normalized_x, normalized_y, sort_order) values ('00000000-0000-4000-8000-000000000801', 'x-low', 'X low', -0.01, 0.5, 10)$$,
  '23514', 'new row for relation "mission_battlefield_checkpoints" violates check constraint "mission_battlefield_checkpoints_x_in_range"', 'x below zero is rejected'
);
select throws_ok(
  $$insert into public.mission_battlefield_checkpoints (mission_id, checkpoint_key, name, normalized_x, normalized_y, sort_order) values ('00000000-0000-4000-8000-000000000801', 'x-high', 'X high', 1.01, 0.5, 11)$$,
  '23514', 'new row for relation "mission_battlefield_checkpoints" violates check constraint "mission_battlefield_checkpoints_x_in_range"', 'x above one is rejected'
);
select throws_ok(
  $$insert into public.mission_battlefield_checkpoints (mission_id, checkpoint_key, name, normalized_x, normalized_y, sort_order) values ('00000000-0000-4000-8000-000000000801', 'y-low', 'Y low', 0.5, -0.01, 12)$$,
  '23514', 'new row for relation "mission_battlefield_checkpoints" violates check constraint "mission_battlefield_checkpoints_y_in_range"', 'y below zero is rejected'
);
select throws_ok(
  $$insert into public.mission_battlefield_checkpoints (mission_id, checkpoint_key, name, normalized_x, normalized_y, sort_order) values ('00000000-0000-4000-8000-000000000801', 'y-high', 'Y high', 0.5, 1.01, 13)$$,
  '23514', 'new row for relation "mission_battlefield_checkpoints" violates check constraint "mission_battlefield_checkpoints_y_in_range"', 'y above one is rejected'
);
select throws_ok(
  $$insert into public.mission_battlefield_checkpoints (mission_id, checkpoint_key, name, normalized_x, normalized_y, sort_order) values ('00000000-0000-4000-8000-000000000801', '  ', 'Blank key', 0.5, 0.5, 14)$$,
  '23514', 'new row for relation "mission_battlefield_checkpoints" violates check constraint "mission_battlefield_checkpoints_key_not_blank"', 'blank checkpoint keys are rejected'
);
select throws_ok(
  $$insert into public.mission_battlefield_checkpoints (mission_id, checkpoint_key, name, normalized_x, normalized_y, sort_order) values ('00000000-0000-4000-8000-000000000801', 'blank-name', '  ', 0.5, 0.5, 15)$$,
  '23514', 'new row for relation "mission_battlefield_checkpoints" violates check constraint "mission_battlefield_checkpoints_name_not_blank"', 'blank checkpoint names are rejected'
);

insert into public.mission_battlefield_checkpoints (id, mission_id, checkpoint_key, name, normalized_x, normalized_y, sort_order)
values ('00000000-0000-4000-8000-000000000811', '00000000-0000-4000-8000-000000000801', 'test-entry', 'Test Entry', 0.1, 0.2, 0);
insert into public.kill_teams (id, mission_id, name, current_checkpoint_id)
values ('00000000-0000-4000-8000-000000000821', '00000000-0000-4000-8000-000000000801', 'Abort Test Team', '00000000-0000-4000-8000-000000000811');

select throws_ok(
  $$insert into public.mission_battlefield_checkpoints (mission_id, checkpoint_key, name, normalized_x, normalized_y, sort_order) values ('00000000-0000-4000-8000-000000000801', 'test-entry', 'Duplicate key', 0.2, 0.3, 1)$$,
  '23505', 'duplicate key value violates unique constraint "mission_battlefield_checkpoints_mission_key_unique"', 'checkpoint keys are unique within a mission'
);

select set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'sub', 'a0000000-0000-4000-8000-000000000001')::text, true);
set local role authenticated;
select set_config('crusade.position_start_revision', (select revision::text from public.live_campaign_states where campaign_id = '00000000-0000-4000-8000-000000000001'), true);
select set_config(
  'crusade.checkpoint_create_result',
  (select jsonb_build_object('checkpoint_id', checkpoint_id, 'update_id', update_id, 'new_revision', new_revision)::text from public.create_mission_battlefield_checkpoint('00000000-0000-4000-8000-000000000801', current_setting('crusade.position_start_revision', true)::bigint, 'test-relay', 'Test Relay', 0.4, 0.5, 1)),
  true
);
select ok((current_setting('crusade.checkpoint_create_result', true)::jsonb ->> 'checkpoint_id') is not null, 'authorized staff can create checkpoints before activation');
select is((current_setting('crusade.checkpoint_create_result', true)::jsonb ->> 'new_revision')::bigint, current_setting('crusade.position_start_revision', true)::bigint + 1, 'checkpoint creation increments the campaign revision exactly once');
select is((select change_type::text from public.campaign_updates where id = (current_setting('crusade.checkpoint_create_result', true)::jsonb ->> 'update_id')::uuid), 'KILL_TEAM_POSITION', 'checkpoint creation writes the existing campaign audit log');

select set_config('crusade.checkpoint_revision', (select new_revision::text from public.update_mission_battlefield_checkpoint((current_setting('crusade.checkpoint_create_result', true)::jsonb ->> 'checkpoint_id')::uuid, (current_setting('crusade.checkpoint_create_result', true)::jsonb ->> 'new_revision')::bigint, 'Test Relay Updated', 0.45, 0.55, 1)), true);
select is((select name from public.mission_battlefield_checkpoints where id = (current_setting('crusade.checkpoint_create_result', true)::jsonb ->> 'checkpoint_id')::uuid), 'Test Relay Updated', 'authorized staff can update checkpoint presentation configuration before activation');

select set_config('crusade.temp_checkpoint', (select jsonb_build_object('checkpoint_id', checkpoint_id, 'new_revision', new_revision)::text from public.create_mission_battlefield_checkpoint('00000000-0000-4000-8000-000000000801', current_setting('crusade.checkpoint_revision', true)::bigint, 'temporary', 'Temporary', 0.6, 0.6, 2)), true);
select set_config('crusade.checkpoint_revision', (select new_revision::text from public.delete_mission_battlefield_checkpoint((current_setting('crusade.temp_checkpoint', true)::jsonb ->> 'checkpoint_id')::uuid, (current_setting('crusade.temp_checkpoint', true)::jsonb ->> 'new_revision')::bigint)), true);
select is((select count(*) from public.mission_battlefield_checkpoints where id = (current_setting('crusade.temp_checkpoint', true)::jsonb ->> 'checkpoint_id')::uuid), 0::bigint, 'authorized staff can delete checkpoint configuration before activation');

select throws_ok(
  $$select * from public.create_mission_battlefield_checkpoint('00000000-0000-4000-8000-000000000201', current_setting('crusade.checkpoint_revision', true)::bigint, 'active-new', 'Active New', 0.5, 0.5, 9)$$,
  'P0001', 'MISSION_CHECKPOINT_CONFIGURATION_LOCKED', 'checkpoint creation is rejected for ACTIVE missions'
);
select throws_ok(
  $$select * from public.update_mission_battlefield_checkpoint('00000000-0000-4000-8000-000000000711', current_setting('crusade.checkpoint_revision', true)::bigint, 'Active Edit', 0.2, 0.2, 0)$$,
  'P0001', 'MISSION_CHECKPOINT_CONFIGURATION_LOCKED', 'checkpoint edits are rejected for ACTIVE missions'
);
select throws_ok(
  $$select * from public.delete_mission_battlefield_checkpoint('00000000-0000-4000-8000-000000000711', current_setting('crusade.checkpoint_revision', true)::bigint)$$,
  'P0001', 'MISSION_CHECKPOINT_CONFIGURATION_LOCKED', 'checkpoint deletion is rejected for ACTIVE missions'
);
select throws_ok(
  $$select * from public.assign_kill_team_checkpoint('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000811', current_setting('crusade.checkpoint_revision', true)::bigint)$$,
  'P0001', 'KILL_TEAM_CHECKPOINT_NOT_FOUND_FOR_MISSION', 'cross-mission Kill Team checkpoint assignment is rejected'
);
select throws_ok(
  $$select * from public.assign_kill_team_checkpoint('00000000-0000-4000-8000-000000000501', '10000000-0000-4000-8000-000000000001', current_setting('crusade.checkpoint_revision', true)::bigint)$$,
  'P0001', 'KILL_TEAM_CHECKPOINT_NOT_FOUND_FOR_MISSION', 'assignment to a nonexistent checkpoint is rejected'
);

select set_config(
  'crusade.position_result',
  (select jsonb_build_object('update_id', update_id, 'new_revision', new_revision)::text from public.assign_kill_team_checkpoint('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000711', current_setting('crusade.checkpoint_revision', true)::bigint)),
  true
);
select is((current_setting('crusade.position_result', true)::jsonb ->> 'new_revision')::bigint, current_setting('crusade.checkpoint_revision', true)::bigint + 1, 'ACTIVE Kill Team movement increments the campaign revision exactly once');
select is((select current_checkpoint_id::text from public.kill_teams where id = '00000000-0000-4000-8000-000000000501'), '00000000-0000-4000-8000-000000000711', 'ACTIVE Kill Team movement persists one same-mission checkpoint reference');
select is((select change_type::text from public.campaign_updates where id = (current_setting('crusade.position_result', true)::jsonb ->> 'update_id')::uuid), 'KILL_TEAM_POSITION', 'position movement writes the existing campaign audit log');
select throws_ok(
  $$select * from public.assign_kill_team_checkpoint('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000711', current_setting('crusade.checkpoint_revision', true)::bigint)$$,
  'P0001', 'REVISION_CONFLICT', 'stale position revisions are rejected'
);
select throws_ok(
  $$select * from public.update_kill_team('00000000-0000-4000-8000-000000000501', (current_setting('crusade.position_result', true)::jsonb ->> 'new_revision')::bigint, 'Renamed During Active', '[{"discord_user_id":"900000000000000001","display_name":"Sandbox Alpha One"}]'::jsonb)$$,
  'P0001', 'KILL_TEAM_REGISTRATION_LOCKED', 'ACTIVE position movement does not weaken membership or name locking'
);

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is(public.get_public_sync_snapshot() -> 'campaign' -> 'battlefield_checkpoints' -> 0 ->> 'key', 'sandbox-deployment', 'the public snapshot exposes safe checkpoint presentation data');
select is(public.get_public_sync_snapshot() -> 'campaign' -> 'kill_teams' -> 0 ->> 'current_checkpoint_id', '00000000-0000-4000-8000-000000000711', 'the public snapshot exposes the current checkpoint relationship');
select ok(position('discord_user_id' in public.get_public_sync_snapshot()::text) = 0, 'the public snapshot excludes private Discord identities');
select throws_ok(
  $$select * from public.assign_kill_team_checkpoint('00000000-0000-4000-8000-000000000501', null, 1)$$,
  '42501', 'permission denied for function assign_kill_team_checkpoint', 'anonymous clients cannot invoke position commands'
);
select throws_ok('select count(*) from public.mission_battlefield_checkpoints', '42501', 'permission denied for table mission_battlefield_checkpoints', 'anonymous clients cannot read checkpoint configuration directly');

reset role;
select set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'sub', 'a0000000-0000-4000-8000-000000000003')::text, true);
set local role authenticated;
select throws_ok(
  $$select * from public.assign_kill_team_checkpoint('00000000-0000-4000-8000-000000000502', null, (current_setting('crusade.position_result', true)::jsonb ->> 'new_revision')::bigint)$$,
  'P0001', 'AUTHORIZATION_REQUIRED', 'authenticated Players cannot change Kill Team positions'
);

reset role;
select set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'sub', 'a0000000-0000-4000-8000-000000000001')::text, true);
set local role authenticated;
select set_config('crusade.clear_result', (select new_revision::text from public.assign_kill_team_checkpoint('00000000-0000-4000-8000-000000000502', null, (current_setting('crusade.position_result', true)::jsonb ->> 'new_revision')::bigint)), true);
select is((select current_checkpoint_id from public.kill_teams where id = '00000000-0000-4000-8000-000000000502'), null::uuid, 'authorized staff can clear an ACTIVE Kill Team checkpoint');
select set_config('crusade.final_revision', (select new_revision::text from public.transition_mission_state('00000000-0000-4000-8000-000000000201', current_setting('crusade.clear_result', true)::bigint, 'COMPLETE')), true);
select throws_ok(
  $$select * from public.assign_kill_team_checkpoint('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000712', current_setting('crusade.final_revision', true)::bigint)$$,
  'P0001', 'KILL_TEAM_POSITION_LOCKED', 'position updates are rejected for COMPLETE missions'
);

select set_config('crusade.final_revision', (select new_revision::text from public.transition_mission_state('00000000-0000-4000-8000-000000000801', current_setting('crusade.final_revision', true)::bigint, 'READY')), true);
select set_config('crusade.final_revision', (select new_revision::text from public.transition_mission_state('00000000-0000-4000-8000-000000000801', current_setting('crusade.final_revision', true)::bigint, 'ACTIVE')), true);
select set_config('crusade.final_revision', (select new_revision::text from public.transition_mission_state('00000000-0000-4000-8000-000000000801', current_setting('crusade.final_revision', true)::bigint, 'ABORTED')), true);
select throws_ok(
  $$select * from public.assign_kill_team_checkpoint('00000000-0000-4000-8000-000000000821', null, current_setting('crusade.final_revision', true)::bigint)$$,
  'P0001', 'KILL_TEAM_POSITION_LOCKED', 'position updates are rejected for ABORTED missions'
);

select * from finish();
rollback;
