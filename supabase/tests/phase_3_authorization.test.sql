begin;

create extension if not exists pgtap;
set local search_path = public, extensions, pg_catalog;

-- pgTAP assertions execute while impersonating API roles. These grants exist
-- only inside this rolled-back test transaction.
grant usage on schema extensions to anon, authenticated;
grant execute on function extensions.is(anyelement, anyelement, text)
  to anon, authenticated;
grant execute on function extensions.ok(boolean, text)
  to anon, authenticated;
grant execute on function extensions.throws_ok(text, character, text, text)
  to anon, authenticated;
grant execute on function extensions.lives_ok(text, text)
  to anon, authenticated;
grant execute on function extensions.finish(boolean)
  to anon, authenticated;

select plan(62);

insert into auth.users (id)
values
  ('a0000000-0000-4000-8000-000000000004'),
  ('a0000000-0000-4000-8000-000000000005');

insert into public.campaigns (id, name)
values (
  '60000000-0000-4000-8000-000000000001',
  'Private Draft Campaign'
);

insert into public.missions (
  id,
  campaign_id,
  battlefield_id,
  name,
  enemy_faction
) values (
  '60000000-0000-4000-8000-000000000002',
  '60000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000101',
  'Private Draft Mission',
  'Unpublished Hostiles'
);

select has_type(
  'public',
  'app_role',
  'application roles use a controlled database type'
);

select has_table(
  'public',
  'app_users',
  'application identities are linked in a dedicated table'
);

select is(
  (
    select c.relrowsecurity
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'app_users'
  ),
  true,
  'application identity rows have RLS enabled'
);

select is(
  (
    select count(*)::integer
    from public.app_users
    where role = 'ADMINISTRATOR'
  ),
  1,
  'exactly one sandbox Administrator is assigned'
);

select is(
  (
    select count(*)::integer
    from public.app_users
    where role = 'MODERATOR'
  ),
  1,
  'at most one sandbox Moderator is assigned'
);

