begin;

alter table public.kill_team_progress_ledger
  add column source_submission_id uuid,
  add constraint kill_team_progress_source_submission_fk
    foreign key (source_submission_id)
    references public.crusade_submissions(id)
    on update restrict on delete restrict,
  add constraint kill_team_progress_source_submission_unique
    unique (source_submission_id);

comment on column public.kill_team_progress_ledger.source_submission_id is
  'Nullable immutable trace to the approved player submission that created this ledger entry. Manual staff entries remain null.';

create or replace function public.enforce_kill_team_progress_submission_source()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_submission public.crusade_submissions%rowtype;
  v_review public.crusade_submission_reviews%rowtype;
begin
  if new.source_submission_id is null then
    return new;
  end if;

  select submission.*
  into v_submission
  from public.crusade_submissions as submission
  where submission.id = new.source_submission_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'PROGRESS_SOURCE_SUBMISSION_NOT_FOUND';
  end if;

  if v_submission.campaign_id <> new.campaign_id
     or v_submission.mission_id <> new.mission_id
     or v_submission.kill_team_id <> new.kill_team_id
     or v_submission.event_type::text <> new.event_type::text
     or v_submission.scoring_target_key
       is distinct from new.scoring_target_key then
    raise exception using
      errcode = 'P0001',
      message = 'PROGRESS_SOURCE_SUBMISSION_MISMATCH';
  end if;

  select review.*
  into v_review
  from public.crusade_submission_reviews as review
  where review.submission_id = new.source_submission_id;

  if not found
     or v_review.status <> 'APPROVED'
     or v_review.awarded_point_delta is distinct from new.point_delta then
    raise exception using
      errcode = 'P0001',
      message = 'PROGRESS_SOURCE_SUBMISSION_NOT_APPROVED';
  end if;

  return new;
end;
$$;

create trigger kill_team_progress_enforce_submission_source
before insert on public.kill_team_progress_ledger
for each row execute function public.enforce_kill_team_progress_submission_source();

create or replace function private.require_submission_reviewer()
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
begin
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

