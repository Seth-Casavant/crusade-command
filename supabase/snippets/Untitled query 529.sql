select
  u.id,
  u.email,
  a.role
from auth.users u
left join public.app_users a
  on a.user_id = u.id
where u.email in (
  'administrator@crusade-command.invalid',
  'moderator@crusade-command.invalid',
  'player@crusade-command.invalid'
);