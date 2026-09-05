begin;

create extension if not exists pgtap;
set local search_path = public, extensions, pg_catalog;

grant usage on schema extensions to authenticated;
grant execute on function extensions.is(anyelement, anyelement, text)
  to authenticated;
grant execute on function extensions.throws_ok(text, character, text, text)
  to authenticated;

select plan(6);

insert into auth.users (id)
values ('a0000000-0000-4000-8000-000000000099');

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'role', 'authenticated',
    'sub', 'a0000000-0000-4000-8000-000000000099'
  )::text,
  true
);
set local role authenticated;

select is(
  public.current_app_role(),
  null::public.app_role,
  'an authenticated but unmapped user receives no application role'
);

select is(
  public.get_public_sync_snapshot() -> 'campaign' ->> 'mission_status',
  'ACTIVE',
  'an unmapped authenticated user retains the public ACTIVE read model'
);

select is(
  (select count(*) from public.campaigns),
  0::bigint,
  'an unmapped authenticated user cannot read management campaigns'
);

select is(
  (select count(*) from public.campaign_updates),
  0::bigint,
  'an unmapped authenticated user cannot read audit history'
);

select is(
  (select count(*) from public.app_users),
  0::bigint,
  'an unmapped authenticated user cannot read role assignments'
);

select throws_ok(
  $$
    select * from public.update_campaign_live_state(
      '00000000-0000-4000-8000-000000000001',
      3,
      25
    )
  $$,
  'P0001',
  'AUTHORIZATION_REQUIRED',
  'an unmapped authenticated user cannot invoke authoritative writes'
);

select * from finish();
rollback;
