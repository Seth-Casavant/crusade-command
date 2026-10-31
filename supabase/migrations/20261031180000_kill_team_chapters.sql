begin;

alter table public.campaign_kill_teams
  add column chapter text check (chapter is null or
    (chapter = btrim(chapter) and length(chapter) between 2 and 80 and chapter !~ '[[:cntrl:]]'));
alter table public.campaign_kill_team_members
  add column chapter text check (chapter is null or
    (chapter = btrim(chapter) and length(chapter) between 2 and 80 and chapter !~ '[[:cntrl:]]'));

create function public.discord_register_campaign_kill_team_with_chapter(
  p_campaign_id uuid, p_name text, p_leader_discord_user_id text,
  p_leader_display_name text, p_chapter text
) returns table (campaign_kill_team_id uuid, mission_team_count integer, new_revision bigint)
language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_result record;
  v_chapter text := nullif(btrim(p_chapter), '');
  v_mission_id uuid;
  v_revision bigint;
begin
  if p_chapter is not null and (v_chapter is null or length(v_chapter) not between 2 and 80 or v_chapter ~ '[[:cntrl:]]') then
    raise exception 'CHAPTER_INVALID';
  end if;
  select * into v_result from public.discord_register_campaign_kill_team(
    p_campaign_id, p_name, p_leader_discord_user_id, p_leader_display_name);
  v_revision := v_result.new_revision;
  if v_chapter is not null then
    update public.campaign_kill_teams set chapter = v_chapter
    where id = v_result.campaign_kill_team_id;
    select kt.mission_id into strict v_mission_id from public.kill_teams kt
    where kt.campaign_kill_team_id = v_result.campaign_kill_team_id order by kt.mission_id limit 1;
    select audit.new_revision into v_revision from private.record_kill_team_registration_update(
      p_campaign_id, v_mission_id, v_revision, null,
      jsonb_build_object('chapter', null),
      jsonb_build_object('action', 'SET_TEAM_CHAPTER', 'campaign_kill_team_id', v_result.campaign_kill_team_id,
        'chapter', v_chapter, 'discord_user_id', btrim(p_leader_discord_user_id))
    ) audit;
  end if;
  return query select v_result.campaign_kill_team_id, v_result.mission_team_count, v_revision;
end;
$$;

create function public.discord_set_chapter(
  p_campaign_id uuid, p_discord_user_id text, p_chapter text, p_for_team boolean default false
) returns void
language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_chapter text := btrim(p_chapter);
  v_member public.campaign_kill_team_members%rowtype;
  v_team public.campaign_kill_teams%rowtype;
  v_old_chapter text;
  v_revision bigint;
  v_mission_id uuid;
begin
  if v_chapter is null or length(v_chapter) not between 2 and 80 or v_chapter ~ '[[:cntrl:]]' then
    raise exception 'CHAPTER_INVALID';
  end if;
  if p_discord_user_id is null or p_discord_user_id !~ '^[0-9]{17,20}$' then
    raise exception 'KILL_TEAM_MEMBER_NOT_FOUND';
  end if;
  select state.revision into strict v_revision
  from public.live_campaign_states state join public.campaigns c on c.id = state.campaign_id
  where state.campaign_id = p_campaign_id and c.status = 'ACTIVE'
  for update of state;
  select * into v_member from public.campaign_kill_team_members
  where campaign_id = p_campaign_id and discord_user_id = p_discord_user_id for update;
  if not found then raise exception 'KILL_TEAM_MEMBER_NOT_FOUND'; end if;
  select m.id into v_mission_id from public.missions m
  join public.kill_teams t on t.mission_id = m.id
  where t.campaign_kill_team_id = v_member.campaign_kill_team_id
    and m.status in ('DRAFT', 'READY', 'ACTIVE')
  order by (m.status = 'ACTIVE') desc, m.id limit 1;
  if v_mission_id is null then raise exception 'KILL_TEAM_REGISTRATION_LOCKED'; end if;
  if p_for_team then
    select * into strict v_team from public.campaign_kill_teams where id = v_member.campaign_kill_team_id for update;
    if v_team.leader_discord_user_id <> p_discord_user_id then raise exception 'KILL_TEAM_LEADER_NOT_FOUND'; end if;
    v_old_chapter := v_team.chapter;
    if v_old_chapter is not distinct from v_chapter then return; end if;
    update public.campaign_kill_teams set chapter = v_chapter where id = v_team.id;
  else
    v_old_chapter := v_member.chapter;
    if v_old_chapter is not distinct from v_chapter then return; end if;
    update public.campaign_kill_team_members set chapter = v_chapter where id = v_member.id;
  end if;
  perform private.record_kill_team_registration_update(
    p_campaign_id, v_mission_id, v_revision, null,
    jsonb_build_object('chapter', v_old_chapter),
    jsonb_build_object('action', case when p_for_team then 'SET_TEAM_CHAPTER' else 'SET_MEMBER_CHAPTER' end, 'campaign_kill_team_id', v_member.campaign_kill_team_id,
      'discord_user_id', p_discord_user_id, 'chapter', v_chapter)
  );
end;
$$;

revoke all on function public.discord_register_campaign_kill_team_with_chapter(uuid,text,text,text,text)
  from public, anon, authenticated;
revoke all on function public.discord_set_chapter(uuid,text,text,boolean)
  from public, anon, authenticated;
grant execute on function public.discord_register_campaign_kill_team_with_chapter(uuid,text,text,text,text) to service_role;
grant execute on function public.discord_set_chapter(uuid,text,text,boolean) to service_role;

create or replace function public.get_public_sync_snapshot()
returns jsonb language sql stable security definer
set search_path = pg_catalog, public
as $$
  with active_campaigns as materialized (select * from public.get_public_active_campaign()),
  latest_signal as materialized (select * from public.get_public_latest_sync_signal())
  select jsonb_build_object(
    'active_campaign_count', (select count(*) from active_campaigns),
    'campaign', (
      select to_jsonb(ac) || jsonb_build_object('kill_teams', coalesce((
        select jsonb_agg(entry.value || jsonb_build_object(
          'chapter', ct.chapter,
          'members', coalesce((
            select jsonb_agg(jsonb_build_object(
              'display_name', km.display_name, 'chapter', coalesce(cm.chapter, ct.chapter)
            ) order by km.display_name, km.id)
            from public.kill_team_members km
            left join public.campaign_kill_team_members cm
              on cm.campaign_kill_team_id = kt.campaign_kill_team_id and cm.discord_user_id = km.discord_user_id
            where km.kill_team_id = kt.id
          ), '[]'::jsonb)
        ) order by entry.ordinality)
        from jsonb_array_elements(to_jsonb(ac)->'kill_teams') with ordinality entry(value, ordinality)
        join public.kill_teams kt on kt.id = (entry.value->>'id')::uuid
        left join public.campaign_kill_teams ct on ct.id = kt.campaign_kill_team_id
      ), '[]'::jsonb))
      from active_campaigns ac limit 1
    ),
    'signal', (select to_jsonb(signal) from latest_signal signal)
  );
$$;

comment on column public.campaign_kill_teams.chapter is 'Leader-entered default Chapter / Warband; members may override their own affiliation.';
comment on column public.campaign_kill_team_members.chapter is 'Member-selected Chapter / Warband override, editable by that Discord identity through the service-only RPC.';

commit;
