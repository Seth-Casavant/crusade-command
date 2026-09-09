begin;

create extension if not exists pgtap;
set local search_path = public, extensions, pg_catalog;

grant usage on schema extensions to anon, authenticated;
grant execute on function extensions.is(anyelement, anyelement, text)
  to anon, authenticated;
grant execute on function extensions.ok(boolean, text)
  to anon, authenticated;
grant execute on function extensions.throws_ok(text, character, text, text)
  to anon, authenticated;
grant execute on function extensions.finish(boolean)
  to anon, authenticated;

select plan(23);

select is(
  enum_range(null::public.kill_team_operational_status)::text,
  '{STAGING,DEPLOYED,ADVANCING,OBJECTIVE,DELAYED,COMPLETE,WITHDRAWN}',
  'operational status accepts only the approved values'
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
    '00000000-0000-4000-8000-000000000901',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000101',
    'Operational Status Test Mission',
    'Transactional operational-status fixture.',
    'Sandbox Hostiles'
  ),
  (
    '00000000-0000-4000-8000-000000000902',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000101',
    'Operational Status Abort Mission',
    'Transactional aborted-status fixture.',
    'Sandbox Hostiles'
  );

insert into public.objectives (mission_id, title, sort_order)
values
  ('00000000-0000-4000-8000-000000000901', 'Status test objective', 0),
  ('00000000-0000-4000-8000-000000000902', 'Abort test objective', 0);

insert into public.mission_enemy_entries (mission_id, name, sort_order)
values
  ('00000000-0000-4000-8000-000000000901', 'Status test enemy', 0),
  ('00000000-0000-4000-8000-000000000902', 'Abort test enemy', 0);

insert into public.kill_teams (id, mission_id, name)
values
  (
    '00000000-0000-4000-8000-000000000911',
    '00000000-0000-4000-8000-000000000901',
    'Operational Status Test Team'
  ),
  (
    '00000000-0000-4000-8000-000000000912',
    '00000000-0000-4000-8000-000000000902',
    'Operational Status Abort Team'
  );

select is(
  (
    select operational_status::text
    from public.kill_teams
    where id = '00000000-0000-4000-8000-000000000911'
  ),
  'STAGING',
  'new Kill Teams default to STAGING'
);

select is(
  (
    select operational_status::text
    from public.kill_teams
    where id = '00000000-0000-4000-8000-000000000501'
  ),
  'ADVANCING',
  'sandbox Alpha has a useful synthetic ADVANCING status'
);

select is(
  (
    select operational_status::text
    from public.kill_teams
    where id = '00000000-0000-4000-8000-000000000502'
  ),
  'DEPLOYED',
  'sandbox Beta has a useful synthetic DEPLOYED status'
);

select throws_ok(
  $$
    insert into public.kill_teams (
      mission_id,
      name,
      operational_status
    ) values (
      '00000000-0000-4000-8000-000000000901',
      'Invalid Starting Status Team',
      'DEPLOYED'
    )
  $$,
  'P0001',
  'KILL_TEAM_OPERATIONAL_STATUS_MUST_START_STAGING',
  'DRAFT Kill Teams cannot be created with a non-STAGING status'
);

