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

select plan(53);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kill_team_progress_ledger'
      and column_name = 'source_submission_id'
      and is_nullable = 'YES'
  ),
  'the progress ledger has a nullable source submission relationship'
);

select is(
  (
    select count(*)
    from public.kill_team_progress_ledger
    where source_submission_id is not null
  ),
  0::bigint,
  'existing manual ledger history remains valid without a submission source'
);

insert into public.campaigns (id, name, status)
values
  ('12000000-0000-4000-8000-000000000001', 'Review Draft Campaign', 'ACTIVE'),
  ('12000000-0000-4000-8000-000000000002', 'Review Ready Campaign', 'ACTIVE'),
  ('12000000-0000-4000-8000-000000000003', 'Review Complete Campaign', 'ACTIVE'),
  ('12000000-0000-4000-8000-000000000004', 'Review Abort Campaign', 'ACTIVE');

insert into public.missions (
  id,
  campaign_id,
  battlefield_id,
  name,
  description,
  enemy_faction
) values
  ('22000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'Review Draft Mission', 'Synthetic DRAFT review fixture.', 'Sandbox Hostiles'),
  ('22000000-0000-4000-8000-000000000002', '12000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000101', 'Review Ready Mission', 'Synthetic READY review fixture.', 'Sandbox Hostiles'),
  ('22000000-0000-4000-8000-000000000003', '12000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000101', 'Review Complete Mission', 'Synthetic COMPLETE review fixture.', 'Sandbox Hostiles'),
  ('22000000-0000-4000-8000-000000000004', '12000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000101', 'Review Abort Mission', 'Synthetic ABORTED review fixture.', 'Sandbox Hostiles');

insert into public.objectives (mission_id, title, sort_order)
select id, 'Review test objective', 0
from public.missions
where id in (
  '22000000-0000-4000-8000-000000000001',
  '22000000-0000-4000-8000-000000000002',
  '22000000-0000-4000-8000-000000000003',
  '22000000-0000-4000-8000-000000000004'
);

insert into public.mission_enemy_entries (mission_id, name, sort_order)
select id, 'Review test enemy', 0
from public.missions
where id in (
  '22000000-0000-4000-8000-000000000001',
  '22000000-0000-4000-8000-000000000002',
  '22000000-0000-4000-8000-000000000003',
  '22000000-0000-4000-8000-000000000004'
);

insert into public.kill_teams (id, mission_id, name)
values
  ('32000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', 'Review Draft Team'),
  ('32000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002', 'Review Ready Team'),
  ('32000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000003', 'Review Complete Team'),
  ('32000000-0000-4000-8000-000000000004', '22000000-0000-4000-8000-000000000004', 'Review Abort Team');

insert into public.kill_team_members (
  id,
  kill_team_id,
  mission_id,
  discord_user_id,
  display_name
) values
  ('42000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '920000000000000001', 'Review Draft Member'),
  ('42000000-0000-4000-8000-000000000002', '32000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002', '920000000000000002', 'Review Ready Member'),
  ('42000000-0000-4000-8000-000000000003', '32000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000003', '920000000000000003', 'Review Complete Member'),
  ('42000000-0000-4000-8000-000000000004', '32000000-0000-4000-8000-000000000004', '22000000-0000-4000-8000-000000000004', '920000000000000004', 'Review Abort Member');

insert into public.crusade_submissions (
  id,
  receipt_reference,
  campaign_id,
  mission_id,
  kill_team_id,
  submitting_discord_user_id,
  event_type,
  scoring_target_key,
  player_note,
  evidence_original_filename,
  evidence_content_type,
  evidence_source_reference,
  evidence_file_size_bytes
) values
  ('70000000-0000-4000-8000-000000000001', 'CR-10001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000501', '900000000000000001', 'OBJECTIVE', null, 'Admin objective approval', 'admin-objective.png', 'image/png', 'discord-attachment:admin-objective', 1101),
  ('70000000-0000-4000-8000-000000000002', 'CR-10002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000501', '900000000000000002', 'TERMINUS_KILL', 'sandbox-terminus-target-alpha', 'Moderator Terminus approval', 'moderator-terminus.webp', 'image/webp', 'discord-attachment:moderator-terminus', 1102),
  ('70000000-0000-4000-8000-000000000003', 'CR-10003', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000502', '900000000000000003', 'OBJECTIVE', null, 'Admin rejection', 'admin-reject.jpg', 'image/jpeg', 'discord-attachment:admin-reject', 1103),
  ('70000000-0000-4000-8000-000000000004', 'CR-10004', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000502', '900000000000000004', 'OBJECTIVE', null, 'Moderator rejection', 'moderator-reject.jpg', 'image/jpeg', 'discord-attachment:moderator-reject', 1104),
  ('70000000-0000-4000-8000-000000000005', 'CR-10005', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000501', '900000000000000001', 'OBJECTIVE', null, 'Stale revision test', 'stale.png', 'image/png', 'discord-attachment:stale', 1105),
  ('70000000-0000-4000-8000-000000000006', 'CR-10006', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000501', '900000000000000001', 'OBJECTIVE', null, 'Zero award test', 'zero.png', 'image/png', 'discord-attachment:zero', 1106),
  ('70000000-0000-4000-8000-000000000007', 'CR-10007', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000501', '900000000000000001', 'OBJECTIVE', null, 'Authorization test', 'auth.png', 'image/png', 'discord-attachment:auth', 1107),
  ('70000000-0000-4000-8000-000000000008', 'CR-10008', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000501', '900000000000000001', 'OBJECTIVE', null, 'Queue pending test', 'queue.png', 'image/png', 'discord-attachment:queue', 1108),
  ('70000000-0000-4000-8000-000000000009', 'CR-10009', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000502', '900000000000000004', 'MISSION_COMPLETION', null, 'Mission completion approval', 'mission-complete.png', 'image/png', 'discord-attachment:mission-complete', 1109),
  ('70000000-0000-4000-8000-000000000011', 'CR-10011', '12000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000001', '920000000000000001', 'OBJECTIVE', null, 'Draft approval rejection', 'draft.png', 'image/png', 'discord-attachment:draft-review', 1111),
  ('70000000-0000-4000-8000-000000000012', 'CR-10012', '12000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002', '32000000-0000-4000-8000-000000000002', '920000000000000002', 'OBJECTIVE', null, 'Ready approval rejection', 'ready.png', 'image/png', 'discord-attachment:ready-review', 1112),
  ('70000000-0000-4000-8000-000000000013', 'CR-10013', '12000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000003', '32000000-0000-4000-8000-000000000003', '920000000000000003', 'OBJECTIVE', null, 'Complete approval rejection', 'complete.png', 'image/png', 'discord-attachment:complete-review', 1113),
  ('70000000-0000-4000-8000-000000000014', 'CR-10014', '12000000-0000-4000-8000-000000000004', '22000000-0000-4000-8000-000000000004', '32000000-0000-4000-8000-000000000004', '920000000000000004', 'OBJECTIVE', null, 'Aborted approval rejection', 'aborted.png', 'image/png', 'discord-attachment:aborted-review', 1114);

do $$
declare
  v_revision bigint;
begin
  select revision into v_revision
  from public.live_campaign_states
  where campaign_id = '12000000-0000-4000-8000-000000000002';
  perform * from public.transition_mission_state(
    '22000000-0000-4000-8000-000000000002',
    v_revision,
    'READY'
  );

  select revision into v_revision
  from public.live_campaign_states
  where campaign_id = '12000000-0000-4000-8000-000000000003';
  select new_revision into v_revision
  from public.transition_mission_state(
    '22000000-0000-4000-8000-000000000003',
    v_revision,
    'READY'
  );
  select new_revision into v_revision
  from public.transition_mission_state(
    '22000000-0000-4000-8000-000000000003',
    v_revision,
    'ACTIVE'
  );
  perform * from public.transition_mission_state(
    '22000000-0000-4000-8000-000000000003',
    v_revision,
    'COMPLETE'
  );

  select revision into v_revision
  from public.live_campaign_states
  where campaign_id = '12000000-0000-4000-8000-000000000004';
  select new_revision into v_revision
  from public.transition_mission_state(
    '22000000-0000-4000-8000-000000000004',
    v_revision,
    'READY'
  );
  select new_revision into v_revision
  from public.transition_mission_state(
    '22000000-0000-4000-8000-000000000004',
    v_revision,
    'ACTIVE'
  );
  perform * from public.transition_mission_state(
    '22000000-0000-4000-8000-000000000004',
    v_revision,
    'ABORTED'
  );
end;
$$;

select set_config(
  'crusade.review.initial_revision',
  (
    select revision::text
    from public.live_campaign_states
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  true
);
select set_config(
  'crusade.review.initial_points',
  (
    select crusade_points::text
    from public.get_public_active_campaign()
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  true
);

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select throws_ok(
  $$select * from public.approve_crusade_submission('70000000-0000-4000-8000-000000000007', 3, 3)$$,
  '42501',
  'permission denied for function approve_crusade_submission',
  'anonymous users cannot approve submissions'
);

select throws_ok(
  $$select * from public.reject_crusade_submission('70000000-0000-4000-8000-000000000007', 'anon')$$,
  '42501',
  'permission denied for function reject_crusade_submission',
  'anonymous users cannot reject submissions'
);

select throws_ok(
  $$select * from public.get_crusade_submission_queue()$$,
  '42501',
  'permission denied for function get_crusade_submission_queue',
  'anonymous users cannot read the review queue'
);

select throws_ok(
  $$select public.get_pending_crusade_submission_count()$$,
  '42501',
  'permission denied for function get_pending_crusade_submission_count',
  'anonymous users cannot read the pending count'
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
  $$select * from public.approve_crusade_submission('70000000-0000-4000-8000-000000000007', 3, 3)$$,
  'P0001',
  'AUTHORIZATION_REQUIRED',
  'authenticated Players cannot approve submissions'
);

select throws_ok(
  $$select * from public.reject_crusade_submission('70000000-0000-4000-8000-000000000007', 'player')$$,
  'P0001',
  'AUTHORIZATION_REQUIRED',
  'authenticated Players cannot reject submissions'
);

select throws_ok(
  $$select * from public.get_crusade_submission_queue()$$,
  'P0001',
  'AUTHORIZATION_REQUIRED',
  'authenticated Players cannot read the review queue'
);

select throws_ok(
  $$select public.get_pending_crusade_submission_count()$$,
  'P0001',
  'AUTHORIZATION_REQUIRED',
  'authenticated Players cannot read the pending count'
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

select is(
  public.get_pending_crusade_submission_count(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000201'
  ),
  9::bigint,
  'the staff pending count initially includes every active-mission fixture'
);

select is(
  (
    select count(*)
    from public.get_crusade_submission_queue(
      'PENDING',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000201'
    )
  ),
  9::bigint,
  'Administrators can filter the queue to pending submissions'
);

select ok(
  exists (
    select 1
    from public.get_crusade_submission_queue(
      'PENDING',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000201'
    ) as queued
    where queued.submission_id = '70000000-0000-4000-8000-000000000002'
      and queued.kill_team_name = 'Sandbox Kill Team Alpha'
      and queued.submitting_member_display_name = 'Sandbox Alpha Two'
      and queued.scoring_target_name = 'Sandbox Terminus Target Alpha'
      and queued.evidence_source_reference = 'discord-attachment:moderator-terminus'
  ),
  'the staff queue returns the member, team, target, note, and private evidence context needed for review'
);

select throws_ok(
  $$select * from public.approve_crusade_submission('79999999-0000-4000-8000-000000000999', 3, 3)$$,
  'P0001',
  'SUBMISSION_NOT_FOUND',
  'an invalid submission identifier is rejected'
);

select throws_ok(
  $$select * from public.approve_crusade_submission('70000000-0000-4000-8000-000000000006', 0, 3)$$,
  'P0001',
  'SUBMISSION_AWARD_DELTA_ZERO',
  'approval requires a nonzero awarded point delta'
);

select throws_ok(
  $$select * from public.approve_crusade_submission('70000000-0000-4000-8000-000000000011', 3, 1)$$,
  'P0001',
  'SUBMISSION_MISSION_NOT_ACTIVE',
  'DRAFT mission submissions cannot be approved'
);

select throws_ok(
  $$select * from public.approve_crusade_submission('70000000-0000-4000-8000-000000000012', 3, 2)$$,
  'P0001',
  'SUBMISSION_MISSION_NOT_ACTIVE',
  'READY mission submissions cannot be approved'
);

select throws_ok(
  $$select * from public.approve_crusade_submission('70000000-0000-4000-8000-000000000013', 3, 4)$$,
  'P0001',
  'SUBMISSION_MISSION_NOT_ACTIVE',
  'COMPLETE mission submissions cannot be approved'
);

select throws_ok(
  $$select * from public.approve_crusade_submission('70000000-0000-4000-8000-000000000014', 3, 4)$$,
  'P0001',
  'SUBMISSION_MISSION_NOT_ACTIVE',
  'ABORTED mission submissions cannot be approved'
);

select set_config(
  'crusade.review.admin_approval',
  (
    select to_jsonb(result)::text
    from public.approve_crusade_submission(
      '70000000-0000-4000-8000-000000000001',
      5,
      current_setting('crusade.review.initial_revision', true)::bigint,
      'Administrator approved objective evidence'
    ) as result
  ),
  true
);

select is(
  current_setting('crusade.review.admin_approval', true)::jsonb
    ->> 'submission_status',
  'APPROVED',
  'an Administrator can approve an ACTIVE-mission submission'
);

select is(
  (
    current_setting('crusade.review.admin_approval', true)::jsonb
    ->> 'new_revision'
  )::bigint,
  current_setting('crusade.review.initial_revision', true)::bigint + 1,
  'an approval increments the campaign revision exactly once'
);

select is(
  (
    select count(*)
    from public.crusade_submission_reviews
    where submission_id = '70000000-0000-4000-8000-000000000001'
      and status = 'APPROVED'
      and reviewed_by = 'a0000000-0000-4000-8000-000000000001'
      and awarded_point_delta = 5
  ),
  1::bigint,
  'approval creates exactly one immutable review row with the staff actor'
);

select is(
  (
    select count(*)
    from public.kill_team_progress_ledger
    where source_submission_id = '70000000-0000-4000-8000-000000000001'
      and event_type = 'OBJECTIVE'
      and point_delta = 5
  ),
  1::bigint,
  'approval creates exactly one traceable ledger entry with the mapped event type'
);

select ok(
  exists (
    select 1
    from public.campaign_updates
    where campaign_id = '00000000-0000-4000-8000-000000000001'
      and change_type = 'KILL_TEAM_PROGRESS'
      and actor_id = 'a0000000-0000-4000-8000-000000000001'
      and new_values ->> 'action' = 'SUBMISSION_APPROVED'
      and new_values ->> 'source_submission_id' = '70000000-0000-4000-8000-000000000001'
      and new_values ->> 'ledger_entry_id' = (
        current_setting('crusade.review.admin_approval', true)::jsonb
        ->> 'ledger_entry_id'
      )
  ),
  'approval appends audit history linking the submission, actor, ledger entry, and revision'
);

select is(
  (
    select revision
    from public.public_campaign_sync_signals
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  (
    current_setting('crusade.review.admin_approval', true)::jsonb
    ->> 'new_revision'
  )::bigint,
  'approval publishes through the existing synchronization signal'
);

select throws_ok(
  format(
    'select * from public.approve_crusade_submission(%L, 1, %s)',
    '70000000-0000-4000-8000-000000000005',
    current_setting('crusade.review.initial_revision', true)
  ),
  'P0001',
  'REVISION_CONFLICT',
  'approval rejects a stale campaign revision'
);

select is(
  (
    select count(*)
    from public.crusade_submission_reviews
    where submission_id = '70000000-0000-4000-8000-000000000005'
  ),
  0::bigint,
  'a stale approval rolls back its tentative review row atomically'
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
  'crusade.review.moderator_approval',
  (
    select to_jsonb(result)::text
    from public.approve_crusade_submission(
      '70000000-0000-4000-8000-000000000002',
      7,
      (
        current_setting('crusade.review.admin_approval', true)::jsonb
        ->> 'new_revision'
      )::bigint,
      'Moderator approved Terminus evidence'
    ) as result
  ),
  true
);

select is(
  current_setting('crusade.review.moderator_approval', true)::jsonb
    ->> 'submission_status',
  'APPROVED',
  'a Moderator can approve an ACTIVE-mission submission'
);

select ok(
  exists (
    select 1
    from public.kill_team_progress_ledger
    where source_submission_id = '70000000-0000-4000-8000-000000000002'
      and event_type = 'TERMINUS_KILL'
      and scoring_target_key = 'sandbox-terminus-target-alpha'
      and actor_id = 'a0000000-0000-4000-8000-000000000002'
  ),
  'Terminus approval preserves its event mapping, scoring target, and Moderator actor'
);

select ok(
  exists (
    select 1
    from public.get_crusade_submission_queue(
      'APPROVED',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000201'
    ) as queued
    where queued.submission_id = '70000000-0000-4000-8000-000000000002'
      and queued.reviewer_role = 'MODERATOR'
      and queued.awarded_point_delta = 7
  ),
  'Moderators can read approved queue rows with reviewer identity and award data'
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
  'crusade.review.completion_approval',
  (
    select to_jsonb(result)::text
    from public.approve_crusade_submission(
      '70000000-0000-4000-8000-000000000009',
      11,
      (
        current_setting('crusade.review.moderator_approval', true)::jsonb
        ->> 'new_revision'
      )::bigint,
      'Administrator approved mission completion evidence'
    ) as result
  ),
  true
);

select ok(
  exists (
    select 1
    from public.kill_team_progress_ledger
    where source_submission_id = '70000000-0000-4000-8000-000000000009'
      and event_type = 'MISSION_COMPLETION'
      and point_delta = 11
  ),
  'mission completion maps to the matching ledger event type'
);

select is(
  (
    current_setting('crusade.review.completion_approval', true)::jsonb
    ->> 'new_revision'
  )::bigint,
  current_setting('crusade.review.initial_revision', true)::bigint + 3,
  'three approvals produce exactly three campaign revision increments'
);

select throws_ok(
  format(
    'select * from public.approve_crusade_submission(%L, 5, %s)',
    '70000000-0000-4000-8000-000000000001',
    current_setting('crusade.review.completion_approval', true)::jsonb
      ->> 'new_revision'
  ),
  'P0001',
  'SUBMISSION_ALREADY_REVIEWED',
  'a second approval attempt is rejected'
);

select throws_ok(
  $$select * from public.reject_crusade_submission('70000000-0000-4000-8000-000000000001', 'cannot reverse approval')$$,
  'P0001',
  'SUBMISSION_ALREADY_REVIEWED',
  'an approved submission cannot later be rejected'
);

select set_config(
  'crusade.review.before_rejection_revision',
  (
    select revision::text
    from public.live_campaign_states
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  true
);
select set_config(
  'crusade.review.before_rejection_points',
  (
    select crusade_points::text
    from public.get_public_active_campaign()
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  true
);

select set_config(
  'crusade.review.admin_rejection',
  (
    select to_jsonb(result)::text
    from public.reject_crusade_submission(
      '70000000-0000-4000-8000-000000000003',
      'Administrator rejected insufficient evidence'
    ) as result
  ),
  true
);

select is(
  current_setting('crusade.review.admin_rejection', true)::jsonb
    ->> 'submission_status',
  'REJECTED',
  'an Administrator can reject a pending submission'
);

select is(
  (
    select count(*)
    from public.crusade_submission_reviews
    where submission_id = '70000000-0000-4000-8000-000000000003'
      and status = 'REJECTED'
      and reviewed_by = 'a0000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'rejection creates exactly one immutable REJECTED review row'
);

select is(
  (
    select count(*)
    from public.kill_team_progress_ledger
    where source_submission_id = '70000000-0000-4000-8000-000000000003'
  ),
  0::bigint,
  'rejection creates no progress ledger entry'
);

select throws_ok(
  format(
    'select * from public.approve_crusade_submission(%L, 3, %s)',
    '70000000-0000-4000-8000-000000000003',
    current_setting('crusade.review.before_rejection_revision', true)
  ),
  'P0001',
  'SUBMISSION_ALREADY_REVIEWED',
  'a rejected submission cannot later be approved'
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

select is(
  (
    select submission_status::text
    from public.reject_crusade_submission(
      '70000000-0000-4000-8000-000000000004',
      'Moderator rejected duplicate evidence'
    )
  ),
  'REJECTED',
  'a Moderator can reject a pending submission'
);

select is(
  (
    select count(*)
    from public.get_crusade_submission_queue(
      'REJECTED',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000201'
    )
  ),
  2::bigint,
  'staff can filter the queue to rejected submissions'
);

select throws_ok(
  $$select * from public.reject_crusade_submission('70000000-0000-4000-8000-000000000004', 'cannot reject twice')$$,
  'P0001',
  'SUBMISSION_ALREADY_REVIEWED',
  'a rejected submission cannot be rejected a second time'
);

select is(
  public.get_pending_crusade_submission_count(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000201'
  ),
  4::bigint,
  'reviewed submissions disappear from the authoritative pending count'
);

select is(
  (
    select count(*)
    from public.get_crusade_submission_queue(
      'APPROVED',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000201'
    )
  ),
  3::bigint,
  'staff can filter the queue to approved submissions'
);

reset role;

select is(
  (
    select revision
    from public.live_campaign_states
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  current_setting('crusade.review.before_rejection_revision', true)::bigint,
  'rejections do not change the public scoring revision'
);

select is(
  (
    select crusade_points
    from public.get_public_active_campaign()
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  current_setting('crusade.review.before_rejection_points', true)::bigint,
  'rejections do not change Crusade Points'
);

select is(
  (
    select crusade_points
    from public.get_public_active_campaign()
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  47::bigint,
  'approved awards update the public campaign Crusade Points aggregate'
);

select is(
  (
    select (team.value ->> 'crusade_points')::bigint
    from public.get_public_active_campaign() as campaign
    cross join lateral jsonb_array_elements(campaign.kill_teams) as team(value)
    where campaign.campaign_id = '00000000-0000-4000-8000-000000000001'
      and team.value ->> 'id' = '00000000-0000-4000-8000-000000000501'
  ),
  32::bigint,
  'approved awards update the public Kill Team Crusade Points aggregate'
);

select is(
  (
    select (team.value ->> 'terminus_kills')::bigint
    from public.get_public_active_campaign() as campaign
    cross join lateral jsonb_array_elements(campaign.kill_teams) as team(value)
    where campaign.campaign_id = '00000000-0000-4000-8000-000000000001'
      and team.value ->> 'id' = '00000000-0000-4000-8000-000000000501'
  ),
  2::bigint,
  'approved Terminus evidence increments the public Terminus count'
);

select is(
  (
    select (team.value ->> 'objectives_completed')::bigint
    from public.get_public_active_campaign() as campaign
    cross join lateral jsonb_array_elements(campaign.kill_teams) as team(value)
    where campaign.campaign_id = '00000000-0000-4000-8000-000000000001'
      and team.value ->> 'id' = '00000000-0000-4000-8000-000000000501'
  ),
  2::bigint,
  'approved objective evidence increments the public objective count'
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
      actor_id,
      source_submission_id
    ) values (
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000201',
      '00000000-0000-4000-8000-000000000501',
      'OBJECTIVE',
      5,
      999,
      'a0000000-0000-4000-8000-000000000001',
      '70000000-0000-4000-8000-000000000001'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "kill_team_progress_source_submission_unique"',
  'one submission cannot create a second ledger entry even through a duplicate race'
);

select is(
  (
    select count(*)
    from public.kill_team_progress_ledger
    where source_submission_id = '70000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'duplicate approval attempts leave exactly one source-linked ledger entry'
);

select ok(
  not (public.get_public_sync_snapshot() ? 'pending_submission_count')
  and not (public.get_public_sync_snapshot() ? 'submissions'),
  'the public snapshot exposes neither the queue nor pending count'
);

select ok(
  position(
    'discord-attachment:moderator-terminus'
    in public.get_public_sync_snapshot()::text
  ) = 0,
  'private evidence metadata remains absent from the public snapshot'
);

select * from finish();
rollback;
