begin;

create type public.crusade_submission_event_type as enum (
  'TERMINUS_KILL',
  'OBJECTIVE',
  'MISSION_COMPLETION'
);

create type public.crusade_submission_status as enum (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

alter table public.kill_team_members
  add constraint kill_team_members_team_mission_discord_unique unique (
    kill_team_id,
    mission_id,
    discord_user_id
  );

create sequence private.crusade_submission_receipt_sequence
  as bigint
  start with 1
  increment by 1
  minvalue 1
  no cycle;

create table public.crusade_submissions (
  id uuid primary key default extensions.gen_random_uuid(),
  receipt_reference text not null unique,
  campaign_id uuid not null,
  mission_id uuid not null,
  kill_team_id uuid not null,
  submitting_discord_user_id text not null,
  event_type public.crusade_submission_event_type not null,
  scoring_target_key text,
  player_note text,
  evidence_original_filename text not null,
  evidence_content_type text not null,
  evidence_source_reference text not null,
  evidence_storage_path text,
  evidence_file_size_bytes bigint,
  external_idempotency_key text,
  created_at timestamptz not null default statement_timestamp(),
  constraint crusade_submissions_campaign_mission_fk foreign key (
    campaign_id,
    mission_id
  ) references public.missions(campaign_id, id)
    on update restrict on delete restrict,
  constraint crusade_submissions_team_mission_fk foreign key (
    kill_team_id,
    mission_id
  ) references public.kill_teams(id, mission_id)
    on update restrict on delete restrict,
  constraint crusade_submissions_member_fk foreign key (
    kill_team_id,
    mission_id,
    submitting_discord_user_id
  ) references public.kill_team_members(
    kill_team_id,
    mission_id,
    discord_user_id
  ) on update restrict on delete restrict,
  constraint crusade_submissions_scoring_target_fk foreign key (
    mission_id,
    scoring_target_key
  ) references public.mission_crusade_scoring_targets(mission_id, target_key)
    on update restrict on delete restrict,
  constraint crusade_submissions_receipt_format check (
    receipt_reference ~ '^CR-[0-9]{5,}$'
  ),
  constraint crusade_submissions_discord_user_id_format check (
    submitting_discord_user_id ~ '^[0-9]{17,20}$'
  ),
  constraint crusade_submissions_target_event check (
    scoring_target_key is null or event_type = 'TERMINUS_KILL'
  ),
  constraint crusade_submissions_player_note_valid check (
    player_note is null
    or (
      length(btrim(player_note)) > 0
      and length(player_note) <= 500
    )
  ),
  constraint crusade_submissions_evidence_filename_not_blank check (
    length(btrim(evidence_original_filename)) > 0
  ),
  constraint crusade_submissions_evidence_content_type_not_blank check (
    length(btrim(evidence_content_type)) > 0
  ),
  constraint crusade_submissions_evidence_source_not_blank check (
    length(btrim(evidence_source_reference)) > 0
  ),
  constraint crusade_submissions_evidence_storage_path_not_blank check (
    evidence_storage_path is null
    or length(btrim(evidence_storage_path)) > 0
  ),
  constraint crusade_submissions_evidence_file_size_positive check (
    evidence_file_size_bytes is null or evidence_file_size_bytes > 0
  ),
  constraint crusade_submissions_idempotency_key_valid check (
    external_idempotency_key is null
    or (
      length(btrim(external_idempotency_key)) > 0
      and length(external_idempotency_key) <= 255
    )
  )
);

create unique index crusade_submissions_external_idempotency_key_unique
  on public.crusade_submissions(external_idempotency_key)
  where external_idempotency_key is not null;
create index crusade_submissions_campaign_created_idx
  on public.crusade_submissions(campaign_id, created_at, id);
create index crusade_submissions_mission_created_idx
  on public.crusade_submissions(mission_id, created_at, id);
create index crusade_submissions_team_created_idx
  on public.crusade_submissions(kill_team_id, created_at, id);

create table public.crusade_submission_reviews (
  submission_id uuid primary key references public.crusade_submissions(id)
    on update restrict on delete restrict,
  status public.crusade_submission_status not null,
  reviewed_by uuid not null references auth.users(id)
    on update restrict on delete restrict,
  moderator_note text,
  awarded_point_delta integer,
  decided_at timestamptz not null default statement_timestamp(),
  constraint crusade_submission_reviews_final_status check (
    status in ('APPROVED', 'REJECTED')
  ),
  constraint crusade_submission_reviews_note_valid check (
    moderator_note is null
    or (
      length(btrim(moderator_note)) > 0
      and length(moderator_note) <= 1000
    )
  ),
  constraint crusade_submission_reviews_award_only_on_approval check (
    status = 'APPROVED' or awarded_point_delta is null
  )
);

comment on table public.crusade_submissions is
  'Immutable private intake records for player-provided Crusade claims awaiting staff review.';
comment on table public.crusade_submission_reviews is
  'Immutable one-to-one final decisions for Crusade submissions. Absence of a row means PENDING.';
comment on column public.crusade_submissions.evidence_source_reference is
  'Private temporary source URL or external attachment reference; never part of the public campaign snapshot.';

create or replace function public.prevent_crusade_submission_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  raise exception using
    errcode = 'P0001',
    message = case tg_table_name
      when 'crusade_submissions' then 'CRUSADE_SUBMISSION_IMMUTABLE'
      else 'CRUSADE_SUBMISSION_REVIEW_IMMUTABLE'
    end;
end;
$$;

create trigger crusade_submissions_immutable
before update or delete on public.crusade_submissions
for each row execute function public.prevent_crusade_submission_mutation();

create trigger crusade_submission_reviews_immutable
before update or delete on public.crusade_submission_reviews
for each row execute function public.prevent_crusade_submission_mutation();

alter table public.crusade_submissions enable row level security;
alter table public.crusade_submission_reviews enable row level security;

revoke all on table public.crusade_submissions
  from public, anon, authenticated, service_role;
revoke all on table public.crusade_submission_reviews
  from public, anon, authenticated, service_role;
revoke all on sequence private.crusade_submission_receipt_sequence
  from public, anon, authenticated, service_role;

grant select on table public.crusade_submissions to authenticated;
grant select on table public.crusade_submission_reviews to authenticated;

create policy crusade_submissions_staff_read
on public.crusade_submissions
for select
to authenticated
using (
  (select public.current_app_role()) in ('ADMINISTRATOR', 'MODERATOR')
);

create policy crusade_submission_reviews_staff_read
on public.crusade_submission_reviews
for select
to authenticated
using (
  (select public.current_app_role()) in ('ADMINISTRATOR', 'MODERATOR')
);

create or replace function public.create_crusade_submission(
  p_campaign_id uuid,
  p_mission_id uuid,
  p_kill_team_id uuid,
  p_submitting_discord_user_id text,
  p_event_type public.crusade_submission_event_type,
  p_evidence_original_filename text,
  p_evidence_content_type text,
  p_evidence_source_reference text,
  p_scoring_target_key text default null,
  p_player_note text default null,
  p_evidence_storage_path text default null,
  p_evidence_file_size_bytes bigint default null,
  p_external_idempotency_key text default null
)
returns table (
  submission_id uuid,
  receipt_reference text,
  submission_status public.crusade_submission_status,
  submission_event_type public.crusade_submission_event_type,
  kill_team_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, private
as $$
declare
  v_mission public.missions%rowtype;
  v_team public.kill_teams%rowtype;
  v_existing public.crusade_submissions%rowtype;
  v_submission_id uuid := extensions.gen_random_uuid();
  v_receipt_reference text;
  v_discord_user_id text := btrim(p_submitting_discord_user_id);
  v_scoring_target_key text := nullif(btrim(p_scoring_target_key), '');
  v_player_note text := nullif(btrim(p_player_note), '');
  v_evidence_original_filename text := btrim(p_evidence_original_filename);
  v_evidence_content_type text := btrim(p_evidence_content_type);
  v_evidence_source_reference text := btrim(p_evidence_source_reference);
  v_evidence_storage_path text := nullif(btrim(p_evidence_storage_path), '');
  v_external_idempotency_key text := nullif(
    btrim(p_external_idempotency_key),
    ''
  );
  v_created_at timestamptz;
  v_status public.crusade_submission_status;
begin
  if p_submitting_discord_user_id is null
     or v_discord_user_id !~ '^[0-9]{17,20}$' then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_DISCORD_USER_INVALID';
  end if;

  if p_event_type is null then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_EVENT_TYPE_INVALID';
  end if;

  if p_evidence_original_filename is null
     or v_evidence_original_filename = ''
     or p_evidence_content_type is null
     or v_evidence_content_type = ''
     or p_evidence_source_reference is null
     or v_evidence_source_reference = '' then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_EVIDENCE_METADATA_INVALID';
  end if;

  if p_player_note is not null and v_player_note is null then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_PLAYER_NOTE_INVALID';
  end if;

  if v_player_note is not null and length(v_player_note) > 500 then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_PLAYER_NOTE_TOO_LONG';
  end if;

  if p_evidence_storage_path is not null
     and v_evidence_storage_path is null then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_STORAGE_PATH_INVALID';
  end if;

  if p_evidence_file_size_bytes is not null
     and p_evidence_file_size_bytes <= 0 then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_FILE_SIZE_INVALID';
  end if;

  if p_external_idempotency_key is not null
     and v_external_idempotency_key is null then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_IDEMPOTENCY_KEY_INVALID';
  end if;

  if v_external_idempotency_key is not null
     and length(v_external_idempotency_key) > 255 then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_IDEMPOTENCY_KEY_TOO_LONG';
  end if;

  if v_scoring_target_key is not null
     and p_event_type <> 'TERMINUS_KILL' then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_TARGET_EVENT_INVALID';
  end if;

  if v_external_idempotency_key is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_external_idempotency_key, 0)
    );

    select submission.*
    into v_existing
    from public.crusade_submissions as submission
    where submission.external_idempotency_key = v_external_idempotency_key;

    if found then
      if not (
        v_existing.campaign_id = p_campaign_id
        and v_existing.mission_id = p_mission_id
        and v_existing.kill_team_id = p_kill_team_id
        and v_existing.submitting_discord_user_id = v_discord_user_id
        and v_existing.event_type = p_event_type
        and v_existing.scoring_target_key is not distinct from v_scoring_target_key
        and v_existing.player_note is not distinct from v_player_note
        and v_existing.evidence_original_filename = v_evidence_original_filename
        and v_existing.evidence_content_type = v_evidence_content_type
        and v_existing.evidence_source_reference = v_evidence_source_reference
        and v_existing.evidence_storage_path is not distinct from v_evidence_storage_path
        and v_existing.evidence_file_size_bytes is not distinct from p_evidence_file_size_bytes
      ) then
        raise exception using
          errcode = 'P0001',
          message = 'SUBMISSION_IDEMPOTENCY_CONFLICT';
      end if;

      select coalesce(review.status, 'PENDING'::public.crusade_submission_status)
      into v_status
      from (select 1) as singleton
      left join public.crusade_submission_reviews as review
        on review.submission_id = v_existing.id;

      return query
      select
        v_existing.id,
        v_existing.receipt_reference,
        v_status,
        v_existing.event_type,
        v_existing.kill_team_id,
        v_existing.created_at;
      return;
    end if;
  end if;

  if not exists (
    select 1
    from public.campaigns as campaign
    where campaign.id = p_campaign_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'CAMPAIGN_NOT_FOUND';
  end if;

  select mission.*
  into v_mission
  from public.missions as mission
  where mission.id = p_mission_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'MISSION_NOT_FOUND';
  end if;

  if v_mission.campaign_id <> p_campaign_id then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_CAMPAIGN_MISSION_MISMATCH';
  end if;

  select team.*
  into v_team
  from public.kill_teams as team
  where team.id = p_kill_team_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'KILL_TEAM_NOT_FOUND';
  end if;

  if v_team.mission_id <> p_mission_id then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_KILL_TEAM_MISSION_MISMATCH';
  end if;

  if not exists (
    select 1
    from public.kill_team_members as member
    where member.kill_team_id = p_kill_team_id
      and member.mission_id = p_mission_id
      and member.discord_user_id = v_discord_user_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMITTER_NOT_KILL_TEAM_MEMBER';
  end if;

  if v_mission.status <> 'ACTIVE' then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_MISSION_NOT_ACTIVE';
  end if;

  if v_scoring_target_key is not null and not exists (
    select 1
    from public.mission_crusade_scoring_targets as target
    where target.mission_id = p_mission_id
      and target.target_key = v_scoring_target_key
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'SUBMISSION_TARGET_NOT_FOUND_FOR_MISSION';
  end if;

  v_receipt_reference := 'CR-' || lpad(
    nextval('private.crusade_submission_receipt_sequence'::regclass)::text,
    5,
    '0'
  );

  insert into public.crusade_submissions (
    id,
    receipt_reference,
    campaign_id,
    mission_id,
    kill_team_id,
    submitting_discord_user_id,
    event_type,
    scoring_target_key,
    player_note,
    evidence_original_filename,
    evidence_content_type,
    evidence_source_reference,
    evidence_storage_path,
    evidence_file_size_bytes,
    external_idempotency_key
  ) values (
    v_submission_id,
    v_receipt_reference,
    p_campaign_id,
    p_mission_id,
    p_kill_team_id,
    v_discord_user_id,
    p_event_type,
    v_scoring_target_key,
    v_player_note,
    v_evidence_original_filename,
    v_evidence_content_type,
    v_evidence_source_reference,
    v_evidence_storage_path,
    p_evidence_file_size_bytes,
    v_external_idempotency_key
  ) returning crusade_submissions.created_at into v_created_at;

  return query
  select
    v_submission_id,
    v_receipt_reference,
    'PENDING'::public.crusade_submission_status,
    p_event_type,
    p_kill_team_id,
    v_created_at;
end;
$$;

revoke all on function public.prevent_crusade_submission_mutation()
  from public, anon, authenticated, service_role;
revoke all on function public.create_crusade_submission(
  uuid,
  uuid,
  uuid,
  text,
  public.crusade_submission_event_type,
  text,
  text,
  text,
  text,
  text,
  text,
  bigint,
  text
) from public, anon, authenticated, service_role;

grant usage on type public.crusade_submission_event_type
  to authenticated, service_role;
grant usage on type public.crusade_submission_status
  to authenticated, service_role;
grant execute on function public.create_crusade_submission(
  uuid,
  uuid,
  uuid,
  text,
  public.crusade_submission_event_type,
  text,
  text,
  text,
  text,
  text,
  text,
  bigint,
  text
) to service_role;

commit;
