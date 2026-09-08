begin;

alter type public.campaign_update_type
  add value if not exists 'KILL_TEAM_REGISTRATION';

create table public.kill_teams (
  id uuid primary key default extensions.gen_random_uuid(),
  mission_id uuid not null references public.missions(id)
    on update restrict on delete cascade,
  name text not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint kill_teams_name_not_blank check (length(btrim(name)) > 0),
  constraint kill_teams_mission_and_id_unique unique (mission_id, id),
  constraint kill_teams_mission_name_unique unique (mission_id, name)
);

create table public.kill_team_members (
  id uuid primary key default extensions.gen_random_uuid(),
  kill_team_id uuid not null,
  mission_id uuid not null,
  discord_user_id text not null,
  display_name text not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint kill_team_members_team_mission_fk foreign key (kill_team_id, mission_id)
    references public.kill_teams(id, mission_id)
    on update restrict on delete cascade,
  constraint kill_team_members_discord_user_id_format check (
    discord_user_id ~ '^[0-9]{17,20}$'
  ),
  constraint kill_team_members_display_name_not_blank check (
    length(btrim(display_name)) > 0
  ),
  constraint kill_team_members_mission_discord_user_unique unique (
    mission_id,
    discord_user_id
  )
);

create index kill_teams_mission_id_idx on public.kill_teams(mission_id);
create index kill_team_members_kill_team_id_idx
  on public.kill_team_members(kill_team_id);

create trigger kill_teams_set_updated_at
before update on public.kill_teams
for each row execute function public.set_row_updated_at();

create or replace function public.enforce_kill_team_registration_lock()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_mission_id uuid;
  v_mission_status public.mission_status;
begin
  if tg_table_name = 'kill_teams' then
    if tg_op = 'UPDATE' and new.mission_id is distinct from old.mission_id then
      raise exception using
        errcode = 'P0001',
        message = 'KILL_TEAM_MISSION_IMMUTABLE';
    end if;

    v_mission_id := case when tg_op = 'INSERT' then new.mission_id else old.mission_id end;
  else
    if tg_op = 'UPDATE' then
      if new.id is distinct from old.id then
        raise exception using
          errcode = 'P0001',
          message = 'KILL_TEAM_MEMBER_ID_IMMUTABLE';
      end if;

      if new.kill_team_id is distinct from old.kill_team_id
         or new.mission_id is distinct from old.mission_id then
        raise exception using
          errcode = 'P0001',
          message = 'KILL_TEAM_MEMBERSHIP_IMMUTABLE';
      end if;
    end if;

    v_mission_id := case when tg_op = 'INSERT' then new.mission_id else old.mission_id end;
  end if;

  select m.status
  into v_mission_status
  from public.missions as m
  where m.id = v_mission_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'MISSION_NOT_FOUND';
  end if;

  if v_mission_status not in ('DRAFT', 'READY') then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_REGISTRATION_LOCKED';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger kill_teams_enforce_registration_lock
before insert or update or delete on public.kill_teams
for each row execute function public.enforce_kill_team_registration_lock();

create trigger kill_team_members_enforce_registration_lock
before insert or update or delete on public.kill_team_members
for each row execute function public.enforce_kill_team_registration_lock();

alter table public.kill_teams enable row level security;
alter table public.kill_team_members enable row level security;

revoke all on table public.kill_teams from public, anon, authenticated;
revoke all on table public.kill_team_members from public, anon, authenticated;

grant select on table public.kill_teams to authenticated;
grant select on table public.kill_team_members to authenticated;

create policy kill_teams_staff_read
on public.kill_teams
for select
to authenticated
using (
  (select public.current_app_role()) in ('ADMINISTRATOR', 'MODERATOR')
);

create policy kill_team_members_staff_read
on public.kill_team_members
for select
to authenticated
using (
  (select public.current_app_role()) in ('ADMINISTRATOR', 'MODERATOR')
);

create or replace function private.validate_kill_team_members(
  p_members jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if jsonb_typeof(p_members) <> 'array' or jsonb_array_length(p_members) = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_MEMBERS_REQUIRED';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_members) as entry(value)
    where jsonb_typeof(entry.value) <> 'object'
       or coalesce(entry.value ->> 'discord_user_id', '') !~ '^[0-9]{17,20}$'
       or length(btrim(coalesce(entry.value ->> 'display_name', ''))) = 0
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_MEMBER_INVALID';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_members) as member(
      discord_user_id text,
      display_name text
    )
    group by member.discord_user_id
    having count(*) > 1
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_MEMBER_DUPLICATE';
  end if;
