begin;
create extension if not exists pgtap;
set local search_path = public, extensions, pg_catalog;
set local plpgsql.check_asserts = on;
select plan(1);

-- Synthetic records only; the entire scenario rolls back, including audit/revisions.
do $$
declare
  c uuid := '28000000-0000-4000-8000-000000000001';
  b uuid := '28000000-0000-4000-8000-000000000101';
  m uuid := '28000000-0000-4000-8000-000000000201';
  m2 uuid := '28000000-0000-4000-8000-000000000202';
  leader text := '928000000000000001';
  member text := '928000000000000002';
  successor text := '928000000000000003';
  other_member text := '928000000000000004';
  outsider text := '928000000000000005';
  team_id uuid;
  fault_team uuid;
  child_id uuid;
  rev bigint;
  result record;
begin
  assert not has_function_privilege('anon', 'public.discord_remove_campaign_kill_team_member(uuid,text,text)', 'EXECUTE'), 'anonymous removal must remain denied';
  assert not has_function_privilege('authenticated', 'public.discord_remove_campaign_kill_team_member(uuid,text,text)', 'EXECUTE'), 'browser clients cannot impersonate a Discord caller';
  assert has_function_privilege('service_role', 'public.discord_remove_campaign_kill_team_member(uuid,text,text)', 'EXECUTE'), 'trusted bot retains removal access';

  insert into public.campaigns(id,name,status) values(c,'Self-removal regression fixture','ACTIVE');
  insert into public.battlefields(id,name,slug) values(b,'Self-removal test field','self-removal-regression-field');
  insert into public.missions(id,campaign_id,battlefield_id,name,enemy_faction)
  values(m,c,b,'Removal mission one','Test targets'),(m2,c,b,'Removal mission two','Test targets');
  select campaign_kill_team_id into team_id from public.discord_register_campaign_kill_team(c,'Original roster',leader,'Leader');
  perform public.discord_add_campaign_kill_team_member(c,leader,member,'Member');
  perform public.discord_add_campaign_kill_team_member(c,leader,successor,'Successor');
  perform public.discord_add_campaign_kill_team_member(c,leader,other_member,'Other');
  update public.campaign_kill_team_members set created_at = '2026-01-01'::timestamptz
  where campaign_kill_team_id=team_id and discord_user_id=successor;

  -- Being a member does not confer permission to remove another account.
  begin
    perform public.discord_remove_campaign_kill_team_member(c,member,successor);
    raise exception 'Ordinary member removed another account';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'KILL_TEAM_LEADER_NOT_FOUND' then raise; end if;
  end;
  select * into result from public.discord_remove_campaign_kill_team_member(c,member,member);
  assert result.member_count=3 and result.mission_team_count=2, 'ordinary self-removal returns remaining roster and both mission projections';
  assert not exists(select 1 from public.campaign_kill_team_members where campaign_id=c and discord_user_id=member), 'self-removal releases campaign membership';
  assert not exists(select 1 from public.kill_team_members where mission_id in(m,m2) and discord_user_id=member), 'self-removal removes every unlocked mission membership';
  assert (select leader_discord_user_id=leader from public.campaign_kill_teams where id=team_id), 'ordinary self-removal preserves leader';
  perform public.discord_register_campaign_kill_team(c,'Member new team',member,'Member');
  assert (select count(*)=1 from public.campaign_kill_team_members where campaign_id=c and discord_user_id=member), 'departed member can register elsewhere without duplicate membership';

  begin
    perform public.discord_remove_campaign_kill_team_member(c,member,successor);
    raise exception 'Foreign leader removed another team member';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'KILL_TEAM_MEMBER_NOT_FOUND' then raise; end if;
  end;
  perform public.discord_remove_campaign_kill_team_member(c,leader,other_member);
  assert (select count(*)=2 from public.campaign_kill_team_members where campaign_kill_team_id=team_id), 'leader still can remove another member';
  select revision into rev from public.live_campaign_states where campaign_id=c;
  select * into result from public.discord_remove_campaign_kill_team_member(c,leader,leader);
  assert result.member_count=1 and result.new_revision=rev+3, 'leader departure advances one audited campaign revision plus both mission revisions';
  assert (select leader_discord_user_id=successor from public.campaign_kill_teams where id=team_id), 'leadership transfers to longest-standing remaining member';
  assert (select count(*)=2 from public.kill_team_members where mission_id in(m,m2) and discord_user_id=successor), 'successor remains on both mission rosters';
  assert not exists(select 1 from public.kill_team_members where mission_id in(m,m2) and discord_user_id=leader), 'departing leader removed from all unlocked projections';
  assert exists(select 1 from public.campaign_updates where campaign_id=c and new_values->>'requesting_discord_user_id'=leader and new_values->>'leader_discord_user_id'=successor), 'audit records verified caller and leadership handover';
  perform public.discord_register_campaign_kill_team(c,'Leader new team',leader,'Leader');

  select * into result from public.discord_remove_campaign_kill_team_member(c,successor,successor);
  assert result.member_count=0 and result.mission_team_count=2, 'last-member departure succeeds';
  assert not exists(select 1 from public.campaign_kill_teams where id=team_id), 'empty campaign registration removed';
  assert not exists(select 1 from public.kill_teams where campaign_kill_team_id=team_id), 'empty unlocked mission projections removed';
  assert exists(select 1 from public.campaign_updates where campaign_id=c and new_values->>'action'='EMPTY_TEAM_REMOVED'), 'empty team departure leaves immutable audit';
  select revision into rev from public.live_campaign_states where campaign_id=c;
  begin
    perform public.discord_remove_campaign_kill_team_member(c,successor,successor);
    raise exception 'Repeat removal unexpectedly succeeded';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'KILL_TEAM_LEADER_NOT_FOUND' then raise; end if;
  end;
  assert (select revision=rev from public.live_campaign_states where campaign_id=c), 'repeat request has no revision or roster effects';
  perform public.discord_register_campaign_kill_team(c,'Successor new team',successor,'Successor');

  -- A failure after leadership changes must roll back every mutation and audit entry.
  select campaign_kill_team_id into fault_team from public.discord_register_campaign_kill_team(c,'Atomic rollback fixture','928000000000000006','Rollback leader');
  perform public.discord_add_campaign_kill_team_member(c,'928000000000000006','928000000000000007','Rollback partner');
  delete from public.kill_team_members where mission_id=m and discord_user_id='928000000000000007';
  select revision into rev from public.live_campaign_states where campaign_id=c;
  perform private.create_kill_team(m,rev,'Conflicting projection fixture',
    '[{"discord_user_id":"928000000000000007","display_name":"Conflicting partner"}]'::jsonb,null);
  select revision into rev from public.live_campaign_states where campaign_id=c;
  begin
    perform public.discord_remove_campaign_kill_team_member(c,'928000000000000006','928000000000000006');
    raise exception 'Conflicting mission projection unexpectedly accepted';
  exception when unique_violation then null;
  end;
  assert (select leader_discord_user_id='928000000000000006' from public.campaign_kill_teams where id=fault_team), 'downstream error rolls back leadership handover';
  assert (select count(*)=2 from public.campaign_kill_team_members where campaign_kill_team_id=fault_team), 'downstream error restores departing membership';
  assert (select revision=rev from public.live_campaign_states where campaign_id=c), 'downstream error rolls back revisions and audit';
  assert not exists(select 1 from public.campaign_updates where campaign_id=c and new_revision>rev), 'downstream error leaves no misleading audit entries';

  -- Projection corruption must roll back without removing the parent/member.
  select campaign_kill_team_id into fault_team from public.discord_register_campaign_kill_team(c,'Projection fixture',outsider,'Outsider');
  select id into child_id from public.kill_teams where campaign_kill_team_id=fault_team order by id limit 1;
  select revision into rev from public.live_campaign_states where campaign_id=c;
  perform private.delete_kill_team(child_id,rev,null);
  select revision into rev from public.live_campaign_states where campaign_id=c;
  begin
    perform public.discord_remove_campaign_kill_team_member(c,outsider,outsider);
    raise exception 'Incomplete projection unexpectedly accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'KILL_TEAM_MISSION_PROJECTION_MISMATCH' then raise; end if;
  end;
  assert exists(select 1 from public.campaign_kill_team_members where campaign_kill_team_id=fault_team and discord_user_id=outsider), 'projection failure preserves original membership';
  assert (select revision=rev from public.live_campaign_states where campaign_id=c), 'projection failure does not publish a partial revision';

  -- Mission locks are enforced through the real lifecycle function.
  insert into public.objectives(mission_id,title) values(m,'Fixture objective');
  insert into public.mission_enemy_entries(mission_id,name) values(m,'Fixture enemy');
  perform public.transition_mission_state(m,rev,'READY',null);
  select revision into rev from public.live_campaign_states where campaign_id=c;
  perform public.transition_mission_state(m,rev,'ACTIVE',null);
  select revision into rev from public.live_campaign_states where campaign_id=c;
  begin
    perform public.discord_remove_campaign_kill_team_member(c,leader,leader);
    raise exception 'Active mission roster was modified';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'KILL_TEAM_REGISTRATION_LOCKED' then raise; end if;
  end;
  assert exists(select 1 from public.campaign_kill_team_members where campaign_id=c and discord_user_id=leader), 'active-roster lock preserves historical identity';
  assert (select revision=rev from public.live_campaign_states where campaign_id=c), 'locked request has no partial revision';
end;
$$;
select pass('Self-removal, leadership handover, empty-team cleanup, permissions, audit, atomicity and lifecycle checks pass');
select * from finish();
rollback;
