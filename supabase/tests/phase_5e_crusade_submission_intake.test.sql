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

select plan(50);

select has_table(
  'public',
  'crusade_submissions',
  'Crusade submissions have an authoritative intake table'
);

select has_table(
  'public',
  'crusade_submission_reviews',
  'submission decisions have a separate authoritative review table'
);

select is(
  enum_range(null::public.crusade_submission_event_type)::text,
  '{TERMINUS_KILL,OBJECTIVE,MISSION_COMPLETION}',
  'player submission types exclude staff-only corrections'
);

select is(
  enum_range(null::public.crusade_submission_status)::text,
  '{PENDING,APPROVED,REJECTED}',
  'submission lifecycle supports one pending and two final states'
);

select is(
  (
    select c.relrowsecurity
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'crusade_submissions'
  ),
  true,
  'submission intake has RLS enabled'
);

select is(
  (
    select c.relrowsecurity
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'crusade_submission_reviews'
  ),
  true,
  'submission reviews have RLS enabled'
);

insert into public.campaigns (id, name, status)
values
  ('11000000-0000-4000-8000-000000000001', 'Submission Draft Campaign', 'ACTIVE'),
  ('11000000-0000-4000-8000-000000000002', 'Submission Ready Campaign', 'ACTIVE'),
  ('11000000-0000-4000-8000-000000000003', 'Submission Complete Campaign', 'ACTIVE'),
  ('11000000-0000-4000-8000-000000000004', 'Submission Abort Campaign', 'ACTIVE');

