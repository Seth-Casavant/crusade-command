begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;
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

do $controls$
declare
  c uuid := '20261031-0000-4000-8000-000000000901';
  m uuid := '20261031-0000-4000-8000-000000000902';
  r bigint;
  new_team uuid;
  child_team uuid;
  submission uuid;
  points bigint;
  v_admin uuid;
  old_claims text := current_setting('request.jwt.claims',true);
begin
  insert into public.objectives(mission_id,title,sort_order) values(m,'Control test objective',0);
  insert into public.mission_enemy_entries(mission_id,name,sort_order) values(m,'Test enemy',0);
  insert into public.mission_crusade_scoring_targets(mission_id,target_key,display_name,sort_order) values(m,'carnifex','Carnifex',0);
  select revision into r from public.live_campaign_states where campaign_id=c;
  perform private.transition_mission_state(m,r,'READY',null);
  select revision into r from public.live_campaign_states where campaign_id=c;
  perform private.transition_mission_state(m,r,'ACTIVE',null);
  select campaign_kill_team_id into new_team from public.discord_register_campaign_kill_team_with_chapter(c,'Late Arrival Team','930000000000000093','Late Leader','Night Lords');
  select id into strict child_team from public.kill_teams where campaign_kill_team_id=new_team and mission_id=m;
  perform public.discord_add_campaign_kill_team_member(c,'930000000000000093','930000000000000094','Late Member');
  perform public.discord_set_chapter(c,'930000000000000094','Salamanders',false);
  select revision into r from public.live_campaign_states where campaign_id=c;
  perform public.set_campaign_controls(c,r,true,true);
  begin
    perform public.discord_register_campaign_kill_team(c,'Blocked Team','930000000000000095','Blocked');
    raise exception 'registration not blocked';
  exception when raise_exception then
    if sqlerrm <> 'KILL_TEAM_REGISTRATION_LOCKED' then raise; end if;
  end;
  begin
    perform public.discord_add_campaign_kill_team_member(c,'930000000000000093','930000000000000095','Blocked');
    raise exception 'member add not blocked';
  exception when raise_exception then
    if sqlerrm <> 'KILL_TEAM_REGISTRATION_LOCKED' then raise; end if;
  end;
  begin
    update public.missions set description='Blocked edit' where id=m;
    raise exception 'settings not blocked';
  exception when raise_exception then
    if sqlerrm <> 'CAMPAIGN_DATA_LOCKED' then raise; end if;
  end;
  begin
    update public.campaigns set name='Blocked campaign edit' where id=c;
    raise exception 'campaign settings not blocked';
  exception when raise_exception then
    if sqlerrm <> 'CAMPAIGN_DATA_LOCKED' then raise; end if;
  end;
  perform public.discord_set_chapter(c,'930000000000000094','Iron Hands',false);
  select submission_id into submission from public.create_crusade_submission(c,m,child_team,'930000000000000094','TERMINUS_KILL',
    'rollback-evidence.png','image/png','https://cdn.discordapp.com/attachments/1/2/rollback-evidence.png','carnifex',null,null,100,'chapter-lock-rollback-test');
  select user_id into strict v_admin from public.app_users where role='ADMINISTRATOR';
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',v_admin)::text,true);
  select revision into r from public.live_campaign_states where campaign_id=c;
  select campaign_crusade_points into points from public.approve_crusade_submission(submission,5,r,null);
  if points <> 5 then raise exception 'approval scoring was blocked'; end if;
  perform set_config('request.jwt.claims',coalesce(old_claims,''),true);
  select revision into r from public.live_campaign_states where campaign_id=c;
  begin
    perform public.set_campaign_controls(c,r-1,false,false);
    raise exception 'stale control write accepted';
  exception when raise_exception then
    if sqlerrm <> 'REVISION_CONFLICT' then raise; end if;
  end;
  perform set_config('request.jwt.claims','{"role":"authenticated","sub":"20261031-0000-4000-8000-000000000999"}',true);
  begin
    perform public.set_campaign_controls(c,r,false,false);
    raise exception 'non-admin control write accepted';
  exception when raise_exception then
    if sqlerrm <> 'ADMINISTRATOR_REQUIRED' then raise; end if;
  end;
  perform set_config('request.jwt.claims',coalesce(old_claims,''),true);
  perform public.set_campaign_controls(c,r,false,false);
  update public.missions set description='Allowed after unlock' where id=m;
  perform public.discord_add_campaign_kill_team_member(c,'930000000000000093','930000000000000095','Allowed after unlock');
  if (public.get_campaign_controls(c)->>'registration_locked')::boolean then raise exception 'unlock did not persist'; end if;
  perform public.get_public_sync_snapshot();
end;
$controls$;

select pass('Active registration and independent settings locks preserve approval scoring and permissions');
select * from finish();
rollback;
