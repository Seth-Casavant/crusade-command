begin;
create function public.discord_set_chapter_for_member(
  p_campaign_id uuid, p_requesting_discord_user_id text, p_member_discord_user_id text, p_chapter text
) returns void language plpgsql security definer set search_path = pg_catalog, public, private
as $$
declare
  v_actor public.campaign_kill_team_members%rowtype;
  v_member public.campaign_kill_team_members%rowtype;
  v_chapter text := btrim(p_chapter);
  v_revision bigint;
  v_mission uuid;
begin
  if v_chapter is null or length(v_chapter) not between 2 and 80 or v_chapter ~ '[[:cntrl:]]' then raise exception 'CHAPTER_INVALID'; end if;
  if p_requesting_discord_user_id is null or p_requesting_discord_user_id !~ '^[0-9]{17,20}$' or p_member_discord_user_id is null or p_member_discord_user_id !~ '^[0-9]{17,20}$' then raise exception 'KILL_TEAM_MEMBER_NOT_FOUND'; end if;
  select state.revision into strict v_revision from public.live_campaign_states state
  join public.campaigns c on c.id=state.campaign_id
  where state.campaign_id=p_campaign_id and c.status='ACTIVE' for update of state;
  select * into v_actor from public.campaign_kill_team_members
  where campaign_id=p_campaign_id and discord_user_id=p_requesting_discord_user_id;
  if not found then raise exception 'KILL_TEAM_MEMBER_NOT_FOUND'; end if;
  select * into v_member from public.campaign_kill_team_members
  where campaign_id=p_campaign_id and discord_user_id=p_member_discord_user_id
    and campaign_kill_team_id=v_actor.campaign_kill_team_id for update;
  if not found then raise exception 'KILL_TEAM_MEMBER_NOT_FOUND'; end if;
  if p_requesting_discord_user_id <> p_member_discord_user_id and not exists(
    select 1 from public.campaign_kill_teams where id=v_actor.campaign_kill_team_id and leader_discord_user_id=p_requesting_discord_user_id
  ) then raise exception 'KILL_TEAM_LEADER_NOT_FOUND'; end if;
  select m.id into v_mission from public.missions m join public.kill_teams t on t.mission_id=m.id
  where t.campaign_kill_team_id=v_member.campaign_kill_team_id and m.status in ('DRAFT','READY','ACTIVE')
  order by (m.status='ACTIVE') desc,m.id limit 1;
  if v_mission is null then raise exception 'KILL_TEAM_REGISTRATION_LOCKED'; end if;
  if v_member.chapter is not distinct from v_chapter then return; end if;
  update public.campaign_kill_team_members set chapter=v_chapter where id=v_member.id;
  perform private.record_kill_team_registration_update(p_campaign_id,v_mission,v_revision,null,
    jsonb_build_object('chapter',v_member.chapter),
    jsonb_build_object('action','SET_MEMBER_CHAPTER','campaign_kill_team_id',v_member.campaign_kill_team_id,
      'requesting_discord_user_id',p_requesting_discord_user_id,'member_discord_user_id',p_member_discord_user_id,'chapter',v_chapter));
end;
$$;
revoke all on function public.discord_set_chapter_for_member(uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.discord_set_chapter_for_member(uuid,text,text,text) to service_role;
commit;
