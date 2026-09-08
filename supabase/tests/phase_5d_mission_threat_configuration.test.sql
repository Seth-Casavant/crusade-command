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

select plan(23);

select has_table(
  'public',
  'mission_crusade_scoring_targets',
  'mission-owned Crusade scoring targets have a durable authoritative table'
);

select is(
  (
    select c.relrowsecurity
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'mission_crusade_scoring_targets'
  ),
  true,
  'Crusade scoring target configuration has RLS enabled'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'missions'
      and column_name = 'mission_boss_key'
  ),
  'missions retain a stable mission-boss key'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'missions'
      and column_name = 'mission_boss_display_name'
  ),
  'missions retain a mission-boss display name'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mission_crusade_scoring_targets'
      and column_name = 'target_key'
  ),
  'scoring targets retain a stable machine-readable key'
);

select is(
  (
    select mission_boss ->> 'id'
    from public.get_public_active_campaign()
  ),
  'sandbox-mission-boss',
  'the public read model exposes the configured mission-boss key'
);

select is(
  (
    select mission_boss ->> 'name'
    from public.get_public_active_campaign()
  ),
  'Sandbox Mission Boss',
  'the public read model exposes the configured mission-boss display name'
);

select is(
  (
    select jsonb_array_length(crusade_scoring_targets)
    from public.get_public_active_campaign()
  ),
  2,
  'the public read model exposes two configured scoring targets'
);

select is(
  (
    select crusade_scoring_targets -> 0 ->> 'id'
    from public.get_public_active_campaign()
  ),
  'sandbox-terminus-target-alpha',
  'the first scoring target retains its stable identity'
);

select is(
  (
    select crusade_scoring_targets -> 1 ->> 'id'
    from public.get_public_active_campaign()
  ),
  'sandbox-terminus-target-beta',
  'scoring targets preserve their configured order and stable identity'
);

select is(
  public.get_public_sync_snapshot() -> 'campaign' -> 'mission_boss' ->> 'id',
  'sandbox-mission-boss',
  'the existing public synchronization snapshot carries mission-boss metadata'
);

select is(
  public.get_public_sync_snapshot() -> 'campaign' -> 'crusade_scoring_targets' -> 1 ->> 'name',
  'Sandbox Terminus Target Beta',
  'the existing public synchronization snapshot carries scoring targets'
);

select is(
  (public.get_public_sync_snapshot() -> 'campaign' ->> 'revision')::bigint,
  (
    select revision
    from public.live_campaign_states
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  'threat metadata uses the existing authoritative campaign revision'
);

select set_config(
  'request.jwt.claims',
  '{"role":"anon"}',
  true
);
set local role anon;

select is(
  public.get_public_sync_snapshot() -> 'campaign' -> 'mission_boss' ->> 'id',
  'sandbox-mission-boss',
  'anonymous viewers receive configured threat metadata only through the public snapshot'
);

select throws_ok(
  'select count(*) from public.mission_crusade_scoring_targets',
  '42501',
  'permission denied for table mission_crusade_scoring_targets',
  'anonymous viewers cannot query threat configuration directly'
);

select throws_ok(
  $$
    insert into public.mission_crusade_scoring_targets (
      mission_id,
      target_key,
      display_name,
      sort_order
    ) values (
      '00000000-0000-4000-8000-000000000201',
      'anonymous-attack',
      'Anonymous Attack',
      99
    )
  $$,
  '42501',
  'permission denied for table mission_crusade_scoring_targets',
  'anonymous viewers cannot write threat configuration'
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
  (select count(*) from public.mission_crusade_scoring_targets),
  2::bigint,
  'the Administrator retains staff read access to threat configuration'
);

select throws_ok(
  $$
    insert into public.mission_crusade_scoring_targets (
      mission_id,
      target_key,
      display_name,
      sort_order
    ) values (
      '00000000-0000-4000-8000-000000000201',
      'administrator-attack',
      'Administrator Attack',
      98
    )
  $$,
  '42501',
  'permission denied for table mission_crusade_scoring_targets',
  'the Administrator has no new direct-write bypass'
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
  (select count(*) from public.mission_crusade_scoring_targets),
  2::bigint,
  'the Moderator retains staff read access to threat configuration'
);

select throws_ok(
  $$
    update public.mission_crusade_scoring_targets
    set display_name = 'Moderator Attack'
    where mission_id = '00000000-0000-4000-8000-000000000201'
  $$,
  '42501',
  'permission denied for table mission_crusade_scoring_targets',
  'the Moderator has no new direct-write bypass'
);

reset role;

select set_config(
  'crusade.test_threat_revision',
  (
    select revision::text
    from public.live_campaign_states
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  true
);

update public.missions
set
  mission_boss_key = null,
  mission_boss_display_name = null
where id = '00000000-0000-4000-8000-000000000201';

delete from public.mission_crusade_scoring_targets
where mission_id = '00000000-0000-4000-8000-000000000201';

select is(
  (
    select mission_boss
    from public.get_public_active_campaign()
  ),
  null::jsonb,
  'an unconfigured mission boss is safe in the public read model'
);

select is(
  (
    select crusade_scoring_targets
    from public.get_public_active_campaign()
  ),
  '[]'::jsonb,
  'zero configured scoring targets are safe in the public read model'
);

select is(
  public.get_public_sync_snapshot() -> 'campaign' ->> 'revision',
  current_setting('crusade.test_threat_revision', true),
  'threat configuration does not create a separate public revision stream'
);

select * from finish();
rollback;
