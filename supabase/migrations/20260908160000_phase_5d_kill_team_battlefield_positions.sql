begin;

alter type public.campaign_update_type
  add value if not exists 'KILL_TEAM_POSITION';

create table public.mission_battlefield_checkpoints (
  id uuid primary key default extensions.gen_random_uuid(),
  mission_id uuid not null references public.missions(id)
    on update restrict on delete cascade,
  checkpoint_key text not null,
  name text not null,
  normalized_x double precision not null,
  normalized_y double precision not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint mission_battlefield_checkpoints_mission_and_id_unique unique (mission_id, id),
  constraint mission_battlefield_checkpoints_mission_key_unique unique (mission_id, checkpoint_key),
  constraint mission_battlefield_checkpoints_mission_sort_unique unique (mission_id, sort_order),
  constraint mission_battlefield_checkpoints_key_not_blank check (length(btrim(checkpoint_key)) > 0),
  constraint mission_battlefield_checkpoints_name_not_blank check (length(btrim(name)) > 0),
  constraint mission_battlefield_checkpoints_x_in_range check (normalized_x >= 0 and normalized_x <= 1),
  constraint mission_battlefield_checkpoints_y_in_range check (normalized_y >= 0 and normalized_y <= 1),
  constraint mission_battlefield_checkpoints_sort_nonnegative check (sort_order >= 0)
);

create index mission_battlefield_checkpoints_mission_id_idx
  on public.mission_battlefield_checkpoints(mission_id);

create trigger mission_battlefield_checkpoints_set_updated_at
before update on public.mission_battlefield_checkpoints
for each row execute function public.set_row_updated_at();

create or replace function public.enforce_mission_checkpoint_configuration_lock()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_mission_id uuid;
  v_status public.mission_status;
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.mission_id is distinct from old.mission_id
       or new.checkpoint_key is distinct from old.checkpoint_key then
      raise exception using errcode = 'P0001', message = 'MISSION_CHECKPOINT_IDENTITY_IMMUTABLE';
    end if;
  end if;

  v_mission_id := case when tg_op = 'INSERT' then new.mission_id else old.mission_id end;
  select status into v_status from public.missions where id = v_mission_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'MISSION_NOT_FOUND';
  end if;

  if v_status not in ('DRAFT', 'READY') then
    raise exception using errcode = 'P0001', message = 'MISSION_CHECKPOINT_CONFIGURATION_LOCKED';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger mission_battlefield_checkpoints_enforce_configuration_lock
before insert or update or delete on public.mission_battlefield_checkpoints
for each row execute function public.enforce_mission_checkpoint_configuration_lock();

alter table public.mission_battlefield_checkpoints enable row level security;
revoke all on table public.mission_battlefield_checkpoints from public, anon, authenticated;
grant select on table public.mission_battlefield_checkpoints to authenticated;

create policy mission_battlefield_checkpoints_staff_read
on public.mission_battlefield_checkpoints
for select to authenticated
using ((select public.current_app_role()) in ('ADMINISTRATOR', 'MODERATOR'));

alter table public.kill_teams
  add column current_checkpoint_id uuid,
  add constraint kill_teams_current_checkpoint_mission_fk
    foreign key (mission_id, current_checkpoint_id)
    references public.mission_battlefield_checkpoints(mission_id, id)
    on update restrict on delete restrict;

create index kill_teams_current_checkpoint_id_idx
  on public.kill_teams(current_checkpoint_id)
  where current_checkpoint_id is not null;

create or replace function public.enforce_kill_team_registration_lock()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_mission_id uuid;
  v_mission_status public.mission_status;
  v_position_changed boolean := false;
