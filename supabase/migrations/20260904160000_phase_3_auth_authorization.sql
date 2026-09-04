begin;

create type public.app_role as enum (
  'ADMINISTRATOR',
  'MODERATOR',
  'PLAYER'
);

create table public.app_users (
  user_id uuid primary key references auth.users(id)
    on update restrict on delete restrict,
  role public.app_role not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create unique index app_users_single_administrator
  on public.app_users (role)
  where role = 'ADMINISTRATOR';

create unique index app_users_single_moderator
  on public.app_users (role)
  where role = 'MODERATOR';

alter table public.live_campaign_states
  add constraint live_campaign_states_updated_by_auth_user_fk
  foreign key (updated_by) references auth.users(id)
  on update restrict on delete restrict;

alter table public.campaign_updates
  add constraint campaign_updates_actor_auth_user_fk
  foreign key (actor_id) references auth.users(id)
  on update restrict on delete restrict;

comment on table public.app_users is
  'Application roles linked to Supabase Auth. Version 1 permits one protected Administrator and at most one Moderator.';

create trigger app_users_set_updated_at
before update on public.app_users
for each row execute function public.set_row_updated_at();

create or replace function public.protect_primary_administrator()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.role = 'ADMINISTRATOR' then
    raise exception using
      errcode = 'P0001',
      message = 'PRIMARY_ADMINISTRATOR_PROTECTED';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger app_users_protect_primary_administrator
before update or delete on public.app_users
for each row execute function public.protect_primary_administrator();

alter table public.app_users enable row level security;

revoke all on table public.app_users from public, anon, authenticated;
revoke all on function public.protect_primary_administrator()
  from public, anon, authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.is_trusted_database_session()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select session_user in ('postgres', 'supabase_admin')
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select au.role
  from public.app_users as au
  where au.user_id = auth.uid()
$$;

create or replace function private.require_authorized_writer()
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
begin
  if private.is_trusted_database_session() and auth.uid() is null then
    return;
  end if;

  if auth.role() = 'service_role' then
    return;
  end if;

  if coalesce(
    public.current_app_role() in ('ADMINISTRATOR', 'MODERATOR'),
    false
  ) then
    return;
  end if;

  raise exception using
    errcode = 'P0001',
    message = 'AUTHORIZATION_REQUIRED';
end;
$$;

create or replace function private.require_administrator()
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
begin
  if private.is_trusted_database_session() and auth.uid() is null then
    return;
  end if;

  if auth.role() = 'service_role' then
    return;
  end if;

  if coalesce(public.current_app_role() = 'ADMINISTRATOR', false) then
    return;
  end if;

  raise exception using
    errcode = 'P0001',
    message = 'ADMINISTRATOR_REQUIRED';
end;
$$;

create or replace function private.authoritative_actor(
  p_supplied_actor_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, auth, private
as $$
declare
  v_authenticated_user_id uuid := auth.uid();
begin
  if v_authenticated_user_id is not null then
    return v_authenticated_user_id;
  end if;

  if private.is_trusted_database_session() or auth.role() = 'service_role' then
    return p_supplied_actor_id;
  end if;

  return null;
end;
$$;

revoke all on function private.is_trusted_database_session()
  from public, anon, authenticated;
revoke all on function private.require_authorized_writer()
  from public, anon, authenticated;
revoke all on function private.require_administrator()
  from public, anon, authenticated;
revoke all on function private.authoritative_actor(uuid)
  from public, anon, authenticated;

alter function public.transition_mission_state(
  uuid,
  bigint,
  public.mission_status,
  uuid
) set schema private;

alter function public.update_campaign_live_state(
  uuid,
  bigint,
  integer,
  uuid,
  public.objective_status,
  uuid
) set schema private;

revoke all on function private.transition_mission_state(
  uuid,
  bigint,
  public.mission_status,
  uuid
) from public, anon, authenticated;

revoke all on function private.update_campaign_live_state(
  uuid,
  bigint,
  integer,
  uuid,
  public.objective_status,
  uuid
) from public, anon, authenticated;

create or replace function public.transition_mission_state(
  p_mission_id uuid,
  p_expected_revision bigint,
  p_new_status public.mission_status,
  p_actor_id uuid default null
)
returns table (
  update_id uuid,
  new_revision bigint,
  mission_state public.mission_status
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor_id uuid;
begin
  perform private.require_authorized_writer();
  v_actor_id := private.authoritative_actor(p_actor_id);

  return query
  select command.update_id, command.new_revision, command.mission_state
  from private.transition_mission_state(
    p_mission_id,
    p_expected_revision,
    p_new_status,
    v_actor_id
  ) as command;
end;
$$;

create or replace function public.update_campaign_live_state(
  p_campaign_id uuid,
  p_expected_revision bigint,
  p_new_progress integer default null,
  p_objective_id uuid default null,
  p_new_objective_status public.objective_status default null,
  p_actor_id uuid default null
)
returns table (
  update_id uuid,
  new_revision bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor_id uuid;
begin
  perform private.require_authorized_writer();
  v_actor_id := private.authoritative_actor(p_actor_id);

  return query
  select command.update_id, command.new_revision
  from private.update_campaign_live_state(
    p_campaign_id,
    p_expected_revision,
    p_new_progress,
    p_objective_id,
    p_new_objective_status,
    v_actor_id
  ) as command;
end;
$$;

create or replace function public.assign_moderator(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private
as $$
begin
  perform private.require_administrator();

  if not exists (
    select 1
    from auth.users as auth_user
    where auth_user.id = p_user_id
      and auth_user.deleted_at is null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'AUTH_USER_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.app_users as au
    where au.user_id = p_user_id
      and au.role = 'ADMINISTRATOR'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'PRIMARY_ADMINISTRATOR_PROTECTED';
  end if;

  if exists (
    select 1
    from public.app_users as au
    where au.role = 'MODERATOR'
      and au.user_id <> p_user_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'MODERATOR_ALREADY_ASSIGNED';
  end if;

  insert into public.app_users (user_id, role)
  values (p_user_id, 'MODERATOR')
  on conflict (user_id) do update
  set role = excluded.role;
exception
  when unique_violation then
    raise exception using
      errcode = 'P0001',
      message = 'MODERATOR_ALREADY_ASSIGNED';
end;
$$;

create or replace function public.get_public_active_campaign()
returns table (
  campaign_id uuid,
  campaign_name text,
  campaign_description text,
  mission_id uuid,
  mission_name text,
  mission_description text,
  mission_status public.mission_status,
  battlefield_id uuid,
  battlefield_name text,
  battlefield_description text,
  enemy_faction text,
  campaign_progress smallint,
  revision bigint,
  updated_at timestamptz,
  objectives jsonb,
  enemies jsonb
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    c.id,
    c.name,
    coalesce(c.description, ''),
    m.id,
    m.name,
    coalesce(m.description, ''),
    m.status,
    b.id,
    b.name,
    coalesce(b.description, ''),
    coalesce(m.enemy_faction, ''),
    lcs.campaign_progress,
    lcs.revision,
    lcs.updated_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', o.id,
            'title', o.title,
            'description', o.description,
            'status', o.status,
            'sort_order', o.sort_order
          ) order by o.sort_order, o.id
        )
        from public.objectives as o
        where o.mission_id = m.id
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', mee.id,
            'name', mee.name,
            'enemy_type', mee.enemy_type,
            'description', mee.description,
            'sort_order', mee.sort_order
          ) order by mee.sort_order, mee.id
        )
        from public.mission_enemy_entries as mee
        where mee.mission_id = m.id
      ),
      '[]'::jsonb
    )
  from public.live_campaign_states as lcs
  join public.campaigns as c on c.id = lcs.campaign_id
  join public.missions as m on m.id = lcs.current_mission_id
  join public.battlefields as b on b.id = m.battlefield_id
  where c.status = 'ACTIVE'
    and m.status = 'ACTIVE'
  order by c.created_at, c.id
$$;

revoke all on function public.current_app_role()
  from public, anon, authenticated;
revoke all on function public.transition_mission_state(
  uuid,
  bigint,
  public.mission_status,
  uuid
) from public, anon, authenticated;
revoke all on function public.update_campaign_live_state(
  uuid,
  bigint,
  integer,
  uuid,
  public.objective_status,
  uuid
) from public, anon, authenticated;
revoke all on function public.assign_moderator(uuid)
  from public, anon, authenticated;
revoke all on function public.get_public_active_campaign()
  from public, anon, authenticated;

grant usage on type public.app_role to authenticated;
grant usage on type public.mission_status to anon, authenticated;
grant usage on type public.objective_status to authenticated;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.transition_mission_state(
  uuid,
  bigint,
  public.mission_status,
  uuid
) to authenticated;
grant execute on function public.update_campaign_live_state(
  uuid,
  bigint,
  integer,
  uuid,
  public.objective_status,
  uuid
) to authenticated;
grant execute on function public.assign_moderator(uuid) to authenticated;
grant execute on function public.get_public_active_campaign()
  to anon, authenticated;

grant select on table public.campaigns to authenticated;
grant select on table public.battlefields to authenticated;
grant select on table public.missions to authenticated;
grant select on table public.objectives to authenticated;
grant select on table public.mission_enemy_entries to authenticated;
grant select on table public.live_campaign_states to authenticated;
grant select on table public.campaign_updates to authenticated;
grant select on table public.app_users to authenticated;

create policy campaign_staff_read
on public.campaigns
for select
to authenticated
using (
  (select public.current_app_role()) in ('ADMINISTRATOR', 'MODERATOR')
);

create policy battlefield_staff_read
on public.battlefields
for select
to authenticated
using (
  (select public.current_app_role()) in ('ADMINISTRATOR', 'MODERATOR')
);

create policy mission_staff_read
on public.missions
for select
to authenticated
using (
  (select public.current_app_role()) in ('ADMINISTRATOR', 'MODERATOR')
);

create policy objective_staff_read
on public.objectives
for select
to authenticated
using (
  (select public.current_app_role()) in ('ADMINISTRATOR', 'MODERATOR')
);

create policy enemy_staff_read
on public.mission_enemy_entries
for select
to authenticated
using (
  (select public.current_app_role()) in ('ADMINISTRATOR', 'MODERATOR')
);

create policy live_state_staff_read
on public.live_campaign_states
for select
to authenticated
using (
  (select public.current_app_role()) in ('ADMINISTRATOR', 'MODERATOR')
);

create policy audit_staff_read
on public.campaign_updates
for select
to authenticated
using (
  (select public.current_app_role()) in ('ADMINISTRATOR', 'MODERATOR')
);

create policy administrator_role_read
on public.app_users
for select
to authenticated
using (
  (select public.current_app_role()) = 'ADMINISTRATOR'
);

commit;