end;
$$;

create or replace function private.lock_kill_team_registration(
  p_mission_id uuid,
  p_expected_revision bigint
)
returns table (
  campaign_id uuid,
  previous_revision bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_mission public.missions%rowtype;
  v_state public.live_campaign_states%rowtype;
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

  if v_mission.status not in ('DRAFT', 'READY') then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_REGISTRATION_LOCKED';
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

  return query select v_mission.campaign_id, v_state.revision;
end;
$$;

create or replace function private.record_kill_team_registration_update(
  p_campaign_id uuid,
  p_mission_id uuid,
  p_previous_revision bigint,
  p_actor_id uuid,
  p_old_values jsonb,
  p_new_values jsonb
)
returns table (
  update_id uuid,
  new_revision bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, private
as $$
declare
  v_update_id uuid := extensions.gen_random_uuid();
  v_new_revision bigint;
begin
  update public.live_campaign_states as lcs
  set revision = lcs.revision + 1,
      last_update_id = v_update_id,
      updated_by = p_actor_id
  where lcs.campaign_id = p_campaign_id
    and lcs.revision = p_previous_revision
  returning lcs.revision into v_new_revision;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'REVISION_CONFLICT';
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
    p_campaign_id,
    p_mission_id,
    p_previous_revision,
    v_new_revision,
    p_actor_id,
    'KILL_TEAM_REGISTRATION',
    p_old_values,
    p_new_values
  );

  return query select v_update_id, v_new_revision;
end;
$$;

create or replace function private.create_kill_team(
  p_mission_id uuid,
  p_expected_revision bigint,
  p_name text,
  p_members jsonb,
  p_actor_id uuid
)
returns table (
  kill_team_id uuid,
  update_id uuid,
  new_revision bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, private
as $$
declare
  v_campaign_id uuid;
  v_previous_revision bigint;
  v_kill_team_id uuid;
  v_update_id uuid;
  v_new_revision bigint;
  v_members jsonb;
begin
  if length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_NAME_REQUIRED';
  end if;

  perform private.validate_kill_team_members(p_members);

  select lock.campaign_id, lock.previous_revision
  into v_campaign_id, v_previous_revision
  from private.lock_kill_team_registration(p_mission_id, p_expected_revision) as lock;

  insert into public.kill_teams (mission_id, name)
  values (p_mission_id, p_name)
  returning id into v_kill_team_id;

  insert into public.kill_team_members (
    kill_team_id,
    mission_id,
    discord_user_id,
    display_name
  )
  select
    v_kill_team_id,
    p_mission_id,
    member.discord_user_id,
    member.display_name
  from jsonb_to_recordset(p_members) as member(
    discord_user_id text,
    display_name text
  );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', member.id,
        'discord_user_id', member.discord_user_id,
        'display_name', member.display_name
      ) order by member.discord_user_id, member.id
    ),
    '[]'::jsonb
  )
  into v_members
  from public.kill_team_members as member
  where member.kill_team_id = v_kill_team_id;

  select record.update_id, record.new_revision
  into v_update_id, v_new_revision
  from private.record_kill_team_registration_update(
    v_campaign_id,
    p_mission_id,
    v_previous_revision,
    p_actor_id,
    '{}'::jsonb,
    jsonb_build_object(
      'action', 'CREATED',
      'kill_team_id', v_kill_team_id,
      'name', p_name,
      'members', v_members
    )
  ) as record;

  return query select v_kill_team_id, v_update_id, v_new_revision;
end;
$$;