begin
  if tg_table_name = 'kill_teams' then
    if tg_op = 'UPDATE' and new.mission_id is distinct from old.mission_id then
      raise exception using errcode = 'P0001', message = 'KILL_TEAM_MISSION_IMMUTABLE';
    end if;

    v_position_changed := tg_op = 'UPDATE'
      and new.current_checkpoint_id is distinct from old.current_checkpoint_id;

    if v_position_changed then
      if current_setting('crusade.kill_team_position_write', true) is distinct from 'on'
         or new.name is distinct from old.name
         or new.id is distinct from old.id
         or new.created_at is distinct from old.created_at then
        raise exception using errcode = 'P0001', message = 'KILL_TEAM_POSITION_RPC_REQUIRED';
      end if;
    end if;

    v_mission_id := case when tg_op = 'INSERT' then new.mission_id else old.mission_id end;
  else
    if tg_op = 'UPDATE' then
      if new.id is distinct from old.id then
        raise exception using errcode = 'P0001', message = 'KILL_TEAM_MEMBER_ID_IMMUTABLE';
      end if;
      if new.kill_team_id is distinct from old.kill_team_id
         or new.mission_id is distinct from old.mission_id then
        raise exception using errcode = 'P0001', message = 'KILL_TEAM_MEMBERSHIP_IMMUTABLE';
      end if;
    end if;
    v_mission_id := case when tg_op = 'INSERT' then new.mission_id else old.mission_id end;
  end if;

  select m.status into v_mission_status from public.missions as m where m.id = v_mission_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'MISSION_NOT_FOUND';
  end if;

  if v_position_changed then
    if v_mission_status in ('COMPLETE', 'ABORTED') then
      raise exception using errcode = 'P0001', message = 'KILL_TEAM_POSITION_LOCKED';
    end if;
    return new;
  end if;

  if v_mission_status not in ('DRAFT', 'READY') then
    raise exception using errcode = 'P0001', message = 'KILL_TEAM_REGISTRATION_LOCKED';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.lock_mission_checkpoint_configuration(
  p_mission_id uuid,
  p_expected_revision bigint
)
returns table (campaign_id uuid, previous_revision bigint)
language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_mission public.missions%rowtype;
  v_state public.live_campaign_states%rowtype;
begin
  select * into v_mission from public.missions where id = p_mission_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'MISSION_NOT_FOUND'; end if;
  if v_mission.status not in ('DRAFT', 'READY') then
    raise exception using errcode = 'P0001', message = 'MISSION_CHECKPOINT_CONFIGURATION_LOCKED';
  end if;
  select lcs.* into v_state from public.live_campaign_states as lcs where lcs.campaign_id = v_mission.campaign_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'LIVE_STATE_NOT_FOUND'; end if;
  if v_state.revision <> p_expected_revision then raise exception using errcode = 'P0001', message = 'REVISION_CONFLICT'; end if;
  return query select v_mission.campaign_id, v_state.revision;
end;
$$;

create or replace function private.lock_kill_team_position(
  p_mission_id uuid,
  p_expected_revision bigint
)
returns table (campaign_id uuid, previous_revision bigint)
language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_mission public.missions%rowtype;
  v_state public.live_campaign_states%rowtype;
begin
  select * into v_mission from public.missions where id = p_mission_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'MISSION_NOT_FOUND'; end if;
  if v_mission.status not in ('DRAFT', 'READY', 'ACTIVE') then
    raise exception using errcode = 'P0001', message = 'KILL_TEAM_POSITION_LOCKED';
  end if;
  select lcs.* into v_state from public.live_campaign_states as lcs where lcs.campaign_id = v_mission.campaign_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'LIVE_STATE_NOT_FOUND'; end if;
  if v_state.revision <> p_expected_revision then raise exception using errcode = 'P0001', message = 'REVISION_CONFLICT'; end if;
  return query select v_mission.campaign_id, v_state.revision;
end;
$$;

create or replace function private.record_kill_team_position_update(
  p_campaign_id uuid,
  p_mission_id uuid,
  p_previous_revision bigint,
  p_actor_id uuid,
  p_old_values jsonb,
  p_new_values jsonb
)
returns table (update_id uuid, new_revision bigint)
language plpgsql security definer
set search_path = pg_catalog, public, extensions, private
as $$
declare
  v_update_id uuid := extensions.gen_random_uuid();
  v_new_revision bigint;
begin
  update public.live_campaign_states as lcs
  set revision = lcs.revision + 1, last_update_id = v_update_id, updated_by = p_actor_id
  where lcs.campaign_id = p_campaign_id and lcs.revision = p_previous_revision
  returning lcs.revision into v_new_revision;
  if not found then raise exception using errcode = 'P0001', message = 'REVISION_CONFLICT'; end if;
  insert into public.campaign_updates (
    id, campaign_id, mission_id, previous_revision, new_revision, actor_id, change_type, old_values, new_values
  ) values (
    v_update_id, p_campaign_id, p_mission_id, p_previous_revision, v_new_revision, p_actor_id,
    'KILL_TEAM_POSITION', p_old_values, p_new_values
  );
  return query select v_update_id, v_new_revision;
end;
$$;

