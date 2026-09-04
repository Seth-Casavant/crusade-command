begin;

create extension if not exists pgtap;
set local search_path = public, extensions, pg_catalog;

select plan(35);

-- Campaign progress boundaries and failed-update revision behavior.
select lives_ok(
  $$
    insert into public.campaigns (id, name)
    values ('10000000-0000-4000-8000-000000000001', 'Progress Test Campaign')
  $$,
  'campaign with initial progress zero can be created'
);

select is(
  (
    select lcs.campaign_progress::integer
    from public.live_campaign_states as lcs
    where lcs.campaign_id = '10000000-0000-4000-8000-000000000001'
  ),
  0,
  'campaign progress zero succeeds'
);

select lives_ok(
  $$
    select *
    from public.update_campaign_live_state(
      '10000000-0000-4000-8000-000000000001',
      1,
      100
    )
  $$,
  'campaign progress 100 succeeds'
);

select is(
  (
    select lcs.campaign_progress::integer
    from public.live_campaign_states as lcs
    where lcs.campaign_id = '10000000-0000-4000-8000-000000000001'
  ),
  100,
  'campaign progress stores 100'
);

select throws_ok(
  $$
    select *
    from public.update_campaign_live_state(
      '10000000-0000-4000-8000-000000000001',
      2,
      -1
    )
  $$,
  'P0001',
  'INVALID_CAMPAIGN_PROGRESS',
  'campaign progress -1 is rejected'
);

select throws_ok(
  $$
    select *
    from public.update_campaign_live_state(
      '10000000-0000-4000-8000-000000000001',
      2,
      101
    )
  $$,
  'P0001',
  'INVALID_CAMPAIGN_PROGRESS',
  'campaign progress 101 is rejected'
);

select is(
  (
    select lcs.revision
    from public.live_campaign_states as lcs
    where lcs.campaign_id = '10000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'failed progress updates do not increment revision'
);

-- Main lifecycle, locking, concurrency, atomicity, and audit fixture.
insert into public.campaigns (id, name)
values ('10000000-0000-4000-8000-000000000002', 'Lifecycle Test Campaign');

insert into public.battlefields (id, name, slug)
values
  ('30000000-0000-4000-8000-000000000001', 'Test Battlefield Alpha', 'test-alpha'),
  ('30000000-0000-4000-8000-000000000002', 'Test Battlefield Beta', 'test-beta');

insert into public.missions (
  id,
  campaign_id,
  battlefield_id,
  name,
  enemy_faction
) values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000001',
  'Lifecycle Mission One',
  'Test Hostiles'
);

insert into public.objectives (id, mission_id, title, sort_order)
values (
  '40000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'Test Objective One',
  0
);

insert into public.mission_enemy_entries (
  id,
  mission_id,
  name,
  sort_order
) values (
  '50000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'Test Enemy One',
  0
);

select lives_ok(
  $$
    update public.missions
    set battlefield_id = '30000000-0000-4000-8000-000000000002'
    where id = '20000000-0000-4000-8000-000000000001'
  $$,
  'DRAFT battlefield change succeeds'
);

select lives_ok(
  $$
    select *
    from public.transition_mission_state(
      '20000000-0000-4000-8000-000000000001',
      1,
      'READY'
    )
  $$,
  'DRAFT to READY succeeds'
);

select lives_ok(
  $$
    select *
    from public.transition_mission_state(
      '20000000-0000-4000-8000-000000000001',
      2,
      'ACTIVE'
    )
  $$,
  'READY to ACTIVE succeeds when requirements are present'
);

select is(
  (
    select count(*)::integer
    from public.missions as m
    where m.campaign_id = '10000000-0000-4000-8000-000000000002'
      and m.status = 'ACTIVE'
  ),
  1,
  'one ACTIVE mission succeeds'
);

insert into public.missions (
  id,
  campaign_id,
  battlefield_id,
  name,
  enemy_faction
) values (
  '20000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000001',
  'Lifecycle Mission Two',
  'Test Hostiles'
);

insert into public.objectives (id, mission_id, title, sort_order)
values (
  '40000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000002',
  'Test Objective Two',
  0
);

insert into public.mission_enemy_entries (
  id,
  mission_id,
  name,
  sort_order
) values (
  '50000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000002',
  'Test Enemy Two',
  0
);