select throws_ok(
  $$
    select *
    from public.update_kill_team_operational_status(
      '00000000-0000-4000-8000-000000000911',
      'INVALID',
      1
    )
  $$,
  '22P02',
  'invalid input value for enum kill_team_operational_status: "INVALID"',
  'invalid operational status values are rejected by PostgreSQL'
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
  'crusade.status_revision',
  (
    select revision::text
    from public.live_campaign_states
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  true
);

select throws_ok(
  $$
    select *
    from public.update_kill_team_operational_status(
      '00000000-0000-4000-8000-000000000911',
      'DEPLOYED',
      current_setting('crusade.status_revision', true)::bigint
    )
  $$,
  'P0001',
  'KILL_TEAM_OPERATIONAL_STATUS_LOCKED',
  'operational status mutation is rejected in DRAFT'
);

select set_config(
  'crusade.status_revision',
  (
    select new_revision::text
    from public.transition_mission_state(
      '00000000-0000-4000-8000-000000000901',
      current_setting('crusade.status_revision', true)::bigint,
      'READY'
    )
  ),
  true
);

select set_config(
  'crusade.admin_status_result',
  (
    select jsonb_build_object(
      'update_id', update_id,
      'new_revision', new_revision
    )::text
    from public.update_kill_team_operational_status(
      '00000000-0000-4000-8000-000000000911',
      'DEPLOYED',
      current_setting('crusade.status_revision', true)::bigint
    )
  ),
  true
);

select is(
  (
    select operational_status::text
    from public.kill_teams
    where id = '00000000-0000-4000-8000-000000000911'
  ),
  'DEPLOYED',
  'Administrator may update operational status in READY'
);

select is(
  (current_setting('crusade.admin_status_result', true)::jsonb ->> 'new_revision')::bigint,
  current_setting('crusade.status_revision', true)::bigint + 1,
  'successful status mutation increments the campaign revision exactly once'
);

select is(
  (
    select change_type::text
    from public.campaign_updates
    where id = (
      current_setting('crusade.admin_status_result', true)::jsonb
      ->> 'update_id'
    )::uuid
  ),
  'KILL_TEAM_OPERATIONAL_STATUS',
  'successful status mutation writes the existing audit log'
);

select is(
  (
    select new_values ->> 'action'
    from public.campaign_updates
    where id = (
      current_setting('crusade.admin_status_result', true)::jsonb
      ->> 'update_id'
    )::uuid
  ),
  'OPERATIONAL_STATUS_UPDATED',
  'the audit entry uses the operational-status action'
);

select throws_ok(
  $$
    select *
    from public.update_kill_team_operational_status(
      '10000000-0000-4000-8000-000000000001',
      'ADVANCING',
      (current_setting('crusade.admin_status_result', true)::jsonb ->> 'new_revision')::bigint
    )
  $$,
  'P0001',
  'KILL_TEAM_NOT_FOUND',
  'invalid Kill Team identifiers are rejected'
);

select throws_ok(
  $$
    select *
    from public.update_kill_team_operational_status(
      '00000000-0000-4000-8000-000000000911',
      'ADVANCING',
      current_setting('crusade.status_revision', true)::bigint
    )
  $$,
  'P0001',
  'REVISION_CONFLICT',
  'stale expected revisions are rejected'
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
  'crusade.moderator_status_result',
  (
    select jsonb_build_object(
      'update_id', update_id,
      'new_revision', new_revision
    )::text
    from public.update_kill_team_operational_status(
      '00000000-0000-4000-8000-000000000911',
      'ADVANCING',
      (current_setting('crusade.admin_status_result', true)::jsonb ->> 'new_revision')::bigint
    )
  ),
  true
);

select is(
  (
    select operational_status::text
    from public.kill_teams
    where id = '00000000-0000-4000-8000-000000000911'
  ),
  'ADVANCING',
  'Moderator may update operational status in READY'
);

select is(
  (
    select actor_id::text
    from public.campaign_updates
    where id = (
      current_setting('crusade.moderator_status_result', true)::jsonb
      ->> 'update_id'
    )::uuid
  ),
  'a0000000-0000-4000-8000-000000000002',
  'Moderator status updates retain authenticated audit attribution'
);

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select throws_ok(
  $$
    select *
    from public.update_kill_team_operational_status(
      '00000000-0000-4000-8000-000000000911',
      'OBJECTIVE',
      1
    )
  $$,
  '42501',
  'permission denied for function update_kill_team_operational_status',
  'anonymous clients cannot invoke operational-status commands'
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
    from public.update_kill_team_operational_status(
      '00000000-0000-4000-8000-000000000911',
      'OBJECTIVE',
      (current_setting('crusade.moderator_status_result', true)::jsonb ->> 'new_revision')::bigint
    )
  $$,
  'P0001',
  'AUTHORIZATION_REQUIRED',
  'authenticated Players cannot update operational status'
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
  'crusade.active_status_revision',
  (
    select new_revision::text
    from public.transition_mission_state(
      '00000000-0000-4000-8000-000000000201',
      (current_setting('crusade.moderator_status_result', true)::jsonb ->> 'new_revision')::bigint,
      'COMPLETE'
    )
  ),
  true
);
select set_config(
  'crusade.active_status_revision',
  (
    select new_revision::text
    from public.transition_mission_state(
      '00000000-0000-4000-8000-000000000901',
      current_setting('crusade.active_status_revision', true)::bigint,
      'ACTIVE'
    )
  ),
  true
);
select set_config(
  'crusade.active_status_result',
  (
    select jsonb_build_object(
      'update_id', update_id,
      'new_revision', new_revision
    )::text
    from public.update_kill_team_operational_status(
      '00000000-0000-4000-8000-000000000911',
      'OBJECTIVE',
      current_setting('crusade.active_status_revision', true)::bigint
    )
  ),
  true
);

select is(
  (
    select operational_status::text
    from public.kill_teams
    where id = '00000000-0000-4000-8000-000000000911'
  ),
  'OBJECTIVE',
  'Administrator may update operational status in ACTIVE'
);

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is(
  public.get_public_sync_snapshot()
    -> 'campaign' -> 'kill_teams' -> 0 ->> 'operational_status',
  'OBJECTIVE',
  'the public snapshot exposes operational status'
);

select ok(
  position('discord_user_id' in public.get_public_sync_snapshot()::text) = 0
    and position('actor_id' in public.get_public_sync_snapshot()::text) = 0
    and position('KILL_TEAM_OPERATIONAL_STATUS' in public.get_public_sync_snapshot()::text) = 0,
  'the public snapshot excludes Discord, actor, and audit metadata'
);

select is(
  public.get_public_sync_snapshot() -> 'campaign' ->> 'revision',
  public.get_public_sync_snapshot() -> 'signal' ->> 'revision',
  'operational status uses the existing public synchronization signal'
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
  'crusade.final_status_revision',
  (
    select new_revision::text
    from public.transition_mission_state(
      '00000000-0000-4000-8000-000000000901',
      (current_setting('crusade.active_status_result', true)::jsonb ->> 'new_revision')::bigint,
      'COMPLETE'
    )
  ),
  true
);

select throws_ok(
  $$
    select *
    from public.update_kill_team_operational_status(
      '00000000-0000-4000-8000-000000000911',
      'COMPLETE',
      current_setting('crusade.final_status_revision', true)::bigint
    )
  $$,
  'P0001',
  'KILL_TEAM_OPERATIONAL_STATUS_LOCKED',
  'operational status mutation is rejected in COMPLETE'
);

select set_config(
  'crusade.final_status_revision',
  (
    select new_revision::text
    from public.transition_mission_state(
      '00000000-0000-4000-8000-000000000902',
      current_setting('crusade.final_status_revision', true)::bigint,
      'READY'
    )
  ),
  true
);
select set_config(
  'crusade.final_status_revision',
  (
    select new_revision::text
    from public.transition_mission_state(
      '00000000-0000-4000-8000-000000000902',
      current_setting('crusade.final_status_revision', true)::bigint,
      'ACTIVE'
    )
  ),
  true
);
select set_config(
  'crusade.final_status_revision',
  (
    select new_revision::text
    from public.transition_mission_state(
      '00000000-0000-4000-8000-000000000902',
      current_setting('crusade.final_status_revision', true)::bigint,
      'ABORTED'
    )
  ),
  true
);

select throws_ok(
  $$
    select *
    from public.update_kill_team_operational_status(
      '00000000-0000-4000-8000-000000000912',
      'WITHDRAWN',
      current_setting('crusade.final_status_revision', true)::bigint
    )
  $$,
  'P0001',
  'KILL_TEAM_OPERATIONAL_STATUS_LOCKED',
  'operational status mutation is rejected in ABORTED'
);

select * from finish();
rollback;