create or replace function private.create_mission_battlefield_checkpoint(
  p_mission_id uuid, p_expected_revision bigint, p_checkpoint_key text, p_name text,
  p_normalized_x double precision, p_normalized_y double precision, p_sort_order integer, p_actor_id uuid
)
returns table (checkpoint_id uuid, update_id uuid, new_revision bigint)
language plpgsql security definer
set search_path = pg_catalog, public, extensions, private
as $$
declare v_campaign_id uuid; v_previous_revision bigint; v_checkpoint_id uuid; v_update_id uuid; v_new_revision bigint;
begin
  if length(btrim(coalesce(p_checkpoint_key, ''))) = 0 or length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception using errcode = 'P0001', message = 'MISSION_CHECKPOINT_NAME_AND_KEY_REQUIRED';
  end if;
  select lock.campaign_id, lock.previous_revision into v_campaign_id, v_previous_revision
  from private.lock_mission_checkpoint_configuration(p_mission_id, p_expected_revision) as lock;
  insert into public.mission_battlefield_checkpoints (mission_id, checkpoint_key, name, normalized_x, normalized_y, sort_order)
  values (p_mission_id, p_checkpoint_key, p_name, p_normalized_x, p_normalized_y, p_sort_order)
  returning id into v_checkpoint_id;
  select record.update_id, record.new_revision into v_update_id, v_new_revision from private.record_kill_team_position_update(
    v_campaign_id, p_mission_id, v_previous_revision, p_actor_id, '{}'::jsonb,
    jsonb_build_object('action', 'CHECKPOINT_CREATED', 'checkpoint_id', v_checkpoint_id, 'checkpoint_key', p_checkpoint_key, 'name', p_name, 'x', p_normalized_x, 'y', p_normalized_y, 'sort_order', p_sort_order)
  ) as record;
  return query select v_checkpoint_id, v_update_id, v_new_revision;
end;
$$;

create or replace function private.update_mission_battlefield_checkpoint(
  p_checkpoint_id uuid, p_expected_revision bigint, p_name text,
  p_normalized_x double precision, p_normalized_y double precision, p_sort_order integer, p_actor_id uuid
)
returns table (update_id uuid, new_revision bigint)
language plpgsql security definer
set search_path = pg_catalog, public, extensions, private
as $$
declare v_checkpoint public.mission_battlefield_checkpoints%rowtype; v_campaign_id uuid; v_previous_revision bigint; v_update_id uuid; v_new_revision bigint;
begin
  if length(btrim(coalesce(p_name, ''))) = 0 then raise exception using errcode = 'P0001', message = 'MISSION_CHECKPOINT_NAME_REQUIRED'; end if;
  select * into v_checkpoint from public.mission_battlefield_checkpoints where id = p_checkpoint_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'MISSION_CHECKPOINT_NOT_FOUND'; end if;
  select lock.campaign_id, lock.previous_revision into v_campaign_id, v_previous_revision
  from private.lock_mission_checkpoint_configuration(v_checkpoint.mission_id, p_expected_revision) as lock;
  update public.mission_battlefield_checkpoints
  set name = p_name, normalized_x = p_normalized_x, normalized_y = p_normalized_y, sort_order = p_sort_order
  where id = v_checkpoint.id;
  select record.update_id, record.new_revision into v_update_id, v_new_revision from private.record_kill_team_position_update(
    v_campaign_id, v_checkpoint.mission_id, v_previous_revision, p_actor_id,
    jsonb_build_object('action', 'CHECKPOINT_UPDATED', 'checkpoint_id', v_checkpoint.id, 'checkpoint_key', v_checkpoint.checkpoint_key, 'name', v_checkpoint.name, 'x', v_checkpoint.normalized_x, 'y', v_checkpoint.normalized_y, 'sort_order', v_checkpoint.sort_order),
    jsonb_build_object('action', 'CHECKPOINT_UPDATED', 'checkpoint_id', v_checkpoint.id, 'checkpoint_key', v_checkpoint.checkpoint_key, 'name', p_name, 'x', p_normalized_x, 'y', p_normalized_y, 'sort_order', p_sort_order)
  ) as record;
  return query select v_update_id, v_new_revision;
end;
$$;