select lives_ok(
  $$
    select *
    from public.transition_mission_state(
      '20000000-0000-4000-8000-000000000002',
      3,
      'READY'
    )
  $$,
  'a second DRAFT mission can become READY while another is ACTIVE'
);

select throws_ok(
  $$
    select *
    from public.transition_mission_state(
      '20000000-0000-4000-8000-000000000002',
      4,
      'ACTIVE'
    )
  $$,
  'P0001',
  'ACTIVE_MISSION_EXISTS',
  'a second ACTIVE mission in the same campaign is rejected'
);

select throws_ok(
  $$
    update public.missions
    set battlefield_id = '30000000-0000-4000-8000-000000000001'
    where id = '20000000-0000-4000-8000-000000000001'
  $$,
  'P0001',
  'BATTLEFIELD_LOCKED',
  'ACTIVE battlefield change is rejected'
);

select lives_ok(
  $$
    select *
    from public.update_campaign_live_state(
      '10000000-0000-4000-8000-000000000002',
      4,
      50,
      '40000000-0000-4000-8000-000000000001',
      'ACTIVE',
      null
    )
  $$,
  'correct revision atomically updates progress and objective state'
);

select is(
  (
    select lcs.campaign_progress::integer
    from public.live_campaign_states as lcs
    where lcs.campaign_id = '10000000-0000-4000-8000-000000000002'
  ),
  50,
  'successful atomic update stores progress'
);

select is(
  (
    select o.status::text
    from public.objectives as o
    where o.id = '40000000-0000-4000-8000-000000000001'
  ),
  'ACTIVE',
  'successful atomic update stores objective state'
);

select is(
  (
    select lcs.revision
    from public.live_campaign_states as lcs
    where lcs.campaign_id = '10000000-0000-4000-8000-000000000002'
  ),
  5::bigint,
  'successful live update increments revision exactly once'
);

select is(
  (
    select count(*)::integer
    from public.campaign_updates as cu
    where cu.campaign_id = '10000000-0000-4000-8000-000000000002'
      and cu.change_type = 'LIVE_STATE_UPDATE'
  ),
  1,
  'successful live update creates one audit row'
);

select throws_ok(
  $$
    update public.campaign_updates
    set old_values = '{}'::jsonb
    where campaign_id = '10000000-0000-4000-8000-000000000002'
  $$,
  'P0001',
  'AUDIT_LOG_APPEND_ONLY',
  'audit rows cannot be updated'
);

select throws_ok(
  $$
    select *
    from public.update_campaign_live_state(
      '10000000-0000-4000-8000-000000000002',
      4,
      60
    )
  $$,
  'P0001',
  'REVISION_CONFLICT',
  'stale expected revision is rejected'
);

select is(
  (
    select lcs.revision
    from public.live_campaign_states as lcs
    where lcs.campaign_id = '10000000-0000-4000-8000-000000000002'
  ),
  5::bigint,
  'stale update does not increment revision'
);

select throws_ok(
  $$
    select *
    from public.update_campaign_live_state(
      '10000000-0000-4000-8000-000000000002',
      5,
      60,
      '40000000-0000-4000-8000-000000009999',
      'COMPLETE',
      null
    )
  $$,
  'P0001',
  'OBJECTIVE_NOT_CURRENT',
  'invalid compound update fails atomically'
);

select is(
  (
    select lcs.campaign_progress::integer
    from public.live_campaign_states as lcs
    where lcs.campaign_id = '10000000-0000-4000-8000-000000000002'
  ),
  50,
  'failed compound update leaves progress unchanged'
);

select is(
  (
    select count(*)::integer
    from public.campaign_updates as cu
    where cu.campaign_id = '10000000-0000-4000-8000-000000000002'
  ),
  4,
  'failed compound update creates no audit corruption'
);

select lives_ok(
  $$
    select *
    from public.transition_mission_state(
      '20000000-0000-4000-8000-000000000001',
      5,
      'COMPLETE'
    )
  $$,
  'ACTIVE to COMPLETE succeeds'
);

select throws_ok(
  $$
    select *
    from public.transition_mission_state(
      '20000000-0000-4000-8000-000000000001',
      6,
      'ACTIVE'
    )
  $$,
  'P0001',
  'INVALID_STATE_TRANSITION',
  'COMPLETE to ACTIVE is rejected'
);

