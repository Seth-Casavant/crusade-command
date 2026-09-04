begin;

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create trigger campaigns_set_updated_at
before update on public.campaigns
for each row execute function public.set_row_updated_at();

create trigger battlefields_set_updated_at
before update on public.battlefields
for each row execute function public.set_row_updated_at();

create trigger missions_set_updated_at
before update on public.missions
for each row execute function public.set_row_updated_at();

create trigger objectives_set_updated_at
before update on public.objectives
for each row execute function public.set_row_updated_at();

create trigger mission_enemy_entries_set_updated_at
before update on public.mission_enemy_entries
for each row execute function public.set_row_updated_at();

create trigger live_campaign_states_set_updated_at
before update on public.live_campaign_states
for each row execute function public.set_row_updated_at();

create or replace function public.create_campaign_live_state()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  insert into public.live_campaign_states (campaign_id)
  values (new.id);
  return new;
end;
$$;

create trigger campaigns_create_live_state
after insert on public.campaigns
for each row execute function public.create_campaign_live_state();

create or replace function public.prevent_campaign_update_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  raise exception using
    errcode = 'P0001',
    message = 'AUDIT_LOG_APPEND_ONLY';
end;
$$;

create trigger campaign_updates_append_only
before update or delete on public.campaign_updates
for each row execute function public.prevent_campaign_update_mutation();

