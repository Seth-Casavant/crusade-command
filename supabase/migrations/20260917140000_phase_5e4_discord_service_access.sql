begin;

grant select (kill_team_id, mission_id, discord_user_id)
on public.kill_team_members
to service_role;

grant execute on function public.get_public_sync_snapshot()
to service_role;

commit;
