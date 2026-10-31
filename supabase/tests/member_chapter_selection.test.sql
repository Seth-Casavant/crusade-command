begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,pg_catalog;
select plan(1);
do $test$
declare
  v_campaign uuid := '20261031-0000-4000-8000-000000000901';
  v_mission uuid := '20261031-0000-4000-8000-000000000902';
  v_team uuid;
  v_revision bigint;
  v_after bigint;
begin
  if has_function_privilege('anon','public.discord_set_chapter(uuid,text,text,boolean)','execute')
     or has_function_privilege('authenticated','public.discord_set_chapter(uuid,text,text,boolean)','execute')
     or not has_function_privilege('service_role','public.discord_set_chapter(uuid,text,text,boolean)','execute') then
    raise exception 'chapter permissions failed';
  end if;
  insert into public.campaigns(id,name,status) values(v_campaign,'Chapter rollback test','ACTIVE');
  insert into public.missions(id,campaign_id,battlefield_id,name,description,enemy_faction)
  values(v_mission,v_campaign,(select id from public.battlefields order by id limit 1),'Chapter test','Rollback-only fixture','Test');
  select campaign_kill_team_id,new_revision into v_team,v_revision
  from public.discord_register_campaign_kill_team_with_chapter(v_campaign,'Chapter Test Team','930000000000000091','Chapter Test Leader','  Night Lords  ');
  if (select chapter from public.campaign_kill_teams where id=v_team) <> 'Night Lords' then raise exception 'default chapter not saved'; end if;
  perform public.discord_add_campaign_kill_team_member(v_campaign,'930000000000000091','930000000000000092','Chapter Test Member');
  select revision into v_revision from public.live_campaign_states where campaign_id=v_campaign;
  perform public.discord_set_chapter(v_campaign,'930000000000000092','  Dark Angels  ');
  if (select chapter from public.campaign_kill_team_members where campaign_id=v_campaign and discord_user_id='930000000000000092') <> 'Dark Angels' then raise exception 'member chapter not saved'; end if;
  if (select chapter from public.campaign_kill_team_members where campaign_id=v_campaign and discord_user_id='930000000000000091') is not null then raise exception 'changed another member'; end if;
  select revision into v_after from public.live_campaign_states where campaign_id=v_campaign;
  if v_after <> v_revision + 1 then raise exception 'revision not incremented'; end if;
  perform public.discord_set_chapter(v_campaign,'930000000000000092','Dark Angels');
  if (select revision from public.live_campaign_states where campaign_id=v_campaign) <> v_after then raise exception 'identical update changed revision'; end if;
  begin
    perform public.discord_set_chapter(v_campaign,'930000000000000099','Iron Hands');
    raise exception 'unregistered member accepted';
  exception when raise_exception then
    if sqlerrm <> 'KILL_TEAM_MEMBER_NOT_FOUND' then raise; end if;
  end;
  begin
    perform public.discord_set_chapter(v_campaign,'930000000000000092',' ');
    raise exception 'blank chapter accepted';
  exception when raise_exception then
    if sqlerrm <> 'CHAPTER_INVALID' then raise; end if;
  end;
  begin
    perform public.discord_set_chapter(v_campaign,'930000000000000092','Iron Hands',true);
    raise exception 'non-leader changed team';
  exception when raise_exception then
    if sqlerrm <> 'KILL_TEAM_LEADER_NOT_FOUND' then raise; end if;
  end;
  perform public.discord_set_chapter(v_campaign,'930000000000000091','Raven Guard',true);
  if (select chapter from public.campaign_kill_teams where id=v_team) <> 'Raven Guard' then raise exception 'leader cannot change team chapter'; end if;
  if (select chapter from public.campaign_kill_team_members where campaign_id=v_campaign and discord_user_id='930000000000000092') <> 'Dark Angels' then raise exception 'team change erased override'; end if;
  if not exists(select 1 from public.campaign_updates where campaign_id=v_campaign and new_values->>'action'='SET_MEMBER_CHAPTER') then raise exception 'missing audit'; end if;
end;
$test$;


do $target_tests$
declare c uuid := '20261031-0000-4000-8000-000000000901';
begin
  if has_function_privilege('anon','public.discord_set_chapter_for_member(uuid,text,text,text)','execute')
    or has_function_privilege('authenticated','public.discord_set_chapter_for_member(uuid,text,text,text)','execute') then raise exception 'untrusted chapter write'; end if;
  perform public.discord_set_chapter_for_member(c,'930000000000000091','930000000000000092','Salamanders');
  if (select chapter from public.campaign_kill_team_members where campaign_id=c and discord_user_id='930000000000000092') <> 'Salamanders' then raise exception 'leader target update failed'; end if;
  begin
    perform public.discord_set_chapter_for_member(c,'930000000000000092','930000000000000091','Iron Hands');
    raise exception 'member edited another member';
  exception when raise_exception then if sqlerrm <> 'KILL_TEAM_LEADER_NOT_FOUND' then raise; end if; end;
  perform public.discord_register_campaign_kill_team_with_chapter(c,'Other Chapter Team','930000000000000096','Other Leader','Ultramarines');
  begin
    perform public.discord_set_chapter_for_member(c,'930000000000000091','930000000000000096','Iron Hands');
    raise exception 'cross-team edit accepted';
  exception when raise_exception then if sqlerrm <> 'KILL_TEAM_MEMBER_NOT_FOUND' then raise; end if; end;
  perform public.discord_set_chapter_for_member(c,'930000000000000092','930000000000000092','Dark Angels');
  if not exists(select 1 from public.campaign_updates where campaign_id=c and new_values->>'requesting_discord_user_id'='930000000000000091' and new_values->>'member_discord_user_id'='930000000000000092') then raise exception 'requester and target audit missing'; end if;
end;
$target_tests$;
select pass('Leader target edits, member self-edits, team boundaries and audit identities are enforced');
select * from finish();
rollback;
