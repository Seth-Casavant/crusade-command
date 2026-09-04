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
grant execute on function extensions.lives_ok(text, text)
  to anon, authenticated;

select plan(28);

select has_table(
  'public',
  'public_campaign_sync_signals',
  'Phase 4 has a dedicated public Realtime signal table'
);

select is(
  (
    select c.relrowsecurity
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'public_campaign_sync_signals'
  ),
  true,
  'the public signal table has RLS enabled'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'public_campaign_sync_signals'
  ),
  'only the minimal signal table is added to the Realtime publication'
);

select is(
  (select count(*) from public.public_campaign_sync_signals),
  1::bigint,
  'sandbox activation creates one public synchronization signal'
);

select is(
  (
    select revision
    from public.public_campaign_sync_signals
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  3::bigint,
  'the initial signal matches the activation revision'
);

select is(
  (
    select is_active
    from public.public_campaign_sync_signals
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  true,
  'the activation signal identifies an ACTIVE public state'
);

select is(
  (
    select signal.update_id
    from public.public_campaign_sync_signals as signal
    where signal.campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  (
    select state.last_update_id
    from public.live_campaign_states as state
    where state.campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  'the public signal references the authoritative update identifier'
);

select is(
  (public.get_public_sync_snapshot() ->> 'active_campaign_count')::integer,
  1,
  'the atomic public snapshot reports one ACTIVE campaign'
);

select is(
  public.get_public_sync_snapshot() -> 'campaign' ->> 'mission_status',
  'ACTIVE',
  'the atomic public snapshot contains the ACTIVE mission'
);

select ok(
  not (
    (public.get_public_sync_snapshot() -> 'campaign') ? 'updated_by'
  ) and not (
    (public.get_public_sync_snapshot() -> 'campaign') ? 'actor_id'
  ),
  'the synchronization snapshot contains no actor or audit identifiers'
);

select set_config(
  'request.jwt.claims',
  '{"role":"anon"}',
  true
);
set local role anon;

select is(
  (select count(*) from public.public_campaign_sync_signals),
  1::bigint,
  'anonymous Realtime clients can read only synchronization metadata'
);

select is(
  (
    select revision
    from public.get_public_latest_sync_signal()
  ),
  3::bigint,
  'anonymous clients can perform a lightweight revision check'
);

select is(
  public.get_public_sync_snapshot() -> 'campaign' ->> 'mission_status',
  'ACTIVE',
  'anonymous clients can fetch the complete public snapshot'
);

select throws_ok(
  $$
    insert into public.public_campaign_sync_signals (
      campaign_id,
      revision,
      update_id,
      is_active,
      published_at
    ) values (
      '00000000-0000-4000-8000-000000000001',
      99,
      '90000000-0000-4000-8000-000000000001',
      true,
      statement_timestamp()
    )
  $$,
  '42501',
  'permission denied for table public_campaign_sync_signals',
  'anonymous clients cannot insert synchronization signals'
);

select throws_ok(
  $$
    update public.public_campaign_sync_signals
    set revision = 99
  $$,
  '42501',
  'permission denied for table public_campaign_sync_signals',
  'anonymous clients cannot forge newer synchronization revisions'
);

select throws_ok(
  'delete from public.public_campaign_sync_signals',
  '42501',
  'permission denied for table public_campaign_sync_signals',
  'anonymous clients cannot delete synchronization signals'
);

select throws_ok(
  'select count(*) from public.campaigns',
  '42501',
  'permission denied for table campaigns',
  'Realtime access does not expose the underlying campaign table'
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
    update public.public_campaign_sync_signals
    set revision = 99
  $$,
  '42501',
  'permission denied for table public_campaign_sync_signals',
  'an authenticated Administrator cannot write signal rows directly'
);

select lives_ok(
  $$
    select * from public.update_campaign_live_state(
      '00000000-0000-4000-8000-000000000001',
      3,
      12
    )
  $$,
  'an authoritative committed update creates a Realtime notification'
);

select is(
  (
    select revision
    from public.public_campaign_sync_signals
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  4::bigint,
  'the signal advances to the new authoritative revision'
);

select is(
  (
    select signal.update_id
    from public.public_campaign_sync_signals as signal
    where signal.campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  (
    select state.last_update_id
    from public.live_campaign_states as state
    where state.campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  'the signal remains tied to the committed update ID'
);

select is(
  (
    select signal.published_at
    from public.public_campaign_sync_signals as signal
    where signal.campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  (
    select update.occurred_at
    from public.campaign_updates as update
    where update.campaign_id = '00000000-0000-4000-8000-000000000001'
      and update.new_revision = 4
  ),
  'the signal uses the authoritative audit timestamp'
);

reset role;
select set_config('request.jwt.claims', '{}', true);

insert into public.campaigns (id, name)
values (
  '70000000-0000-4000-8000-000000000001',
  'Realtime Lifecycle Campaign'
);

insert into public.missions (
  id,
  campaign_id,
  battlefield_id,
  name,
  enemy_faction
) values (
  '70000000-0000-4000-8000-000000000002',
  '70000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000101',
  'Realtime Lifecycle Mission',
  'Signal Test Hostiles'
);

insert into public.objectives (id, mission_id, title, sort_order)
values (
  '70000000-0000-4000-8000-000000000003',
  '70000000-0000-4000-8000-000000000002',
  'Signal Test Objective',
  0
);

insert into public.mission_enemy_entries (
  id,
  mission_id,
  name,
  sort_order
) values (
  '70000000-0000-4000-8000-000000000004',
  '70000000-0000-4000-8000-000000000002',
  'Signal Test Enemy',
  0
);

select lives_ok(
  $$
    select * from public.transition_mission_state(
      '70000000-0000-4000-8000-000000000002',
      1,
      'READY'
    )
  $$,
  'a DRAFT mission still transitions to READY normally'
);

select is(
  (
    select count(*)
    from public.public_campaign_sync_signals
    where campaign_id = '70000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'DRAFT and READY preparation does not publish Player-facing signals'
);

select lives_ok(
  $$
    select * from public.transition_mission_state(
      '70000000-0000-4000-8000-000000000002',
      2,
      'ACTIVE'
    )
  $$,
  'mission activation publishes the first Player-facing signal'
);

select is(
  (
    select revision
    from public.public_campaign_sync_signals
    where campaign_id = '70000000-0000-4000-8000-000000000001'
      and is_active
  ),
  3::bigint,
  'the activation signal carries the activation revision'
);

select lives_ok(
  $$
    select * from public.transition_mission_state(
      '70000000-0000-4000-8000-000000000002',
      3,
      'COMPLETE'
    )
  $$,
  'mission completion publishes a closing signal'
);

select is(
  (
    select revision
    from public.public_campaign_sync_signals
    where campaign_id = '70000000-0000-4000-8000-000000000001'
      and not is_active
  ),
  4::bigint,
  'the closing signal tells clients to refetch and remove inactive state'
);

select * from finish();
rollback;