create or replace function private.record_kill_team_progress(
  p_kill_team_id uuid,
  p_event_type public.kill_team_progress_event_type,
  p_point_delta integer,
  p_expected_revision bigint,
  p_description text,
  p_scoring_target_key text,
  p_actor_id uuid,
  p_source_submission_id uuid
)
returns table (
  ledger_entry_id uuid,
  update_id uuid,
  new_revision bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, private
as $$
declare
  v_team public.kill_teams%rowtype;
  v_mission public.missions%rowtype;
  v_state public.live_campaign_states%rowtype;
  v_ledger_entry_id uuid := extensions.gen_random_uuid();
  v_update_id uuid := extensions.gen_random_uuid();
  v_new_revision bigint;
  v_description text := nullif(btrim(p_description), '');
  v_scoring_target_key text := nullif(btrim(p_scoring_target_key), '');
begin
  if p_point_delta = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_PROGRESS_DELTA_ZERO';
  end if;

  if p_description is not null and v_description is null then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_PROGRESS_DESCRIPTION_INVALID';
  end if;

  if p_scoring_target_key is not null and v_scoring_target_key is null then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_PROGRESS_TARGET_INVALID';
  end if;

  if v_scoring_target_key is not null and p_event_type <> 'TERMINUS_KILL' then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_PROGRESS_TARGET_EVENT_INVALID';
  end if;

  select team.*
  into v_team
  from public.kill_teams as team
  where team.id = p_kill_team_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'KILL_TEAM_NOT_FOUND';
  end if;

  select mission.*
  into v_mission
  from public.missions as mission
  where mission.id = v_team.mission_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MISSION_NOT_FOUND';
  end if;

  if v_mission.status <> 'ACTIVE' then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_PROGRESS_LOCKED';
  end if;

  select state.*
  into v_state
  from public.live_campaign_states as state
  where state.campaign_id = v_mission.campaign_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'LIVE_STATE_NOT_FOUND';
  end if;

  if v_state.revision <> p_expected_revision then
    raise exception using errcode = 'P0001', message = 'REVISION_CONFLICT';
  end if;

  if v_scoring_target_key is not null and not exists (
    select 1
    from public.mission_crusade_scoring_targets as target
    where target.mission_id = v_mission.id
      and target.target_key = v_scoring_target_key
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'KILL_TEAM_PROGRESS_TARGET_NOT_FOUND_FOR_MISSION';
  end if;

  update public.live_campaign_states as state
  set revision = state.revision + 1,
      last_update_id = v_update_id,
      updated_by = p_actor_id
  where state.campaign_id = v_mission.campaign_id
    and state.revision = v_state.revision
  returning state.revision into v_new_revision;

  if not found then
    raise exception using errcode = 'P0001', message = 'REVISION_CONFLICT';
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
    'KILL_TEAM_PROGRESS',
    '{}'::jsonb,
    jsonb_strip_nulls(jsonb_build_object(
      'action', case
        when p_source_submission_id is null then 'PROGRESS_RECORDED'
        else 'SUBMISSION_APPROVED'
      end,
      'ledger_entry_id', v_ledger_entry_id,
      'source_submission_id', p_source_submission_id,
      'kill_team_id', v_team.id,
      'event_type', p_event_type,
      'point_delta', p_point_delta,
      'description', v_description,
      'scoring_target_key', v_scoring_target_key
    ))
  );

  insert into public.kill_team_progress_ledger (
    id,
    campaign_id,
    mission_id,
    kill_team_id,
    event_type,
    point_delta,
    description,
    scoring_target_key,
    campaign_revision,
    actor_id,
    source_submission_id
  ) values (
    v_ledger_entry_id,
    v_mission.campaign_id,
    v_mission.id,
    v_team.id,
    p_event_type,
    p_point_delta,
    v_description,
    v_scoring_target_key,
    v_new_revision,
    p_actor_id,
    p_source_submission_id
  );

  return query select v_ledger_entry_id, v_update_id, v_new_revision;
end;
$$;

create or replace function private.record_kill_team_progress(
  p_kill_team_id uuid,
  p_event_type public.kill_team_progress_event_type,
  p_point_delta integer,
  p_expected_revision bigint,
  p_description text,
  p_scoring_target_key text,
  p_actor_id uuid
)
returns table (
  ledger_entry_id uuid,
  update_id uuid,
  new_revision bigint
)
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  select command.ledger_entry_id, command.update_id, command.new_revision
  from private.record_kill_team_progress(
    p_kill_team_id,
    p_event_type,
    p_point_delta,
    p_expected_revision,
    p_description,
    p_scoring_target_key,
    p_actor_id,
    null
  ) as command
$$;

create or replace function public.approve_crusade_submission(
  p_submission_id uuid,
  p_awarded_point_delta integer,
  p_expected_revision bigint,
  p_moderator_note text default null
)
returns table (
  submission_id uuid,
  receipt_reference text,
  submission_status public.crusade_submission_status,
  awarded_point_delta integer,
  ledger_entry_id uuid,
  new_revision bigint,
  kill_team_crusade_points bigint,
  campaign_crusade_points bigint,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_submission public.crusade_submissions%rowtype;
  v_mission public.missions%rowtype;
  v_actor_id uuid;
  v_moderator_note text := nullif(btrim(p_moderator_note), '');
  v_ledger_entry_id uuid;
  v_new_revision bigint;
  v_reviewed_at timestamptz;
  v_team_points bigint;
  v_campaign_points bigint;
begin
  perform private.require_submission_reviewer();
  v_actor_id := private.authoritative_actor(null);

  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'AUTHORIZATION_REQUIRED';
  end if;

  if p_awarded_point_delta = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_AWARD_DELTA_ZERO';
  end if;

  if p_moderator_note is not null and v_moderator_note is null then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_REVIEW_NOTE_INVALID';
  end if;

  if v_moderator_note is not null and length(v_moderator_note) > 1000 then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_REVIEW_NOTE_TOO_LONG';
  end if;

  select submission.*
  into v_submission
  from public.crusade_submissions as submission
  where submission.id = p_submission_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.crusade_submission_reviews as review
    where review.submission_id = v_submission.id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_ALREADY_REVIEWED';
  end if;

  select mission.*
  into v_mission
  from public.missions as mission
  where mission.id = v_submission.mission_id
    and mission.campaign_id = v_submission.campaign_id;

  if not found
     or not exists (
       select 1
       from public.kill_teams as team
       where team.id = v_submission.kill_team_id
         and team.mission_id = v_submission.mission_id
     )
     or not exists (
       select 1
       from public.kill_team_members as member
       where member.kill_team_id = v_submission.kill_team_id
         and member.mission_id = v_submission.mission_id
         and member.discord_user_id = v_submission.submitting_discord_user_id
     ) then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_RELATIONSHIP_INVALID';
  end if;

  if v_mission.status <> 'ACTIVE' then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_MISSION_NOT_ACTIVE';
  end if;

  if v_submission.scoring_target_key is not null and not exists (
    select 1
    from public.mission_crusade_scoring_targets as target
    where target.mission_id = v_submission.mission_id
      and target.target_key = v_submission.scoring_target_key
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_RELATIONSHIP_INVALID';
  end if;

  insert into public.crusade_submission_reviews (
    submission_id,
    status,
    reviewed_by,
    moderator_note,
    awarded_point_delta
  ) values (
    v_submission.id,
    'APPROVED',
    v_actor_id,
    v_moderator_note,
    p_awarded_point_delta
  ) returning decided_at into v_reviewed_at;

  select command.ledger_entry_id, command.new_revision
  into v_ledger_entry_id, v_new_revision
  from private.record_kill_team_progress(
    v_submission.kill_team_id,
    v_submission.event_type::text::public.kill_team_progress_event_type,
    p_awarded_point_delta,
    p_expected_revision,
    'Approved submission ' || v_submission.receipt_reference,
    v_submission.scoring_target_key,
    v_actor_id,
    v_submission.id
  ) as command;

  select coalesce(sum(entry.point_delta), 0)
  into v_team_points
  from public.kill_team_progress_ledger as entry
  where entry.kill_team_id = v_submission.kill_team_id;

  select coalesce(sum(entry.point_delta), 0)
  into v_campaign_points
  from public.kill_team_progress_ledger as entry
  where entry.campaign_id = v_submission.campaign_id;

  return query
  select
    v_submission.id,
    v_submission.receipt_reference,
    'APPROVED'::public.crusade_submission_status,
    p_awarded_point_delta,
    v_ledger_entry_id,
    v_new_revision,
    v_team_points,
    v_campaign_points,
    v_reviewed_at;
end;
$$;

create or replace function public.reject_crusade_submission(
  p_submission_id uuid,
  p_moderator_note text default null
)
returns table (
  submission_id uuid,
  receipt_reference text,
  submission_status public.crusade_submission_status,
  moderator_note text,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_submission public.crusade_submissions%rowtype;
  v_actor_id uuid;
  v_moderator_note text := nullif(btrim(p_moderator_note), '');
  v_reviewed_at timestamptz;
begin
  perform private.require_submission_reviewer();
  v_actor_id := private.authoritative_actor(null);

  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'AUTHORIZATION_REQUIRED';
  end if;

  if p_moderator_note is not null and v_moderator_note is null then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_REVIEW_NOTE_INVALID';
  end if;

  if v_moderator_note is not null and length(v_moderator_note) > 1000 then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_REVIEW_NOTE_TOO_LONG';
  end if;

  select submission.*
  into v_submission
  from public.crusade_submissions as submission
  where submission.id = p_submission_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.crusade_submission_reviews as review
    where review.submission_id = v_submission.id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_ALREADY_REVIEWED';
  end if;

  insert into public.crusade_submission_reviews (
    submission_id,
    status,
    reviewed_by,
    moderator_note
  ) values (
    v_submission.id,
    'REJECTED',
    v_actor_id,
    v_moderator_note
  ) returning decided_at into v_reviewed_at;

  return query
  select
    v_submission.id,
    v_submission.receipt_reference,
    'REJECTED'::public.crusade_submission_status,
    v_moderator_note,
    v_reviewed_at;
end;
$$;

create or replace function public.get_crusade_submission_queue(
  p_status public.crusade_submission_status default null,
  p_campaign_id uuid default null,
  p_mission_id uuid default null
)
returns table (
  submission_id uuid,
  receipt_reference text,
  submitted_at timestamptz,
  campaign_id uuid,
  mission_id uuid,
  event_type public.crusade_submission_event_type,
  kill_team_id uuid,
  kill_team_name text,
  submitting_member_display_name text,
  scoring_target_key text,
  scoring_target_name text,
  player_note text,
  evidence_original_filename text,
  evidence_content_type text,
  evidence_source_reference text,
  evidence_storage_path text,
  evidence_file_size_bytes bigint,
  review_status public.crusade_submission_status,
  reviewer_id uuid,
  reviewer_role public.app_role,
  moderator_note text,
  awarded_point_delta integer,
  reviewed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.require_submission_reviewer();

  return query
  select
    submission.id,
    submission.receipt_reference,
    submission.created_at,
    submission.campaign_id,
    submission.mission_id,
    submission.event_type,
    submission.kill_team_id,
    team.name,
    member.display_name,
    submission.scoring_target_key,
    target.display_name,
    submission.player_note,
    submission.evidence_original_filename,
    submission.evidence_content_type,
    submission.evidence_source_reference,
    submission.evidence_storage_path,
    submission.evidence_file_size_bytes,
    coalesce(review.status, 'PENDING'::public.crusade_submission_status),
    review.reviewed_by,
    reviewer.role,
    review.moderator_note,
    review.awarded_point_delta,
    review.decided_at
  from public.crusade_submissions as submission
  join public.kill_teams as team
    on team.id = submission.kill_team_id
   and team.mission_id = submission.mission_id
  join public.kill_team_members as member
    on member.kill_team_id = submission.kill_team_id
   and member.mission_id = submission.mission_id
   and member.discord_user_id = submission.submitting_discord_user_id
  left join public.mission_crusade_scoring_targets as target
    on target.mission_id = submission.mission_id
   and target.target_key = submission.scoring_target_key
  left join public.crusade_submission_reviews as review
    on review.submission_id = submission.id
  left join public.app_users as reviewer
    on reviewer.user_id = review.reviewed_by
  where (
      p_status is null
      or coalesce(
        review.status,
        'PENDING'::public.crusade_submission_status
      ) = p_status
    )
    and (p_campaign_id is null or submission.campaign_id = p_campaign_id)
    and (p_mission_id is null or submission.mission_id = p_mission_id)
  order by
    case when review.submission_id is null then 0 else 1 end,
    submission.created_at,
    submission.id;
end;
$$;

create or replace function public.get_pending_crusade_submission_count(
  p_campaign_id uuid default null,
  p_mission_id uuid default null
)
returns bigint
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_count bigint;
begin
  perform private.require_submission_reviewer();

  select count(*)
  into v_count
  from public.crusade_submissions as submission
  join public.missions as mission
    on mission.id = submission.mission_id
   and mission.campaign_id = submission.campaign_id
  left join public.crusade_submission_reviews as review
    on review.submission_id = submission.id
  where review.submission_id is null
    and mission.status = 'ACTIVE'
    and (p_campaign_id is null or submission.campaign_id = p_campaign_id)
    and (p_mission_id is null or submission.mission_id = p_mission_id);

  return v_count;
end;
$$;

revoke all on function public.enforce_kill_team_progress_submission_source()
  from public, anon, authenticated, service_role;
revoke all on function private.require_submission_reviewer()
  from public, anon, authenticated, service_role;
revoke all on function private.record_kill_team_progress(
  uuid,
  public.kill_team_progress_event_type,
  integer,
  bigint,
  text,
  text,
  uuid,
  uuid
) from public, anon, authenticated, service_role;
revoke all on function public.approve_crusade_submission(
  uuid,
  integer,
  bigint,
  text
) from public, anon, authenticated, service_role;
revoke all on function public.reject_crusade_submission(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.get_crusade_submission_queue(
  public.crusade_submission_status,
  uuid,
  uuid
) from public, anon, authenticated, service_role;
revoke all on function public.get_pending_crusade_submission_count(uuid, uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.approve_crusade_submission(
  uuid,
  integer,
  bigint,
  text
) to authenticated;
grant execute on function public.reject_crusade_submission(uuid, text)
  to authenticated;
grant execute on function public.get_crusade_submission_queue(
  public.crusade_submission_status,
  uuid,
  uuid
) to authenticated;
grant execute on function public.get_pending_crusade_submission_count(uuid, uuid)
  to authenticated;

commit;
