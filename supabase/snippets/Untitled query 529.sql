select
  display_name,
  discord_user_id,
  kill_team_id
from public.kill_team_members
where kill_team_id = '00000000-0000-4000-8000-000000000501'
order by display_name;