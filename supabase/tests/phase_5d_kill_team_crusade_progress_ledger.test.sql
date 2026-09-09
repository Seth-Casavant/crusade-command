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

select plan(42);

select has_table(
  'public',
  'kill_team_progress_ledger',
  'Kill Team Crusade progress has an authoritative ledger'
);

select is(
  enum_range(null::public.kill_team_progress_event_type)::text,
  '{TERMINUS_KILL,OBJECTIVE,MISSION_COMPLETION,CORRECTION}',
  'progress event type accepts only the approved values'
);

select is(
  (
    select c.relrowsecurity
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'kill_team_progress_ledger'
  ),
  true,
  'the progress ledger has RLS enabled'
);

select is(
  (select count(*) from public.kill_team_progress_ledger),
  3::bigint,
  'sandbox data provides three clearly synthetic progress entries'
);

select is(
  (
    select sum(point_delta)
    from public.kill_team_progress_ledger
    where kill_team_id = '00000000-0000-4000-8000-000000000501'
  ),
  20::bigint,
  'sandbox Alpha has a synthetic aggregate distinct from Beta'
);

select is(
  (
    select sum(point_delta)
    from public.kill_team_progress_ledger
    where kill_team_id = '00000000-0000-4000-8000-000000000502'
  ),
  4::bigint,
  'sandbox Beta has a second synthetic aggregate'
);