select throws_ok(
  $$
    update public.missions
    set battlefield_id = '30000000-0000-4000-8000-000000000001'
    where id = '20000000-0000-4000-8000-000000000001'
  $$,
  'P0001',
  'BATTLEFIELD_LOCKED',
  'completed mission battlefield remains immutable'
);

select lives_ok(
  $$
    select *
    from public.transition_mission_state(
      '20000000-0000-4000-8000-000000000002',
      6,
      'ACTIVE'
    )
  $$,
  'a READY mission activates after the previous mission completes'
);

select lives_ok(
  $$
    select *
    from public.transition_mission_state(
      '20000000-0000-4000-8000-000000000002',
      7,
      'ABORTED'
    )
  $$,
  'ACTIVE to ABORTED succeeds'
);

select throws_ok(
  $$
    update public.missions
    set battlefield_id = '30000000-0000-4000-8000-000000000002'
    where id = '20000000-0000-4000-8000-000000000002'
  $$,
  'P0001',
  'BATTLEFIELD_LOCKED',
  'aborted mission battlefield remains immutable'
);

-- Activation validation fixtures.
insert into public.campaigns (id, name)
values
  ('10000000-0000-4000-8000-000000000003', 'Missing Battlefield Campaign'),
  ('10000000-0000-4000-8000-000000000004', 'Missing Objective Campaign'),
  ('10000000-0000-4000-8000-000000000005', 'Missing Enemy Campaign');

insert into public.missions (
  id,
  campaign_id,
  battlefield_id,
  name,
  enemy_faction
) values
  (
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    null,
    'Missing Battlefield Mission',
    'Test Hostiles'
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000001',
    'Missing Objective Mission',
    'Test Hostiles'
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000005',
    '30000000-0000-4000-8000-000000000001',
    'Missing Enemy Mission',
    'Test Hostiles'
  );

insert into public.objectives (id, mission_id, title, sort_order)
values
  (
    '40000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000003',
    'Battlefield Fixture Objective',
    0
  ),
  (
    '40000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000005',
    'Enemy Fixture Objective',
    0
  );

insert into public.mission_enemy_entries (
  id,
  mission_id,
  name,
  sort_order
) values
  (
    '50000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000003',
    'Battlefield Fixture Enemy',
    0
  ),
  (
    '50000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000004',
    'Objective Fixture Enemy',
    0
  );

do $$
begin
  perform * from public.transition_mission_state(
    '20000000-0000-4000-8000-000000000003',
    1,
    'READY'
  );
  perform * from public.transition_mission_state(
    '20000000-0000-4000-8000-000000000004',
    1,
    'READY'
  );
  perform * from public.transition_mission_state(
    '20000000-0000-4000-8000-000000000005',
    1,
    'READY'
  );
end;
$$;

select throws_ok(
  $$
    select *
    from public.transition_mission_state(
      '20000000-0000-4000-8000-000000000003',
      2,
      'ACTIVE'
    )
  $$,
  'P0001',
  'ACTIVATION_VALIDATION_FAILED:BATTLEFIELD_REQUIRED',
  'READY to ACTIVE fails when battlefield is missing'
);

select throws_ok(
  $$
    select *
    from public.transition_mission_state(
      '20000000-0000-4000-8000-000000000004',
      2,
      'ACTIVE'
    )
  $$,
  'P0001',
  'ACTIVATION_VALIDATION_FAILED:OBJECTIVE_REQUIRED',
  'READY to ACTIVE fails when objective information is missing'
);

select throws_ok(
  $$
    select *
    from public.transition_mission_state(
      '20000000-0000-4000-8000-000000000005',
      2,
      'ACTIVE'
    )
  $$,
  'P0001',
  'ACTIVATION_VALIDATION_FAILED:ENEMY_REQUIRED',
  'READY to ACTIVE fails when enemy information is missing'
);

select is(
  (
    select count(*)::integer
    from public.missions as m
    where m.campaign_id in (
      '10000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000004',
      '10000000-0000-4000-8000-000000000005'
    ) and m.status = 'ACTIVE'
  ),
  0,
  'failed activation transactions leave no mission active'
);

select * from finish();
rollback;