create or replace function private.delete_mission_battlefield_checkpoint(
  p_checkpoint_id uuid, p_expected_revision bigint, p_actor_id uuid
)
returns table (update_id uuid, new_revision bigint)
language plpgsql security definer
set search_path = pg_catalog, public, extensions, private
as $$
declare v_checkpoint public.mission_battlefield_checkpoints%rowtype; v_campaign_id uuid; v_previous_revision bigint; v_update_id uuid; v_new_revision bigint;
begin
  select * into v_checkpoint from public.mission_battlefield_checkpoints where id = p_checkpoint_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'MISSION_CHECKPOINT_NOT_FOUND'; end if;
  select lock.campaign_id, lock.previous_revision into v_campaign_id, v_previous_revision
  from private.lock_mission_checkpoint_configuration(v_checkpoint.mission_id, p_expected_revision) as lock;
  delete from public.mission_battlefield_checkpoints where id = v_checkpoint.id;
  select record.update_id, record.new_revision into v_update_id, v_new_revision from private.record_kill_team_position_update(
    v_campaign_id, v_checkpoint.mission_id, v_previous_revision, p_actor_id,
    jsonb_build_object('action', 'CHECKPOINT_DELETED', 'checkpoint_id', v_checkpoint.id, 'checkpoint_key', v_checkpoint.checkpoint_key, 'name', v_checkpoint.name, 'x', v_checkpoint.normalized_x, 'y', v_checkpoint.normalized_y, 'sort_order', v_checkpoint.sort_order),
    '{}'::jsonb
  ) as record;
  return query select v_update_id, v_new_revision;
end;
$$;

create or replace function private.assign_kill_team_checkpoint(
  p_kill_team_id uuid, p_checkpoint_id uuid, p_expected_revision bigint, p_actor_id uuid
)
returns table (update_id uuid, new_revision bigint)
language plpgsql security definer
set search_path = pg_catalog, public, extensions, private
as $$
declare v_team public.kill_teams%rowtype; v_campaign_id uuid; v_previous_revision bigint; v_update_id uuid; v_new_revision bigint;
begin
  select * into v_team from public.kill_teams where id = p_kill_team_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'KILL_TEAM_NOT_FOUND'; end if;
  select lock.campaign_id, lock.previous_revision into v_campaign_id, v_previous_revision
  from private.lock_kill_team_position(v_team.mission_id, p_expected_revision) as lock;
  if p_checkpoint_id is not null then
    perform 1 from public.mission_battlefield_checkpoints
    where id = p_checkpoint_id and mission_id = v_team.mission_id for update;
    if not found then raise exception using errcode = 'P0001', message = 'KILL_TEAM_CHECKPOINT_NOT_FOUND_FOR_MISSION'; end if;
  end if;
  if v_team.current_checkpoint_id is not distinct from p_checkpoint_id then
    raise exception using errcode = 'P0001', message = 'KILL_TEAM_CHECKPOINT_UNCHANGED';
  end if;
  perform set_config('crusade.kill_team_position_write', 'on', true);
  update public.kill_teams set current_checkpoint_id = p_checkpoint_id where id = v_team.id;
  select record.update_id, record.new_revision into v_update_id, v_new_revision from private.record_kill_team_position_update(
    v_campaign_id, v_team.mission_id, v_previous_revision, p_actor_id,
    jsonb_build_object('action', 'POSITION_UPDATED', 'kill_team_id', v_team.id, 'current_checkpoint_id', v_team.current_checkpoint_id),
    jsonb_build_object('action', 'POSITION_UPDATED', 'kill_team_id', v_team.id, 'current_checkpoint_id', p_checkpoint_id)
  ) as record;
  return query select v_update_id, v_new_revision;
end;
$$;

create or replace function public.create_mission_battlefield_checkpoint(
  p_mission_id uuid, p_expected_revision bigint, p_checkpoint_key text, p_name text,
  p_normalized_x double precision, p_normalized_y double precision, p_sort_order integer, p_actor_id uuid default null
)
returns table (checkpoint_id uuid, update_id uuid, new_revision bigint)
language plpgsql security definer
set search_path = pg_catalog, public, private
as $$ declare v_actor_id uuid; begin
  perform private.require_authorized_writer(); v_actor_id := private.authoritative_actor(p_actor_id);
  return query select * from private.create_mission_battlefield_checkpoint(p_mission_id, p_expected_revision, p_checkpoint_key, p_name, p_normalized_x, p_normalized_y, p_sort_order, v_actor_id);
end; $$;