insert into public.missions (
  id,
  campaign_id,
  battlefield_id,
  name,
  description,
  enemy_faction
) values
  ('21000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'Submission Draft Mission', 'Synthetic DRAFT submission fixture.', 'Sandbox Hostiles'),
  ('21000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000101', 'Submission Ready Mission', 'Synthetic READY submission fixture.', 'Sandbox Hostiles'),
  ('21000000-0000-4000-8000-000000000003', '11000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000101', 'Submission Complete Mission', 'Synthetic COMPLETE submission fixture.', 'Sandbox Hostiles'),
  ('21000000-0000-4000-8000-000000000004', '11000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000101', 'Submission Abort Mission', 'Synthetic ABORTED submission fixture.', 'Sandbox Hostiles');

insert into public.objectives (mission_id, title, sort_order)
select id, 'Submission test objective', 0
from public.missions
where id in (
  '21000000-0000-4000-8000-000000000001',
  '21000000-0000-4000-8000-000000000002',
  '21000000-0000-4000-8000-000000000003',
  '21000000-0000-4000-8000-000000000004'
);

insert into public.mission_enemy_entries (mission_id, name, sort_order)
select id, 'Submission test enemy', 0
from public.missions
where id in (
  '21000000-0000-4000-8000-000000000001',
  '21000000-0000-4000-8000-000000000002',
  '21000000-0000-4000-8000-000000000003',
  '21000000-0000-4000-8000-000000000004'
);

insert into public.kill_teams (id, mission_id, name)
values
  ('31000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'Submission Draft Team'),
  ('31000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002', 'Submission Ready Team'),
  ('31000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000003', 'Submission Complete Team'),
  ('31000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000004', 'Submission Abort Team');

insert into public.kill_team_members (
  id,
  kill_team_id,
  mission_id,
  discord_user_id,
  display_name
) values
  ('41000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', '910000000000000001', 'Submission Draft Member'),
  ('41000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002', '910000000000000002', 'Submission Ready Member'),
  ('41000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000003', '910000000000000003', 'Submission Complete Member'),
  ('41000000-0000-4000-8000-000000000004', '31000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000004', '910000000000000004', 'Submission Abort Member');

insert into public.mission_crusade_scoring_targets (
  mission_id,
  target_key,
  display_name,
  sort_order
) values (
  '21000000-0000-4000-8000-000000000002',
  'foreign-submission-target',
  'Foreign Submission Target',
  0
);

do $$
declare
  v_revision bigint;
begin
  select revision into v_revision
  from public.live_campaign_states
  where campaign_id = '11000000-0000-4000-8000-000000000002';
  perform * from public.transition_mission_state(
    '21000000-0000-4000-8000-000000000002',
    v_revision,
    'READY'
  );

  select revision into v_revision
  from public.live_campaign_states
  where campaign_id = '11000000-0000-4000-8000-000000000003';
  select new_revision into v_revision
  from public.transition_mission_state(
    '21000000-0000-4000-8000-000000000003',
    v_revision,
    'READY'
  );
  select new_revision into v_revision
  from public.transition_mission_state(
    '21000000-0000-4000-8000-000000000003',
    v_revision,
    'ACTIVE'
  );
  perform * from public.transition_mission_state(
    '21000000-0000-4000-8000-000000000003',
    v_revision,
    'COMPLETE'
  );

  select revision into v_revision
  from public.live_campaign_states
  where campaign_id = '11000000-0000-4000-8000-000000000004';
  select new_revision into v_revision
  from public.transition_mission_state(
    '21000000-0000-4000-8000-000000000004',
    v_revision,
    'READY'
  );
  select new_revision into v_revision
  from public.transition_mission_state(
    '21000000-0000-4000-8000-000000000004',
    v_revision,
    'ACTIVE'
  );
  perform * from public.transition_mission_state(
    '21000000-0000-4000-8000-000000000004',
    v_revision,
    'ABORTED'
  );
end;
$$;

select set_config(
  'crusade.submission_ledger_count_before',
  (select count(*)::text from public.kill_team_progress_ledger),
  true
);
select set_config(
  'crusade.submission_points_before',
  (
    select crusade_points::text
    from public.get_public_active_campaign()
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  true
);
select set_config(
  'crusade.submission_revision_before',
  (
    select revision::text
    from public.live_campaign_states
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  true
);
select set_config(
  'crusade.submission_audit_count_before',
  (
    select count(*)::text
    from public.campaign_updates
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  true
);

set local role service_role;

select set_config(
  'crusade.valid_submission',
  (
    select to_jsonb(result)::text
    from public.create_crusade_submission(
      p_campaign_id => '00000000-0000-4000-8000-000000000001',
      p_mission_id => '00000000-0000-4000-8000-000000000201',
      p_kill_team_id => '00000000-0000-4000-8000-000000000501',
      p_submitting_discord_user_id => '900000000000000001',
      p_event_type => 'OBJECTIVE',
      p_evidence_original_filename => 'objective-result.png',
      p_evidence_content_type => 'image/png',
      p_evidence_source_reference => 'https://discord.invalid/attachments/objective-result.png',
      p_player_note => 'Synthetic objective claim',
      p_evidence_file_size_bytes => 2048,
      p_external_idempotency_key => 'interaction-valid-objective-1'
    ) as result
  ),
  true
);

select ok(
  (current_setting('crusade.valid_submission', true)::jsonb ->> 'submission_id') is not null,
  'an ACTIVE-mission Kill Team member can submit through the trusted intake RPC'
);

select ok(
  (current_setting('crusade.valid_submission', true)::jsonb ->> 'receipt_reference')
    ~ '^CR-[0-9]{5,}$',
  'the database generates a short human-readable receipt'
);

select is(
  current_setting('crusade.valid_submission', true)::jsonb
    ->> 'submission_status',
  'PENDING',
  'new submissions return the PENDING state'
);

select set_config(
  'crusade.target_submission',
  (
    select to_jsonb(result)::text
    from public.create_crusade_submission(
      p_campaign_id => '00000000-0000-4000-8000-000000000001',
      p_mission_id => '00000000-0000-4000-8000-000000000201',
      p_kill_team_id => '00000000-0000-4000-8000-000000000501',
      p_submitting_discord_user_id => '900000000000000002',
      p_event_type => 'TERMINUS_KILL',
      p_evidence_original_filename => 'terminus-result.webp',
      p_evidence_content_type => 'image/webp',
      p_evidence_source_reference => 'discord-attachment:terminus-result',
      p_scoring_target_key => 'sandbox-terminus-target-alpha',
      p_external_idempotency_key => 'interaction-valid-terminus-1'
    ) as result
  ),
  true
);

select ok(
  (current_setting('crusade.target_submission', true)::jsonb ->> 'submission_id') is not null,
  'a TERMINUS_KILL may reference a scoring target from the same mission'
);

select set_config(
  'crusade.replayed_submission',
  (
    select to_jsonb(result)::text
    from public.create_crusade_submission(
      p_campaign_id => '00000000-0000-4000-8000-000000000001',
      p_mission_id => '00000000-0000-4000-8000-000000000201',
      p_kill_team_id => '00000000-0000-4000-8000-000000000501',
      p_submitting_discord_user_id => '900000000000000001',
      p_event_type => 'OBJECTIVE',
      p_evidence_original_filename => 'objective-result.png',
      p_evidence_content_type => 'image/png',
      p_evidence_source_reference => 'https://discord.invalid/attachments/objective-result.png',
      p_player_note => 'Synthetic objective claim',
      p_evidence_file_size_bytes => 2048,
      p_external_idempotency_key => 'interaction-valid-objective-1'
    ) as result
  ),
  true
);

select is(
  current_setting('crusade.replayed_submission', true)::jsonb
    ->> 'submission_id',
  current_setting('crusade.valid_submission', true)::jsonb
    ->> 'submission_id',
  'replaying an identical idempotency key returns the original submission'
);

select throws_ok(
  $$
    select * from public.create_crusade_submission(
      p_campaign_id => '00000000-0000-4000-8000-000000000001',
      p_mission_id => '00000000-0000-4000-8000-000000000201',
      p_kill_team_id => '00000000-0000-4000-8000-000000000501',
      p_submitting_discord_user_id => '900000000000000001',
      p_event_type => 'OBJECTIVE',
      p_evidence_original_filename => 'objective-result.png',
      p_evidence_content_type => 'image/png',
      p_evidence_source_reference => 'https://discord.invalid/attachments/objective-result.png',
      p_player_note => 'Changed retry payload',
      p_evidence_file_size_bytes => 2048,
      p_external_idempotency_key => 'interaction-valid-objective-1'
    )
  $$,
  'P0001',
  'SUBMISSION_IDEMPOTENCY_CONFLICT',
  'an idempotency key cannot be reused for a different claim'
);

select throws_ok(
  $$
    select * from public.create_crusade_submission(
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000201',
      '00000000-0000-4000-8000-000000000501',
      '999000000000000001',
      'OBJECTIVE',
      'non-member.png',
      'image/png',
      'discord-attachment:non-member'
    )
  $$,
  'P0001',
  'SUBMITTER_NOT_KILL_TEAM_MEMBER',
  'a Discord user outside the Kill Team is rejected'
);

select throws_ok(
  $$
    select * from public.create_crusade_submission(
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000201',
      '51000000-0000-4000-8000-000000000001',
      '900000000000000001',
      'OBJECTIVE',
      'missing-team.png',
      'image/png',
      'discord-attachment:missing-team'
    )
  $$,
  'P0001',
  'KILL_TEAM_NOT_FOUND',
  'an invalid Kill Team identifier is rejected'
);

select throws_ok(
  $$
    select * from public.create_crusade_submission(
      '51000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000201',
      '00000000-0000-4000-8000-000000000501',
      '900000000000000001',
      'OBJECTIVE',
      'missing-campaign.png',
      'image/png',
      'discord-attachment:missing-campaign'
    )
  $$,
  'P0001',
  'CAMPAIGN_NOT_FOUND',
  'an invalid campaign identifier is rejected'
);

select throws_ok(
  $$
    select * from public.create_crusade_submission(
      '00000000-0000-4000-8000-000000000001',
      '51000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000501',
      '900000000000000001',
      'OBJECTIVE',
      'missing-mission.png',
      'image/png',
      'discord-attachment:missing-mission'
    )
  $$,
  'P0001',
  'MISSION_NOT_FOUND',
  'an invalid mission identifier is rejected'
);

select throws_ok(
  $$
    select * from public.create_crusade_submission(
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000201',
      '31000000-0000-4000-8000-000000000002',
      '910000000000000002',
      'OBJECTIVE',
      'cross-team.png',
      'image/png',
      'discord-attachment:cross-team'
    )
  $$,
  'P0001',
  'SUBMISSION_KILL_TEAM_MISSION_MISMATCH',
  'a Kill Team from another mission is rejected'
);

select throws_ok(
  $$
    select * from public.create_crusade_submission(
      '11000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000201',
      '00000000-0000-4000-8000-000000000501',
      '900000000000000001',
      'OBJECTIVE',
      'cross-campaign.png',
      'image/png',
      'discord-attachment:cross-campaign'
    )
  $$,
  'P0001',
  'SUBMISSION_CAMPAIGN_MISSION_MISMATCH',
  'a mission from another campaign is rejected'
);

select throws_ok(
  $$
    select * from public.create_crusade_submission(
      '11000000-0000-4000-8000-000000000001',
      '21000000-0000-4000-8000-000000000001',
      '31000000-0000-4000-8000-000000000001',
      '910000000000000001',
      'OBJECTIVE',
      'draft.png',
      'image/png',
      'discord-attachment:draft'
    )
  $$,
  'P0001',
  'SUBMISSION_MISSION_NOT_ACTIVE',
  'DRAFT missions reject player submissions'
);

select throws_ok(
  $$
    select * from public.create_crusade_submission(
      '11000000-0000-4000-8000-000000000002',
      '21000000-0000-4000-8000-000000000002',
      '31000000-0000-4000-8000-000000000002',
      '910000000000000002',
      'OBJECTIVE',
      'ready.png',
      'image/png',
      'discord-attachment:ready'
    )
  $$,
  'P0001',
  'SUBMISSION_MISSION_NOT_ACTIVE',
  'READY missions reject player submissions'
);

select throws_ok(
  $$
    select * from public.create_crusade_submission(
      '11000000-0000-4000-8000-000000000003',
      '21000000-0000-4000-8000-000000000003',
      '31000000-0000-4000-8000-000000000003',
      '910000000000000003',
      'MISSION_COMPLETION',
      'complete.png',
      'image/png',
      'discord-attachment:complete'
    )
  $$,
  'P0001',
  'SUBMISSION_MISSION_NOT_ACTIVE',
  'COMPLETE missions reject player submissions'
);

select throws_ok(
  $$
    select * from public.create_crusade_submission(
      '11000000-0000-4000-8000-000000000004',
      '21000000-0000-4000-8000-000000000004',
      '31000000-0000-4000-8000-000000000004',
      '910000000000000004',
      'MISSION_COMPLETION',
      'aborted.png',
      'image/png',
      'discord-attachment:aborted'
    )
  $$,
  'P0001',
  'SUBMISSION_MISSION_NOT_ACTIVE',
  'ABORTED missions reject player submissions'
);

select throws_ok(
  $$
    select * from public.create_crusade_submission(
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000201',
      '00000000-0000-4000-8000-000000000501',
      '900000000000000001',
      'CORRECTION',
      'invalid-event.png',
      'image/png',
      'discord-attachment:invalid-event'
    )
  $$,
  '22P02',
  'invalid input value for enum crusade_submission_event_type: "CORRECTION"',
  'CORRECTION cannot enter the player submission domain'
);

select throws_ok(
  $$
    select * from public.create_crusade_submission(
      p_campaign_id => '00000000-0000-4000-8000-000000000001',
      p_mission_id => '00000000-0000-4000-8000-000000000201',
      p_kill_team_id => '00000000-0000-4000-8000-000000000501',
      p_submitting_discord_user_id => '900000000000000001',
      p_event_type => 'TERMINUS_KILL',
      p_evidence_original_filename => 'cross-target.png',
      p_evidence_content_type => 'image/png',
      p_evidence_source_reference => 'discord-attachment:cross-target',
      p_scoring_target_key => 'foreign-submission-target'
    )
  $$,
  'P0001',
  'SUBMISSION_TARGET_NOT_FOUND_FOR_MISSION',
  'a Terminus target from another mission is rejected'
);

select throws_ok(
  $$
    select * from public.create_crusade_submission(
      p_campaign_id => '00000000-0000-4000-8000-000000000001',
      p_mission_id => '00000000-0000-4000-8000-000000000201',
      p_kill_team_id => '00000000-0000-4000-8000-000000000501',
      p_submitting_discord_user_id => '900000000000000001',
      p_event_type => 'OBJECTIVE',
      p_evidence_original_filename => 'invalid-target-event.png',
      p_evidence_content_type => 'image/png',
      p_evidence_source_reference => 'discord-attachment:invalid-target-event',
      p_scoring_target_key => 'sandbox-terminus-target-alpha'
    )
  $$,
  'P0001',
  'SUBMISSION_TARGET_EVENT_INVALID',
  'non-Terminus submissions cannot carry a scoring target'
);

reset role;

select ok(
  exists (
    select 1
    from public.crusade_submissions
    where id = (
      current_setting('crusade.valid_submission', true)::jsonb
      ->> 'submission_id'
    )::uuid
      and campaign_id = '00000000-0000-4000-8000-000000000001'
      and mission_id = '00000000-0000-4000-8000-000000000201'
      and kill_team_id = '00000000-0000-4000-8000-000000000501'
      and submitting_discord_user_id = '900000000000000001'
      and evidence_source_reference = 'https://discord.invalid/attachments/objective-result.png'
  ),
  'the intake row derives and preserves authoritative identity and private evidence metadata'
);

select is(
  (
    select count(distinct receipt_reference)
    from public.crusade_submissions
  ),
  2::bigint,
  'concurrency-safe receipt references remain unique across submissions'
);

select is(
  (select count(*) from public.crusade_submissions),
  2::bigint,
  'an idempotent replay does not create a second row'
);

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select throws_ok(
  $$select count(*) from public.crusade_submissions$$,
  '42501',
  'permission denied for table crusade_submissions',
  'anonymous browser clients cannot read private submissions'
);

select throws_ok(
  $$
    insert into public.crusade_submissions (
      receipt_reference,
      campaign_id,
      mission_id,
      kill_team_id,
      submitting_discord_user_id,
      event_type,
      evidence_original_filename,
      evidence_content_type,
      evidence_source_reference
    ) values (
      'CR-90001',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000201',
      '00000000-0000-4000-8000-000000000501',
      '900000000000000001',
      'OBJECTIVE',
      'anon.png',
      'image/png',
      'discord-attachment:anon'
    )
  $$,
  '42501',
  'permission denied for table crusade_submissions',
  'anonymous browser clients cannot insert submission rows'
);

select throws_ok(
  $$
    select * from public.create_crusade_submission(
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000201',
      '00000000-0000-4000-8000-000000000501',
      '900000000000000001',
      'OBJECTIVE',
      'anon-rpc.png',
      'image/png',
      'discord-attachment:anon-rpc'
    )
  $$,
  '42501',
  'permission denied for function create_crusade_submission',
  'anonymous browser clients cannot execute trusted intake'
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

select is(
  (select count(*) from public.crusade_submissions),
  0::bigint,
  'authenticated Players cannot read private submission rows through RLS'
);

select throws_ok(
  $$
    insert into public.crusade_submissions (
      receipt_reference,
      campaign_id,
      mission_id,
      kill_team_id,
      submitting_discord_user_id,
      event_type,
      evidence_original_filename,
      evidence_content_type,
      evidence_source_reference
    ) values (
      'CR-90002',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000201',
      '00000000-0000-4000-8000-000000000501',
      '900000000000000001',
      'OBJECTIVE',
      'player.png',
      'image/png',
      'discord-attachment:player'
    )
  $$,
  '42501',
  'permission denied for table crusade_submissions',
  'authenticated Players cannot insert submission rows'
);

select throws_ok(
  $$
    select * from public.create_crusade_submission(
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000201',
      '00000000-0000-4000-8000-000000000501',
      '900000000000000001',
      'OBJECTIVE',
      'player-rpc.png',
      'image/png',
      'discord-attachment:player-rpc'
    )
  $$,
  '42501',
  'permission denied for function create_crusade_submission',
  'authenticated Players cannot execute trusted intake'
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
  (select count(*) from public.crusade_submissions),
  2::bigint,
  'Administrators can read private submission intake records'
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
  (select count(*) from public.crusade_submissions),
  2::bigint,
  'Moderators can read private submission intake records'
);

reset role;
set local role service_role;

select throws_ok(
  $$
    insert into public.crusade_submissions (
      receipt_reference,
      campaign_id,
      mission_id,
      kill_team_id,
      submitting_discord_user_id,
      event_type,
      evidence_original_filename,
      evidence_content_type,
      evidence_source_reference
    ) values (
      'CR-90003',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000201',
      '00000000-0000-4000-8000-000000000501',
      '900000000000000001',
      'OBJECTIVE',
      'service-direct.png',
      'image/png',
      'discord-attachment:service-direct'
    )
  $$,
  '42501',
  'permission denied for table crusade_submissions',
  'the trusted service must use the controlled intake RPC instead of direct inserts'
);

reset role;

select throws_ok(
  format(
    'update public.crusade_submissions set player_note = %L where id = %L',
    'mutated',
    current_setting('crusade.valid_submission', true)::jsonb
      ->> 'submission_id'
  ),
  'P0001',
  'CRUSADE_SUBMISSION_IMMUTABLE',
  'core submission history cannot be rewritten'
);

insert into public.crusade_submission_reviews (
  submission_id,
  status,
  reviewed_by,
  moderator_note
) values (
  (
    current_setting('crusade.valid_submission', true)::jsonb
    ->> 'submission_id'
  )::uuid,
  'REJECTED',
  'a0000000-0000-4000-8000-000000000001',
  'Synthetic final review fixture'
);

select is(
  (
    select status::text
    from public.crusade_submission_reviews
    where submission_id = (
      current_setting('crusade.valid_submission', true)::jsonb
      ->> 'submission_id'
    )::uuid
  ),
  'REJECTED',
  'a pending submission can receive one separate final review outcome'
);

select throws_ok(
  format(
    'insert into public.crusade_submission_reviews (submission_id, status, reviewed_by) values (%L, %L, %L)',
    current_setting('crusade.valid_submission', true)::jsonb
      ->> 'submission_id',
    'APPROVED',
    'a0000000-0000-4000-8000-000000000002'
  ),
  '23505',
  'duplicate key value violates unique constraint "crusade_submission_reviews_pkey"',
  'a submission cannot receive a second final outcome'
);

select throws_ok(
  format(
    'update public.crusade_submission_reviews set moderator_note = %L where submission_id = %L',
    'mutated',
    current_setting('crusade.valid_submission', true)::jsonb
      ->> 'submission_id'
  ),
  'P0001',
  'CRUSADE_SUBMISSION_REVIEW_IMMUTABLE',
  'final review history cannot be rewritten'
);

select throws_ok(
  format(
    'insert into public.crusade_submission_reviews (submission_id, status, reviewed_by) values (%L, %L, %L)',
    current_setting('crusade.target_submission', true)::jsonb
      ->> 'submission_id',
    'PENDING',
    'a0000000-0000-4000-8000-000000000001'
  ),
  '23514',
  'new row for relation "crusade_submission_reviews" violates check constraint "crusade_submission_reviews_final_status"',
  'PENDING is represented by no review row rather than a mutable decision row'
);

select is(
  (select count(*) from public.kill_team_progress_ledger),
  current_setting('crusade.submission_ledger_count_before', true)::bigint,
  'pending intake does not write to the Kill Team progress ledger'
);

select is(
  (
    select crusade_points
    from public.get_public_active_campaign()
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  current_setting('crusade.submission_points_before', true)::bigint,
  'pending intake does not change public Crusade points'
);

select is(
  (
    select revision
    from public.live_campaign_states
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  current_setting('crusade.submission_revision_before', true)::bigint,
  'pending intake does not increment the campaign revision'
);

select is(
  (
    select count(*)
    from public.campaign_updates
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  current_setting('crusade.submission_audit_count_before', true)::bigint,
  'pending intake does not create a scoring-style campaign audit entry'
);

select ok(
  not (public.get_public_sync_snapshot() ? 'crusade_submissions')
  and not (public.get_public_sync_snapshot() ? 'submissions'),
  'the public sync snapshot does not expose submission records'
);

select ok(
  position(
    '900000000000000001'
    in public.get_public_sync_snapshot()::text
  ) = 0,
  'the public sync snapshot does not expose submitting Discord identities'
);

select ok(
  position(
    'https://discord.invalid/attachments/objective-result.png'
    in public.get_public_sync_snapshot()::text
  ) = 0,
  'the public sync snapshot does not expose private evidence references'
);

select is(
  (
    select crusade_points
    from public.get_public_active_campaign()
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  24::bigint,
  'public Crusade progress remains based only on authoritative ledger entries'
);

select * from finish();
rollback;