select is(
  (
    select crusade_points
    from public.get_public_active_campaign()
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  24::bigint,
  'the current sandbox campaign aggregate is 24 Crusade points'
);

select is(
  (
    select crusade_points
    from public.get_public_active_campaign()
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  (
    select sum(point_delta)
    from public.kill_team_progress_ledger
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  'campaign Crusade points equal the sum of all campaign ledger deltas'
);

select throws_ok(
  $$
    update public.kill_team_progress_ledger
    set point_delta = 99
    where id = '00000000-0000-4000-8000-000000000751'
  $$,
  'P0001',
  'KILL_TEAM_PROGRESS_LEDGER_IMMUTABLE',
  'historical progress entries cannot be edited'
);

select throws_ok(
  $$
    delete from public.kill_team_progress_ledger
    where id = '00000000-0000-4000-8000-000000000751'
  $$,
  'P0001',
  'KILL_TEAM_PROGRESS_LEDGER_IMMUTABLE',
  'historical progress entries cannot be deleted'
);

insert into public.campaigns (id, name, status)
values
  ('10000000-0000-4000-8000-000000000001', 'Progress Draft Campaign', 'ACTIVE'),
  ('10000000-0000-4000-8000-000000000002', 'Progress Ready Campaign', 'ACTIVE'),
  ('10000000-0000-4000-8000-000000000003', 'Progress Complete Campaign', 'ACTIVE'),
  ('10000000-0000-4000-8000-000000000004', 'Progress Abort Campaign', 'ACTIVE'),
  ('10000000-0000-4000-8000-000000000005', 'Progress Zero Campaign', 'ACTIVE');

insert into public.missions (
  id,
  campaign_id,
  battlefield_id,
  name,
  description,
  enemy_faction
) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'Progress Draft Mission', 'Synthetic DRAFT lifecycle fixture.', 'Sandbox Hostiles'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000101', 'Progress Ready Mission', 'Synthetic READY lifecycle fixture.', 'Sandbox Hostiles'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000101', 'Progress Complete Mission', 'Synthetic COMPLETE lifecycle fixture.', 'Sandbox Hostiles'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000101', 'Progress Abort Mission', 'Synthetic ABORTED lifecycle fixture.', 'Sandbox Hostiles'),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000101', 'Progress Zero Mission', 'Synthetic zero-state fixture.', 'Sandbox Hostiles');

insert into public.objectives (mission_id, title, sort_order)
select id, 'Progress test objective', 0
from public.missions
where id in (
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000005'
);

insert into public.mission_enemy_entries (mission_id, name, sort_order)
select id, 'Progress test enemy', 0
from public.missions
where id in (
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000005'
);

insert into public.kill_teams (id, mission_id, name)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Progress Draft Team'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Progress Ready Team'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 'Progress Complete Team'),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004', 'Progress Abort Team'),
  ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000005', 'Progress Zero Team');

insert into public.mission_crusade_scoring_targets (
  mission_id,
  target_key,
  display_name,
  sort_order
) values (
  '20000000-0000-4000-8000-000000000001',
  'foreign-progress-target',
  'Foreign Progress Target',
  0
);

select throws_ok(
  $$
    insert into public.kill_team_progress_ledger (
      campaign_id,
      mission_id,
      kill_team_id,
      event_type,
      point_delta,
      campaign_revision,
      actor_id
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000201',
      '00000000-0000-4000-8000-000000000501',
      'CORRECTION',
      1,
      3,
      'a0000000-0000-4000-8000-000000000001'
    )
  $$,
  '23503',
  'insert or update on table "kill_team_progress_ledger" violates foreign key constraint "kill_team_progress_campaign_mission_fk"',
  'ledger entries cannot claim a campaign different from their mission'
);

select throws_ok(
  $$
    insert into public.kill_team_progress_ledger (
      campaign_id,
      mission_id,
      kill_team_id,
      event_type,
      point_delta,
      campaign_revision,
      actor_id
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000501',
      'CORRECTION',
      1,
      1,
      'a0000000-0000-4000-8000-000000000001'
    )
  $$,
  '23503',
  'insert or update on table "kill_team_progress_ledger" violates foreign key constraint "kill_team_progress_team_mission_fk"',
  'ledger entries cannot reference a Kill Team from another mission'
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
  'crusade.ready_revision',
  (
    select new_revision::text
    from public.transition_mission_state(
      '20000000-0000-4000-8000-000000000002',
      1,
      'READY'
    )
  ),
  true
);

select set_config(
  'crusade.complete_revision',
  (
    select new_revision::text
    from public.transition_mission_state(
      '20000000-0000-4000-8000-000000000003',
      1,
      'READY'
    )
  ),
  true
);
select set_config(
  'crusade.complete_revision',
  (
    select new_revision::text
    from public.transition_mission_state(
      '20000000-0000-4000-8000-000000000003',
      current_setting('crusade.complete_revision', true)::bigint,
      'ACTIVE'
    )
  ),
  true
);
select set_config(
  'crusade.complete_revision',
  (
    select new_revision::text
    from public.transition_mission_state(
      '20000000-0000-4000-8000-000000000003',
      current_setting('crusade.complete_revision', true)::bigint,
      'COMPLETE'
    )
  ),
  true
);

select set_config(
  'crusade.abort_revision',
  (
    select new_revision::text
    from public.transition_mission_state(
      '20000000-0000-4000-8000-000000000004',
      1,
      'READY'
    )
  ),
  true
);
select set_config(
  'crusade.abort_revision',
  (
    select new_revision::text
    from public.transition_mission_state(
      '20000000-0000-4000-8000-000000000004',
      current_setting('crusade.abort_revision', true)::bigint,
      'ACTIVE'
    )
  ),
  true
);
select set_config(
  'crusade.abort_revision',
  (
    select new_revision::text
    from public.transition_mission_state(
      '20000000-0000-4000-8000-000000000004',
      current_setting('crusade.abort_revision', true)::bigint,
      'ABORTED'
    )
  ),
  true
);

select set_config(
  'crusade.zero_revision',
  (
    select new_revision::text
    from public.transition_mission_state(
      '20000000-0000-4000-8000-000000000005',
      1,
      'READY'
    )
  ),
  true
);
select set_config(
  'crusade.zero_revision',
  (
    select new_revision::text
    from public.transition_mission_state(
      '20000000-0000-4000-8000-000000000005',
      current_setting('crusade.zero_revision', true)::bigint,
      'ACTIVE'
    )
  ),
  true
);

select is(
  (
    select team.value ->> 'crusade_points'
    from public.get_public_active_campaign() as campaign
    cross join lateral jsonb_array_elements(campaign.kill_teams) as team(value)
    where campaign.campaign_id = '10000000-0000-4000-8000-000000000005'
      and team.value ->> 'id' = '30000000-0000-4000-8000-000000000005'
  ),
  '0',
  'a Kill Team with no ledger entries has zero public Crusade points'
);

select is(
  (
    select crusade_points
    from public.get_public_active_campaign()
    where campaign_id = '10000000-0000-4000-8000-000000000005'
  ),
  0::bigint,
  'an active campaign with no ledger entries has zero Crusade points'
);

select set_config(
  'crusade.zero_revision',
  (
    select new_revision::text
    from public.transition_mission_state(
      '20000000-0000-4000-8000-000000000005',
      current_setting('crusade.zero_revision', true)::bigint,
      'COMPLETE'
    )
  ),
  true
);

select throws_ok(
  $$
    select *
    from public.record_kill_team_progress(
      '30000000-0000-4000-8000-000000000001',
      'OBJECTIVE',
      1,
      1
    )
  $$,
  'P0001',
  'KILL_TEAM_PROGRESS_LOCKED',
  'DRAFT missions reject progress entries'
);

select throws_ok(
  $$
    select *
    from public.record_kill_team_progress(
      '30000000-0000-4000-8000-000000000002',
      'OBJECTIVE',
      1,
      current_setting('crusade.ready_revision', true)::bigint
    )
  $$,
  'P0001',
  'KILL_TEAM_PROGRESS_LOCKED',
  'READY missions reject progress entries'
);

select throws_ok(
  $$
    select *
    from public.record_kill_team_progress(
      '30000000-0000-4000-8000-000000000003',
      'MISSION_COMPLETION',
      1,
      current_setting('crusade.complete_revision', true)::bigint
    )
  $$,
  'P0001',
  'KILL_TEAM_PROGRESS_LOCKED',
  'COMPLETE missions reject progress entries'
);

select throws_ok(
  $$
    select *
    from public.record_kill_team_progress(
      '30000000-0000-4000-8000-000000000004',
      'CORRECTION',
      -1,
      current_setting('crusade.abort_revision', true)::bigint
    )
  $$,
  'P0001',
  'KILL_TEAM_PROGRESS_LOCKED',
  'ABORTED missions reject progress entries'
);

select set_config(
  'crusade.progress_start_revision',
  (
    select revision::text
    from public.live_campaign_states
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  true
);

select set_config(
  'crusade.admin_progress_result',
  (
    select jsonb_build_object(
      'ledger_entry_id', ledger_entry_id,
      'update_id', update_id,
      'new_revision', new_revision
    )::text
    from public.record_kill_team_progress(
      '00000000-0000-4000-8000-000000000501',
      'TERMINUS_KILL',
      3,
      current_setting('crusade.progress_start_revision', true)::bigint,
      'Synthetic Administrator progress test',
      'sandbox-terminus-target-alpha'
    )
  ),
  true
);

select ok(
  (current_setting('crusade.admin_progress_result', true)::jsonb ->> 'ledger_entry_id') is not null,
  'an Administrator can record progress during an ACTIVE mission'
);

select ok(
  exists (
    select 1
    from public.kill_team_progress_ledger
    where id = (
      current_setting('crusade.admin_progress_result', true)::jsonb
      ->> 'ledger_entry_id'
    )::uuid
      and campaign_id = '00000000-0000-4000-8000-000000000001'
      and mission_id = '00000000-0000-4000-8000-000000000201'
      and kill_team_id = '00000000-0000-4000-8000-000000000501'
      and scoring_target_key = 'sandbox-terminus-target-alpha'
      and actor_id = 'a0000000-0000-4000-8000-000000000001'
  ),
  'the authoritative entry derives campaign, mission, target, and actor context server-side'
);

select is(
  (current_setting('crusade.admin_progress_result', true)::jsonb ->> 'new_revision')::bigint,
  current_setting('crusade.progress_start_revision', true)::bigint + 1,
  'a successful progress entry increments the campaign revision exactly once'
);

select ok(
  exists (
    select 1
    from public.campaign_updates
    where id = (
      current_setting('crusade.admin_progress_result', true)::jsonb
      ->> 'update_id'
    )::uuid
      and change_type = 'KILL_TEAM_PROGRESS'
      and actor_id = 'a0000000-0000-4000-8000-000000000001'
      and new_values ->> 'action' = 'PROGRESS_RECORDED'
  ),
  'a successful progress entry appends the existing campaign audit log'
);

select is(
  (
    select revision
    from public.public_campaign_sync_signals
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  (current_setting('crusade.admin_progress_result', true)::jsonb ->> 'new_revision')::bigint,
  'progress publishes through the existing campaign synchronization signal'
);

select throws_ok(
  $$
    select *
    from public.record_kill_team_progress(
      '00000000-0000-4000-8000-000000000501',
      'OBJECTIVE',
      2,
      current_setting('crusade.progress_start_revision', true)::bigint
    )
  $$,
  'P0001',
  'REVISION_CONFLICT',
  'stale progress revisions are rejected'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'role', 'authenticated',
    'sub', 'a0000000-0000-4000-8000-000000000002'
  )::text,
  true
);

select set_config(
  'crusade.moderator_progress_result',
  (
    select jsonb_build_object(
      'ledger_entry_id', ledger_entry_id,
      'new_revision', new_revision
    )::text
    from public.record_kill_team_progress(
      '00000000-0000-4000-8000-000000000501',
      'OBJECTIVE',
      6,
      (current_setting('crusade.admin_progress_result', true)::jsonb ->> 'new_revision')::bigint,
      'Synthetic Moderator progress test'
    )
  ),
  true
);

select ok(
  exists (
    select 1
    from public.kill_team_progress_ledger
    where id = (
      current_setting('crusade.moderator_progress_result', true)::jsonb
      ->> 'ledger_entry_id'
    )::uuid
      and actor_id = 'a0000000-0000-4000-8000-000000000002'
  ),
  'a Moderator can record ACTIVE mission progress with authenticated attribution'
);

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select throws_ok(
  $$
    select *
    from public.record_kill_team_progress(
      '00000000-0000-4000-8000-000000000501',
      'OBJECTIVE',
      1,
      1
    )
  $$,
  '42501',
  'permission denied for function record_kill_team_progress',
  'anonymous clients cannot invoke progress commands'
);

select throws_ok(
  $$
    insert into public.kill_team_progress_ledger (
      campaign_id,
      mission_id,
      kill_team_id,
      event_type,
      point_delta,
      campaign_revision,
      actor_id
    ) values (
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000201',
      '00000000-0000-4000-8000-000000000501',
      'OBJECTIVE',
      1,
      1,
      'a0000000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  'permission denied for table kill_team_progress_ledger',
  'anonymous clients cannot insert ledger rows directly'
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
    from public.record_kill_team_progress(
      '00000000-0000-4000-8000-000000000501',
      'OBJECTIVE',
      1,
      (current_setting('crusade.moderator_progress_result', true)::jsonb ->> 'new_revision')::bigint
    )
  $$,
  'P0001',
  'AUTHORIZATION_REQUIRED',
  'authenticated Players cannot invoke progress commands'
);

select throws_ok(
  $$
    insert into public.kill_team_progress_ledger (
      campaign_id,
      mission_id,
      kill_team_id,
      event_type,
      point_delta,
      campaign_revision,
      actor_id
    ) values (
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000201',
      '00000000-0000-4000-8000-000000000501',
      'OBJECTIVE',
      1,
      1,
      'a0000000-0000-4000-8000-000000000003'
    )
  $$,
  '42501',
  'permission denied for table kill_team_progress_ledger',
  'authenticated Players cannot insert ledger rows directly'
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

select throws_ok(
  $$
    select *
    from public.record_kill_team_progress(
      '00000000-0000-4000-8000-000000000501',
      'INVALID',
      1,
      (current_setting('crusade.moderator_progress_result', true)::jsonb ->> 'new_revision')::bigint
    )
  $$,
  '22P02',
  'invalid input value for enum kill_team_progress_event_type: "INVALID"',
  'invalid progress event types are rejected by PostgreSQL'
);

select throws_ok(
  $$
    select *
    from public.record_kill_team_progress(
      '00000000-0000-4000-8000-000000000501',
      'OBJECTIVE',
      0,
      (current_setting('crusade.moderator_progress_result', true)::jsonb ->> 'new_revision')::bigint
    )
  $$,
  'P0001',
  'KILL_TEAM_PROGRESS_DELTA_ZERO',
  'zero-point progress entries are rejected'
);

select throws_ok(
  $$
    select *
    from public.record_kill_team_progress(
      '40000000-0000-4000-8000-000000000001',
      'OBJECTIVE',
      1,
      (current_setting('crusade.moderator_progress_result', true)::jsonb ->> 'new_revision')::bigint
    )
  $$,
  'P0001',
  'KILL_TEAM_NOT_FOUND',
  'invalid Kill Team identifiers are rejected'
);

select throws_ok(
  $$
    select *
    from public.record_kill_team_progress(
      '00000000-0000-4000-8000-000000000501',
      'TERMINUS_KILL',
      1,
      (current_setting('crusade.moderator_progress_result', true)::jsonb ->> 'new_revision')::bigint,
      null,
      'foreign-progress-target'
    )
  $$,
  'P0001',
  'KILL_TEAM_PROGRESS_TARGET_NOT_FOUND_FOR_MISSION',
  'cross-mission Crusade scoring targets are rejected'
);

select throws_ok(
  $$
    select *
    from public.record_kill_team_progress(
      '00000000-0000-4000-8000-000000000501',
      'OBJECTIVE',
      1,
      (current_setting('crusade.moderator_progress_result', true)::jsonb ->> 'new_revision')::bigint,
      null,
      'sandbox-terminus-target-alpha'
    )
  $$,
  'P0001',
  'KILL_TEAM_PROGRESS_TARGET_EVENT_INVALID',
  'a scoring target reference is accepted only for a TERMINUS_KILL entry'
);

select set_config(
  'crusade.correction_result',
  (
    select jsonb_build_object(
      'ledger_entry_id', ledger_entry_id,
      'new_revision', new_revision
    )::text
    from public.record_kill_team_progress(
      '00000000-0000-4000-8000-000000000501',
      'CORRECTION',
      -2,
      (current_setting('crusade.moderator_progress_result', true)::jsonb ->> 'new_revision')::bigint,
      'Synthetic compensating correction'
    )
  ),
  true
);

select ok(
  exists (
    select 1
    from public.kill_team_progress_ledger
    where id = (
      current_setting('crusade.correction_result', true)::jsonb
      ->> 'ledger_entry_id'
    )::uuid
      and event_type = 'CORRECTION'
      and point_delta = -2
  ),
  'a correction is appended as a compensating ledger entry'
);

select is(
  (
    select sum(point_delta)
    from public.kill_team_progress_ledger
    where kill_team_id = '00000000-0000-4000-8000-000000000501'
  ),
  27::bigint,
  'a compensating correction changes the derived total without rewriting history'
);

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is(
  public.get_public_sync_snapshot() -> 'campaign' ->> 'crusade_points',
  '31',
  'a correction naturally changes the authoritative campaign aggregate'
);

select is(
  (
    select team.value ->> 'crusade_points'
    from jsonb_array_elements(
      public.get_public_sync_snapshot() -> 'campaign' -> 'kill_teams'
    ) as team(value)
    where team.value ->> 'id' = '00000000-0000-4000-8000-000000000501'
  ),
  '27',
  'the public snapshot derives Crusade points from the ledger sum'
);

select is(
  (
    select team.value ->> 'terminus_kills'
    from jsonb_array_elements(
      public.get_public_sync_snapshot() -> 'campaign' -> 'kill_teams'
    ) as team(value)
    where team.value ->> 'id' = '00000000-0000-4000-8000-000000000501'
  ),
  '2',
  'the public snapshot counts TERMINUS_KILL entries'
);

select is(
  (
    select team.value ->> 'objectives_completed'
    from jsonb_array_elements(
      public.get_public_sync_snapshot() -> 'campaign' -> 'kill_teams'
    ) as team(value)
    where team.value ->> 'id' = '00000000-0000-4000-8000-000000000501'
  ),
  '2',
  'the public snapshot counts OBJECTIVE entries'
);

select is(
  (
    select team.value ->> 'crusade_points'
    from jsonb_array_elements(
      public.get_public_sync_snapshot() -> 'campaign' -> 'kill_teams'
    ) as team(value)
    where team.value ->> 'id' = '00000000-0000-4000-8000-000000000502'
  ),
  '4',
  'the public snapshot exposes the distinct Beta aggregate'
);

select ok(
  position('actor_id' in public.get_public_sync_snapshot()::text) = 0
    and position('point_delta' in public.get_public_sync_snapshot()::text) = 0
    and position('ledger_entry_id' in public.get_public_sync_snapshot()::text) = 0
    and position('TERMINUS_KILL' in public.get_public_sync_snapshot()::text) = 0,
  'the public snapshot excludes ledger, actor, audit, and mutation metadata'
);

select * from finish();
rollback;