create or replace function public.update_mission_battlefield_checkpoint(
  p_checkpoint_id uuid, p_expected_revision bigint, p_name text,
  p_normalized_x double precision, p_normalized_y double precision, p_sort_order integer, p_actor_id uuid default null
)
returns table (update_id uuid, new_revision bigint)
language plpgsql security definer
set search_path = pg_catalog, public, private
as $$ declare v_actor_id uuid; begin
  perform private.require_authorized_writer(); v_actor_id := private.authoritative_actor(p_actor_id);
  return query select * from private.update_mission_battlefield_checkpoint(p_checkpoint_id, p_expected_revision, p_name, p_normalized_x, p_normalized_y, p_sort_order, v_actor_id);
end; $$;

create or replace function public.delete_mission_battlefield_checkpoint(
  p_checkpoint_id uuid, p_expected_revision bigint, p_actor_id uuid default null
)
returns table (update_id uuid, new_revision bigint)
language plpgsql security definer
set search_path = pg_catalog, public, private
as $$ declare v_actor_id uuid; begin
  perform private.require_authorized_writer(); v_actor_id := private.authoritative_actor(p_actor_id);
  return query select * from private.delete_mission_battlefield_checkpoint(p_checkpoint_id, p_expected_revision, v_actor_id);
end; $$;

create or replace function public.assign_kill_team_checkpoint(
  p_kill_team_id uuid, p_checkpoint_id uuid, p_expected_revision bigint, p_actor_id uuid default null
)
returns table (update_id uuid, new_revision bigint)
language plpgsql security definer
set search_path = pg_catalog, public, private
as $$ declare v_actor_id uuid; begin
  perform private.require_authorized_writer(); v_actor_id := private.authoritative_actor(p_actor_id);
  return query select * from private.assign_kill_team_checkpoint(p_kill_team_id, p_checkpoint_id, p_expected_revision, v_actor_id);
end; $$;