select throws_ok(
  $$
    insert into public.app_users (user_id, role)
    values (
      'a0000000-0000-4000-8000-000000000004',
      'ADMINISTRATOR'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "app_users_single_administrator"',
  'a second Administrator is rejected by the database'
);

select throws_ok(
  $$
    insert into public.app_users (user_id, role)
    values (
      'a0000000-0000-4000-8000-000000000005',
      'MODERATOR'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "app_users_single_moderator"',
  'a second Moderator is rejected by the database'
);

select throws_ok(
  $$
    update public.app_users
    set role = 'PLAYER'
    where user_id = 'a0000000-0000-4000-8000-000000000001'
  $$,
  'P0001',
  'PRIMARY_ADMINISTRATOR_PROTECTED',
  'the primary Administrator role cannot be changed ordinarily'
);

select throws_ok(
  $$
    delete from public.app_users
    where user_id = 'a0000000-0000-4000-8000-000000000001'
  $$,
  'P0001',
  'PRIMARY_ADMINISTRATOR_PROTECTED',
  'the primary Administrator identity cannot be deleted ordinarily'
);

select set_config(
  'request.jwt.claims',
  '{"role":"anon"}',
  true
);
set local role anon;

select is(
  (select count(*) from public.get_public_active_campaign()),
  1::bigint,
  'anonymous viewers can retrieve the intentionally published ACTIVE mission'
);

select is(
  (
    select mission_status::text
    from public.get_public_active_campaign()
  ),
  'ACTIVE',
  'the public read model contains only ACTIVE mission state'
);

select ok(
  (
    select objectives @> '[{"title":"Secure the relay nexus"}]'::jsonb
    from public.get_public_active_campaign()
  ),
  'published objectives are available through the public read model'
);

select ok(
  (
    select enemies @> '[{"name":"Sandbox Vanguard"}]'::jsonb
    from public.get_public_active_campaign()
  ),
  'published enemy information is available through the public read model'
);

select is(
  (
    select count(*)
    from public.get_public_active_campaign()
    where campaign_id = '60000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'draft campaigns are excluded from anonymous results'
);

select ok(
  (
    select not (to_jsonb(public_state) ? 'updated_by')
      and not (to_jsonb(public_state) ? 'actor_id')
    from public.get_public_active_campaign() as public_state
  ),
  'the public result omits actor and audit identifiers'
);

select throws_ok(
  'select count(*) from public.campaigns',
  '42501',
  'permission denied for table campaigns',
  'anonymous viewers cannot query campaign tables directly'
);

select throws_ok(
  'select count(*) from public.campaign_updates',
  '42501',
  'permission denied for table campaign_updates',
  'anonymous viewers cannot retrieve audit history'
);

select throws_ok(
  'select count(*) from public.app_users',
  '42501',
  'permission denied for table app_users',
  'anonymous viewers cannot retrieve role assignments'
);

select throws_ok(
  $$insert into public.campaigns (name) values ('Anonymous Attack')$$,
  '42501',
  'permission denied for table campaigns',
  'anonymous viewers cannot insert campaign state'
);

select throws_ok(
  $$
    update public.campaigns
    set name = 'Anonymous Attack'
    where id = '00000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'permission denied for table campaigns',
  'anonymous viewers cannot update campaign state'
);

select throws_ok(
  $$
    delete from public.campaigns
    where id = '00000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'permission denied for table campaigns',
  'anonymous viewers cannot delete campaign state'
);

select throws_ok(
  $$
    select * from public.update_campaign_live_state(
      '00000000-0000-4000-8000-000000000001',
      3,
      10
    )
  $$,
  '42501',
  'permission denied for function update_campaign_live_state',
  'anonymous requests cannot invoke authoritative write functions'
);

select throws_ok(
  $$
    select public.assign_moderator(
      'a0000000-0000-4000-8000-000000000003'
    )
  $$,
  '42501',
  'permission denied for function assign_moderator',
  'an unauthenticated request cannot assign or promote a role'
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
  public.current_app_role()::text,
  'PLAYER',
  'an authenticated Player role is loaded from the database'
);

select is(
  (select count(*) from public.get_public_active_campaign()),
  1::bigint,
  'an authenticated Player can use the same public read model'
);

select is(
  (select count(*) from public.campaigns),
  0::bigint,
  'RLS prevents a Player from reading campaign tables directly'
);

select is(
  (select count(*) from public.campaign_updates),
  0::bigint,
  'RLS prevents a Player from reading audit history'
);

select is(
  (select count(*) from public.app_users),
  0::bigint,
  'RLS prevents a Player from reading role assignments'
);

select throws_ok(
  $$
    update public.campaigns
    set name = 'Player Attack'
    where id = '00000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'permission denied for table campaigns',
  'an authenticated Player cannot update campaign state directly'
);

select throws_ok(
  $$
    select * from public.update_campaign_live_state(
      '00000000-0000-4000-8000-000000000001',
      3,
      10
    )
  $$,
  'P0001',
  'AUTHORIZATION_REQUIRED',
  'an authenticated Player cannot use an authoritative write function'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'role', 'authenticated',
    'sub', 'a0000000-0000-4000-8000-000000000003',
    'app_role', 'ADMINISTRATOR',
    'user_metadata', jsonb_build_object('role', 'ADMINISTRATOR')
  )::text,
  true
);

select is(
  public.current_app_role()::text,
  'PLAYER',
  'forged frontend role strings do not change database authority'
);

select throws_ok(
  $$
    update public.app_users
    set role = 'ADMINISTRATOR'
    where user_id = 'a0000000-0000-4000-8000-000000000003'
  $$,
  '42501',
  'permission denied for table app_users',
  'a Player cannot overwrite its database role'
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
  public.current_app_role()::text,
  'MODERATOR',
  'the designated Moderator role is loaded from the database'
);

select ok(
  (select count(*) > 0 from public.campaigns),
  'the Moderator may read campaign-management data'
);

select ok(
  (select count(*) > 0 from public.campaign_updates),
  'the Moderator may read campaign audit history'
);

select is(
  (select count(*) from public.app_users),
  0::bigint,
  'the Moderator cannot retrieve role assignments'
);

select lives_ok(
  $$
    select * from public.update_campaign_live_state(
      '00000000-0000-4000-8000-000000000001',
      3,
      10,
      null,
      null,
      'a0000000-0000-4000-8000-000000000001'
    )
  $$,
  'the Moderator can perform an authorized atomic live update'
);

select is(
  (
    select revision
    from public.live_campaign_states
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  4::bigint,
  'the Moderator update increments the shared revision once'
);

select is(
  (
    select updated_by
    from public.live_campaign_states
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  'a0000000-0000-4000-8000-000000000002'::uuid,
  'the database ignores a forged actor and records the authenticated Moderator'
);

select is(
  (
    select actor_id
    from public.campaign_updates
    where campaign_id = '00000000-0000-4000-8000-000000000001'
      and new_revision = 4
  ),
  'a0000000-0000-4000-8000-000000000002'::uuid,
  'the Moderator audit entry records the authenticated identity'
);

select throws_ok(
  $$
    select * from public.update_campaign_live_state(
      '00000000-0000-4000-8000-000000000001',
      3,
      20
    )
  $$,
  'P0001',
  'REVISION_CONFLICT',
  'the Moderator cannot bypass stale-revision protection'
);

select is(
  (
    select revision
    from public.live_campaign_states
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  4::bigint,
  'a rejected stale Moderator update leaves revision unchanged'
);

select throws_ok(
  $$
    update public.missions
    set battlefield_id = '00000000-0000-4000-8000-000000000102'
    where id = '00000000-0000-4000-8000-000000000201'
  $$,
  '42501',
  'permission denied for table missions',
  'the Moderator cannot directly change the ACTIVE battlefield'
);

select throws_ok(
  $$
    select * from public.transition_mission_state(
      '00000000-0000-4000-8000-000000000201',
      4,
      'READY'
    )
  $$,
  'P0001',
  'INVALID_STATE_TRANSITION',
  'the Moderator cannot request an invalid state transition'
);

select throws_ok(
  $$
    select public.assign_moderator(
      'a0000000-0000-4000-8000-000000000002'
    )
  $$,
  'P0001',
  'ADMINISTRATOR_REQUIRED',
  'the Moderator cannot assign roles or promote itself'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'role', 'authenticated',
    'sub', 'a0000000-0000-4000-8000-000000000002',
    'app_role', 'ADMINISTRATOR'
  )::text,
  true
);

select is(
  public.current_app_role()::text,
  'MODERATOR',
  'a forged Administrator claim does not elevate the Moderator'
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
  public.current_app_role()::text,
  'ADMINISTRATOR',
  'the protected primary Administrator role is loaded from the database'
);

select is(
  (select count(*) from public.app_users),
  3::bigint,
  'only the Administrator may retrieve application role assignments'
);

select lives_ok(
  $$
    select * from public.update_campaign_live_state(
      '00000000-0000-4000-8000-000000000001',
      4,
      20
    )
  $$,
  'the Administrator can perform an authorized live update'
);

select is(
  (
    select revision
    from public.live_campaign_states
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  5::bigint,
  'the Administrator update increments the shared revision once'
);

select is(
  (
    select campaign_progress::integer
    from public.live_campaign_states
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  20,
  'the Administrator update stores the requested progress'
);

select is(
  (
    select updated_by
    from public.live_campaign_states
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  'a0000000-0000-4000-8000-000000000001'::uuid,
  'the Administrator update records the authenticated identity'
);

select throws_ok(
  $$
    select * from public.update_campaign_live_state(
      '00000000-0000-4000-8000-000000000001',
      5,
      -1
    )
  $$,
  'P0001',
  'INVALID_CAMPAIGN_PROGRESS',
  'the Administrator cannot bypass Phase 2 progress constraints'
);

select is(
  (
    select revision
    from public.live_campaign_states
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  ),
  5::bigint,
  'a rejected Administrator update does not increment revision'
);

select throws_ok(
  $$
    update public.live_campaign_states
    set campaign_progress = 30
    where campaign_id = '00000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'permission denied for table live_campaign_states',
  'the Administrator cannot bypass RPC validation with a direct table update'
);

select throws_ok(
  $$
    select * from public.transition_mission_state(
      '00000000-0000-4000-8000-000000000201',
      5,
      'READY'
    )
  $$,
  'P0001',
  'INVALID_STATE_TRANSITION',
  'the Administrator cannot bypass Phase 2 transition rules'
);

select lives_ok(
  $$
    select public.assign_moderator(
      'a0000000-0000-4000-8000-000000000002'
    )
  $$,
  'assigning the existing Moderator is idempotent for the Administrator'
);

select throws_ok(
  $$
    select public.assign_moderator(
      'a0000000-0000-4000-8000-000000000003'
    )
  $$,
  'P0001',
  'MODERATOR_ALREADY_ASSIGNED',
  'the Administrator cannot accidentally assign a second Moderator'
);

select is(
  (
    select count(*)::integer
    from public.app_users
    where role = 'MODERATOR'
  ),
  1,
  'failed role assignment preserves the single-Moderator rule'
);

select is(
  (
    select campaign_progress::integer
    from public.get_public_active_campaign()
  ),
  20,
  'the public read model reflects the latest authoritative progress'
);

select is(
  (
    select revision
    from public.get_public_active_campaign()
  ),
  5::bigint,
  'the public read model reflects the latest authoritative revision'
);

select is(
  (
    select count(*)
    from public.get_public_active_campaign()
    where campaign_id = '60000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'draft data remains excluded after authorized updates'
);

select * from finish();
rollback;