create or replace function public.assert_mission_activation_ready(
  p_mission_id uuid,
  p_campaign_id uuid,
  p_battlefield_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_battlefield_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'ACTIVATION_VALIDATION_FAILED:BATTLEFIELD_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.campaigns as c
    where c.id = p_campaign_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'ACTIVATION_VALIDATION_FAILED:CAMPAIGN_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from public.live_campaign_states as lcs
    where lcs.campaign_id = p_campaign_id
      and lcs.campaign_progress between 0 and 100
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'ACTIVATION_VALIDATION_FAILED:INVALID_CAMPAIGN_PROGRESS';
  end if;

  if not exists (
    select 1
    from public.objectives as o
    where o.mission_id = p_mission_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'ACTIVATION_VALIDATION_FAILED:OBJECTIVE_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.mission_enemy_entries as mee
    where mee.mission_id = p_mission_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'ACTIVATION_VALIDATION_FAILED:ENEMY_REQUIRED';
  end if;

  if exists (
    select 1
    from public.missions as m
    where m.campaign_id = p_campaign_id
      and m.status = 'ACTIVE'
      and m.id <> p_mission_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'ACTIVE_MISSION_EXISTS';
  end if;
end;
$$;

create or replace function public.enforce_mission_rules()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'DRAFT' then
      raise exception using
        errcode = 'P0001',
        message = 'MISSION_MUST_START_DRAFT';
    end if;
    return new;
  end if;

  if old.battlefield_id is distinct from new.battlefield_id
     and old.status in ('ACTIVE', 'COMPLETE', 'ABORTED') then
    raise exception using
      errcode = 'P0001',
      message = 'BATTLEFIELD_LOCKED';
  end if;

  if old.status is distinct from new.status then
    if current_setting('crusade.authoritative_transition', true)
       is distinct from 'on' then
      raise exception using
        errcode = 'P0001',
        message = 'MISSION_STATUS_RPC_REQUIRED';
    end if;

    if not (
      (old.status = 'DRAFT' and new.status = 'READY')
      or (old.status = 'READY' and new.status = 'ACTIVE')
      or (old.status = 'ACTIVE' and new.status = 'COMPLETE')
      or (old.status = 'ACTIVE' and new.status = 'ABORTED')
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'INVALID_STATE_TRANSITION';
    end if;

    if new.status = 'ACTIVE' then
      perform public.assert_mission_activation_ready(
        new.id,
        new.campaign_id,
        new.battlefield_id
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger missions_enforce_rules
before insert or update on public.missions
for each row execute function public.enforce_mission_rules();

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
set search_path = pg_catalog, public, extensions
as $$
declare
  v_mission public.missions%rowtype;
  v_state public.live_campaign_states%rowtype;
  v_update_id uuid := extensions.gen_random_uuid();
  v_new_revision bigint;
  v_current_mission_id uuid;
  v_previous_transition_context text := coalesce(
    current_setting('crusade.authoritative_transition', true),
    'off'
  );
begin
  select m.*
  into v_mission
  from public.missions as m
  where m.id = p_mission_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'MISSION_NOT_FOUND';
  end if;

  select lcs.*
  into v_state
  from public.live_campaign_states as lcs
  where lcs.campaign_id = v_mission.campaign_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'LIVE_STATE_NOT_FOUND';
  end if;

  if v_state.revision <> p_expected_revision then
    raise exception using
      errcode = 'P0001',
      message = 'REVISION_CONFLICT';
  end if;

  if not (
    (v_mission.status = 'DRAFT' and p_new_status = 'READY')
    or (v_mission.status = 'READY' and p_new_status = 'ACTIVE')
    or (v_mission.status = 'ACTIVE' and p_new_status = 'COMPLETE')
    or (v_mission.status = 'ACTIVE' and p_new_status = 'ABORTED')
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_STATE_TRANSITION';
  end if;

  if p_new_status = 'ACTIVE' then
    perform public.assert_mission_activation_ready(
      v_mission.id,
      v_mission.campaign_id,
      v_mission.battlefield_id
    );
    v_current_mission_id := v_mission.id;
  else
    v_current_mission_id := v_state.current_mission_id;
  end if;

  perform set_config('crusade.authoritative_transition', 'on', true);

  update public.missions as m
  set status = p_new_status
  where m.id = v_mission.id;

  perform set_config(
    'crusade.authoritative_transition',
    v_previous_transition_context,
    true
  );

  update public.live_campaign_states as lcs
  set current_mission_id = v_current_mission_id,
      revision = lcs.revision + 1,
      last_update_id = v_update_id,
      updated_by = p_actor_id
  where lcs.campaign_id = v_mission.campaign_id
  returning lcs.revision into v_new_revision;

  if p_new_status = 'ACTIVE' then
    update public.campaigns as c
    set status = 'ACTIVE'
    where c.id = v_mission.campaign_id
      and c.status = 'DRAFT';
  end if;

  insert into public.campaign_updates (
    id,
    campaign_id,
    mission_id,
    previous_revision,
    new_revision,
    actor_id,
    change_type,
    old_values,
    new_values
  ) values (
    v_update_id,
    v_mission.campaign_id,
    v_mission.id,
    v_state.revision,
    v_new_revision,
    p_actor_id,
    'MISSION_TRANSITION',
    jsonb_build_object(
      'mission_status', v_mission.status,
      'current_mission_id', v_state.current_mission_id
    ),
    jsonb_build_object(
      'mission_status', p_new_status,
      'current_mission_id', v_current_mission_id
    )
  );

  return query
  select v_update_id, v_new_revision, p_new_status;
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
set search_path = pg_catalog, public, extensions
as $$
declare
  v_state public.live_campaign_states%rowtype;
  v_objective public.objectives%rowtype;
  v_mission_status public.mission_status;
  v_update_id uuid := extensions.gen_random_uuid();
  v_new_revision bigint;
  v_old_values jsonb := '{}'::jsonb;
  v_new_values jsonb := '{}'::jsonb;
begin
  select lcs.*
  into v_state
  from public.live_campaign_states as lcs
  where lcs.campaign_id = p_campaign_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'LIVE_STATE_NOT_FOUND';
  end if;

  if v_state.revision <> p_expected_revision then
    raise exception using
      errcode = 'P0001',
      message = 'REVISION_CONFLICT';
  end if;

  if p_new_progress is null and p_objective_id is null
     and p_new_objective_status is null then
    raise exception using
      errcode = 'P0001',
      message = 'NO_CHANGES_REQUESTED';
  end if;

  if p_new_progress is not null
     and (p_new_progress < 0 or p_new_progress > 100) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_CAMPAIGN_PROGRESS';
  end if;

  if (p_objective_id is null) <> (p_new_objective_status is null) then
    raise exception using
      errcode = 'P0001',
      message = 'OBJECTIVE_UPDATE_INCOMPLETE';
  end if;

  if p_objective_id is not null then
    if v_state.current_mission_id is null then
      raise exception using
        errcode = 'P0001',
        message = 'NO_CURRENT_MISSION';
    end if;

    select o.*
    into v_objective
    from public.objectives as o
    where o.id = p_objective_id
      and o.mission_id = v_state.current_mission_id
    for update;

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'OBJECTIVE_NOT_CURRENT';
    end if;

    select m.status
    into v_mission_status
    from public.missions as m
    where m.id = v_state.current_mission_id;

    if v_mission_status <> 'ACTIVE' then
      raise exception using
        errcode = 'P0001',
        message = 'MISSION_NOT_ACTIVE';
    end if;
  end if;

  if p_new_progress is not null then
    v_old_values := v_old_values || jsonb_build_object(
      'campaign_progress', v_state.campaign_progress
    );
    v_new_values := v_new_values || jsonb_build_object(
      'campaign_progress', p_new_progress
    );
  end if;

  if p_objective_id is not null then
    v_old_values := v_old_values || jsonb_build_object(
      'objective_id', p_objective_id,
      'objective_status', v_objective.status
    );
    v_new_values := v_new_values || jsonb_build_object(
      'objective_id', p_objective_id,
      'objective_status', p_new_objective_status
    );

    update public.objectives as o
    set status = p_new_objective_status
    where o.id = p_objective_id;
  end if;

  update public.live_campaign_states as lcs
  set campaign_progress = coalesce(
        p_new_progress::smallint,
        lcs.campaign_progress
      ),
      revision = lcs.revision + 1,
      last_update_id = v_update_id,
      updated_by = p_actor_id
  where lcs.campaign_id = p_campaign_id
  returning lcs.revision into v_new_revision;

  insert into public.campaign_updates (
    id,
    campaign_id,
    mission_id,
    previous_revision,
    new_revision,
    actor_id,
    change_type,
    old_values,
    new_values
  ) values (
    v_update_id,
    p_campaign_id,
    v_state.current_mission_id,
    v_state.revision,
    v_new_revision,
    p_actor_id,
    'LIVE_STATE_UPDATE',
    v_old_values,
    v_new_values
  );

  return query
  select v_update_id, v_new_revision;
end;
$$;

revoke all on function public.set_row_updated_at() from public, anon, authenticated;
revoke all on function public.create_campaign_live_state() from public, anon, authenticated;
revoke all on function public.prevent_campaign_update_mutation() from public, anon, authenticated;
revoke all on function public.assert_mission_activation_ready(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.enforce_mission_rules() from public, anon, authenticated;
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

commit;