create or replace function private.update_kill_team(
  p_kill_team_id uuid,
  p_expected_revision bigint,
  p_name text,
  p_members jsonb,
  p_actor_id uuid
)
returns table (
  update_id uuid,
  new_revision bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, private
as $$
declare
  v_team public.kill_teams%rowtype;
  v_campaign_id uuid;
  v_previous_revision bigint;
  v_update_id uuid;
  v_new_revision bigint;
  v_old_members jsonb;
  v_new_members jsonb;
begin
  if length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_NAME_REQUIRED';
  end if;

  perform private.validate_kill_team_members(p_members);

  select team.*
  into v_team
  from public.kill_teams as team
  where team.id = p_kill_team_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_NOT_FOUND';
  end if;

  select lock.campaign_id, lock.previous_revision
  into v_campaign_id, v_previous_revision
  from private.lock_kill_team_registration(
    v_team.mission_id,
    p_expected_revision
  ) as lock;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', member.id,
        'discord_user_id', member.discord_user_id,
        'display_name', member.display_name
      ) order by member.discord_user_id, member.id
    ),
    '[]'::jsonb
  )
  into v_old_members
  from public.kill_team_members as member
  where member.kill_team_id = v_team.id;

  update public.kill_teams
  set name = p_name
  where id = v_team.id;

  delete from public.kill_team_members
  where kill_team_id = v_team.id;

  insert into public.kill_team_members (
    kill_team_id,
    mission_id,
    discord_user_id,
    display_name
  )
  select
    v_team.id,
    v_team.mission_id,
    member.discord_user_id,
    member.display_name
  from jsonb_to_recordset(p_members) as member(
    discord_user_id text,
    display_name text
  );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', member.id,
        'discord_user_id', member.discord_user_id,
        'display_name', member.display_name
      ) order by member.discord_user_id, member.id
    ),
    '[]'::jsonb
  )
  into v_new_members
  from public.kill_team_members as member
  where member.kill_team_id = v_team.id;

  select record.update_id, record.new_revision
  into v_update_id, v_new_revision
  from private.record_kill_team_registration_update(
    v_campaign_id,
    v_team.mission_id,
    v_previous_revision,
    p_actor_id,
    jsonb_build_object(
      'action', 'UPDATED',
      'kill_team_id', v_team.id,
      'name', v_team.name,
      'members', v_old_members
    ),
    jsonb_build_object(
      'action', 'UPDATED',
      'kill_team_id', v_team.id,
      'name', p_name,
      'members', v_new_members
    )
  ) as record;

  return query select v_update_id, v_new_revision;
end;
$$;

create or replace function private.delete_kill_team(
  p_kill_team_id uuid,
  p_expected_revision bigint,
  p_actor_id uuid
)
returns table (
  update_id uuid,
  new_revision bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, private
as $$
declare
  v_team public.kill_teams%rowtype;
  v_campaign_id uuid;
  v_previous_revision bigint;
  v_update_id uuid;
  v_new_revision bigint;
  v_old_members jsonb;
begin
  select team.*
  into v_team
  from public.kill_teams as team
  where team.id = p_kill_team_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_NOT_FOUND';
  end if;

  select lock.campaign_id, lock.previous_revision
  into v_campaign_id, v_previous_revision
  from private.lock_kill_team_registration(
    v_team.mission_id,
    p_expected_revision
  ) as lock;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', member.id,
        'discord_user_id', member.discord_user_id,
        'display_name', member.display_name
      ) order by member.discord_user_id, member.id
    ),
    '[]'::jsonb
  )
  into v_old_members
  from public.kill_team_members as member
  where member.kill_team_id = v_team.id;

  delete from public.kill_teams
  where id = v_team.id;

  select record.update_id, record.new_revision
  into v_update_id, v_new_revision
  from private.record_kill_team_registration_update(
    v_campaign_id,
    v_team.mission_id,
    v_previous_revision,
    p_actor_id,
    jsonb_build_object(
      'action', 'DELETED',
      'kill_team_id', v_team.id,
      'name', v_team.name,
      'members', v_old_members
    ),
    '{}'::jsonb
  ) as record;

  return query select v_update_id, v_new_revision;
end;
$$;