revoke all on function public.enforce_mission_checkpoint_configuration_lock() from public, anon, authenticated;
revoke all on function public.enforce_kill_team_registration_lock() from public, anon, authenticated;
revoke all on function private.lock_mission_checkpoint_configuration(uuid, bigint) from public, anon, authenticated;
revoke all on function private.lock_kill_team_position(uuid, bigint) from public, anon, authenticated;
revoke all on function private.record_kill_team_position_update(uuid, uuid, bigint, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.create_mission_battlefield_checkpoint(uuid, bigint, text, text, double precision, double precision, integer, uuid) from public, anon, authenticated;
revoke all on function private.update_mission_battlefield_checkpoint(uuid, bigint, text, double precision, double precision, integer, uuid) from public, anon, authenticated;
revoke all on function private.delete_mission_battlefield_checkpoint(uuid, bigint, uuid) from public, anon, authenticated;
revoke all on function private.assign_kill_team_checkpoint(uuid, uuid, bigint, uuid) from public, anon, authenticated;
revoke all on function public.create_mission_battlefield_checkpoint(uuid, bigint, text, text, double precision, double precision, integer, uuid) from public, anon, authenticated;
revoke all on function public.update_mission_battlefield_checkpoint(uuid, bigint, text, double precision, double precision, integer, uuid) from public, anon, authenticated;
revoke all on function public.delete_mission_battlefield_checkpoint(uuid, bigint, uuid) from public, anon, authenticated;
revoke all on function public.assign_kill_team_checkpoint(uuid, uuid, bigint, uuid) from public, anon, authenticated;
grant execute on function public.create_mission_battlefield_checkpoint(uuid, bigint, text, text, double precision, double precision, integer, uuid) to authenticated;
grant execute on function public.update_mission_battlefield_checkpoint(uuid, bigint, text, double precision, double precision, integer, uuid) to authenticated;
grant execute on function public.delete_mission_battlefield_checkpoint(uuid, bigint, uuid) to authenticated;
grant execute on function public.assign_kill_team_checkpoint(uuid, uuid, bigint, uuid) to authenticated;

create or replace function private.publish_public_campaign_sync_signal()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare v_transition_status text; v_is_active boolean;
begin
  if new.change_type = 'MISSION_TRANSITION' then
    v_transition_status := new.new_values ->> 'mission_status';
    if v_transition_status = 'ACTIVE' then v_is_active := true;
    elsif v_transition_status in ('COMPLETE', 'ABORTED') then v_is_active := false;
    else return new; end if;
  elsif new.change_type in ('LIVE_STATE_UPDATE', 'KILL_TEAM_REGISTRATION', 'KILL_TEAM_POSITION') then
    select exists (
      select 1 from public.live_campaign_states as lcs join public.missions as m on m.id = lcs.current_mission_id
      where lcs.campaign_id = new.campaign_id and m.status = 'ACTIVE'
    ) into v_is_active;
    if not v_is_active then return new; end if;
  else return new; end if;
  insert into public.public_campaign_sync_signals (campaign_id, revision, update_id, is_active, published_at)
  values (new.campaign_id, new.new_revision, new.id, v_is_active, new.occurred_at)
  on conflict (campaign_id) do update set revision = excluded.revision, update_id = excluded.update_id, is_active = excluded.is_active, published_at = excluded.published_at
  where excluded.revision > public_campaign_sync_signals.revision;
  return new;
end;
$$;

drop function public.get_public_sync_snapshot();
drop function public.get_public_active_campaign();

create function public.get_public_active_campaign()
returns table (
  campaign_id uuid, campaign_name text, campaign_description text, mission_id uuid, mission_name text,
  mission_description text, mission_status public.mission_status, battlefield_id uuid, battlefield_name text,
  battlefield_description text, enemy_faction text, campaign_progress smallint, revision bigint, updated_at timestamptz,
  objectives jsonb, enemies jsonb, mission_boss jsonb, crusade_scoring_targets jsonb,
  battlefield_checkpoints jsonb, kill_teams jsonb
)
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select c.id, c.name, coalesce(c.description, ''), m.id, m.name, coalesce(m.description, ''), m.status,
    b.id, b.name, coalesce(b.description, ''), coalesce(m.enemy_faction, ''), lcs.campaign_progress, lcs.revision, lcs.updated_at,
    coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'title', o.title, 'description', o.description, 'status', o.status, 'sort_order', o.sort_order) order by o.sort_order, o.id) from public.objectives o where o.mission_id = m.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', mee.id, 'name', mee.name, 'enemy_type', mee.enemy_type, 'description', mee.description, 'sort_order', mee.sort_order) order by mee.sort_order, mee.id) from public.mission_enemy_entries mee where mee.mission_id = m.id), '[]'::jsonb),
    case when m.mission_boss_key is null then null::jsonb else jsonb_build_object('id', m.mission_boss_key, 'name', m.mission_boss_display_name, 'description', null) end,
    coalesce((select jsonb_agg(jsonb_build_object('id', target.target_key, 'name', target.display_name, 'description', null, 'sort_order', target.sort_order) order by target.sort_order, target.target_key) from public.mission_crusade_scoring_targets target where target.mission_id = m.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', checkpoint.id, 'key', checkpoint.checkpoint_key, 'name', checkpoint.name, 'x', checkpoint.normalized_x, 'y', checkpoint.normalized_y, 'sort_order', checkpoint.sort_order) order by checkpoint.sort_order, checkpoint.id) from public.mission_battlefield_checkpoints checkpoint where checkpoint.mission_id = m.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', team.id, 'name', team.name, 'current_checkpoint_id', team.current_checkpoint_id, 'members', coalesce((select jsonb_agg(jsonb_build_object('display_name', member.display_name) order by member.display_name, member.id) from public.kill_team_members member where member.kill_team_id = team.id), '[]'::jsonb)) order by team.name, team.id) from public.kill_teams team where team.mission_id = m.id), '[]'::jsonb)
  from public.live_campaign_states lcs
  join public.campaigns c on c.id = lcs.campaign_id
  join public.missions m on m.id = lcs.current_mission_id
  join public.battlefields b on b.id = m.battlefield_id
  where c.status = 'ACTIVE' and m.status = 'ACTIVE'
  order by c.created_at, c.id
$$;

create function public.get_public_sync_snapshot()
returns jsonb language sql stable security definer
set search_path = pg_catalog, public
as $$
  with active_campaigns as materialized (select * from public.get_public_active_campaign()),
  latest_signal as materialized (select * from public.get_public_latest_sync_signal())
  select jsonb_build_object('active_campaign_count', (select count(*) from active_campaigns), 'campaign', (select to_jsonb(active_campaign) from active_campaigns active_campaign limit 1), 'signal', (select to_jsonb(signal) from latest_signal signal))
$$;

revoke all on function private.publish_public_campaign_sync_signal() from public, anon, authenticated;
revoke all on function public.get_public_active_campaign() from public, anon, authenticated;
revoke all on function public.get_public_sync_snapshot() from public, anon, authenticated;
grant execute on function public.get_public_active_campaign() to anon, authenticated;
grant execute on function public.get_public_sync_snapshot() to anon, authenticated;

commit;