create or replace function public.create_kill_team(
  p_mission_id uuid,
  p_expected_revision bigint,
  p_name text,
  p_members jsonb,
  p_actor_id uuid default null
)
returns table (
  kill_team_id uuid,
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
  select command.kill_team_id, command.update_id, command.new_revision
  from private.create_kill_team(
    p_mission_id,
    p_expected_revision,
    p_name,
    p_members,
    v_actor_id
  ) as command;
end;
$$;

create or replace function public.update_kill_team(
  p_kill_team_id uuid,
  p_expected_revision bigint,
  p_name text,
  p_members jsonb,
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
  from private.update_kill_team(
    p_kill_team_id,
    p_expected_revision,
    p_name,
    p_members,
    v_actor_id
  ) as command;
end;
$$;

create or replace function public.delete_kill_team(
  p_kill_team_id uuid,
  p_expected_revision bigint,
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
  from private.delete_kill_team(
    p_kill_team_id,
    p_expected_revision,
    v_actor_id
  ) as command;
end;
$$;

revoke all on function public.enforce_kill_team_registration_lock()
  from public, anon, authenticated;
revoke all on function private.validate_kill_team_members(jsonb)
  from public, anon, authenticated;
revoke all on function private.lock_kill_team_registration(uuid, bigint)
  from public, anon, authenticated;
revoke all on function private.record_kill_team_registration_update(
  uuid,
  uuid,
  bigint,
  uuid,
  jsonb,
  jsonb
) from public, anon, authenticated;
revoke all on function private.create_kill_team(uuid, bigint, text, jsonb, uuid)
  from public, anon, authenticated;
revoke all on function private.update_kill_team(uuid, bigint, text, jsonb, uuid)
  from public, anon, authenticated;
revoke all on function private.delete_kill_team(uuid, bigint, uuid)
  from public, anon, authenticated;
revoke all on function public.create_kill_team(uuid, bigint, text, jsonb, uuid)
  from public, anon, authenticated;
revoke all on function public.update_kill_team(uuid, bigint, text, jsonb, uuid)
  from public, anon, authenticated;
revoke all on function public.delete_kill_team(uuid, bigint, uuid)
  from public, anon, authenticated;

grant execute on function public.create_kill_team(uuid, bigint, text, jsonb, uuid)
  to authenticated;
grant execute on function public.update_kill_team(uuid, bigint, text, jsonb, uuid)
  to authenticated;
grant execute on function public.delete_kill_team(uuid, bigint, uuid)
  to authenticated;

create or replace function private.publish_public_campaign_sync_signal()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_transition_status text;
  v_is_active boolean;
begin
  if new.change_type = 'MISSION_TRANSITION' then
    v_transition_status := new.new_values ->> 'mission_status';

    if v_transition_status = 'ACTIVE' then
      v_is_active := true;
    elsif v_transition_status in ('COMPLETE', 'ABORTED') then
      v_is_active := false;
    else
      return new;
    end if;
  elsif new.change_type in ('LIVE_STATE_UPDATE', 'KILL_TEAM_REGISTRATION') then
    select exists (
      select 1
      from public.live_campaign_states as lcs
      join public.missions as m on m.id = lcs.current_mission_id
      where lcs.campaign_id = new.campaign_id
        and m.status = 'ACTIVE'
    ) into v_is_active;

    if not v_is_active then
      return new;
    end if;
  else
    return new;
  end if;

  insert into public.public_campaign_sync_signals (
    campaign_id,
    revision,
    update_id,
    is_active,
    published_at
  ) values (
    new.campaign_id,
    new.new_revision,
    new.id,
    v_is_active,
    new.occurred_at
  )
  on conflict (campaign_id) do update
  set revision = excluded.revision,
      update_id = excluded.update_id,
      is_active = excluded.is_active,
      published_at = excluded.published_at
  where excluded.revision > public_campaign_sync_signals.revision;

  return new;
end;
$$;

drop function public.get_public_sync_snapshot();
drop function public.get_public_active_campaign();

create function public.get_public_active_campaign()
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
  enemies jsonb,
  mission_boss jsonb,
  crusade_scoring_targets jsonb,
  kill_teams jsonb
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
    ),
    case
      when m.mission_boss_key is null then null::jsonb
      else jsonb_build_object(
        'id', m.mission_boss_key,
        'name', m.mission_boss_display_name,
        'description', null
      )
    end,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', target.target_key,
            'name', target.display_name,
            'description', null,
            'sort_order', target.sort_order
          ) order by target.sort_order, target.target_key
        )
        from public.mission_crusade_scoring_targets as target
        where target.mission_id = m.id
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', team.id,
            'name', team.name,
            'members', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'display_name', member.display_name
                  ) order by member.display_name, member.id
                )
                from public.kill_team_members as member
                where member.kill_team_id = team.id
              ),
              '[]'::jsonb
            )
          ) order by team.name, team.id
        )
        from public.kill_teams as team
        where team.mission_id = m.id
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

create function public.get_public_sync_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with active_campaigns as materialized (
    select *
    from public.get_public_active_campaign()
  ),
  latest_signal as materialized (
    select *
    from public.get_public_latest_sync_signal()
  )
  select jsonb_build_object(
    'active_campaign_count', (
      select count(*)
      from active_campaigns
    ),
    'campaign', (
      select to_jsonb(active_campaign)
      from active_campaigns as active_campaign
      limit 1
    ),
    'signal', (
      select to_jsonb(signal)
      from latest_signal as signal
    )
  )
$$;

revoke all on function private.publish_public_campaign_sync_signal()
  from public, anon, authenticated;
revoke all on function public.get_public_active_campaign()
  from public, anon, authenticated;
revoke all on function public.get_public_sync_snapshot()
  from public, anon, authenticated;

grant execute on function public.get_public_active_campaign()
  to anon, authenticated;
grant execute on function public.get_public_sync_snapshot()
  to anon, authenticated;

commit;
