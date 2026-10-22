-- Run after migration 20261022140000. Publishing this copy does not activate a mission.
begin;
insert into public.event_briefing (id, published, title, description, targets, modes, rules)
values (
  true, true, 'The Midnight Hunt',
  'Ave Dominus Nox. Hunt Carnifex and Terminator Sorcerers across Siege and PvE Operations. Fight solo or with your Kill Team. The hunter with the most combined verified target kills earns the title The Midnight Reaper.',
  array['Carnifex', 'Terminator Sorcerer'],
  array['Siege', 'PvE / Operations'],
  array[
    'Submit screenshot evidence with /crusade-submit terminus. Select carnifex or terminator-sorcerer as the target.',
    'One approved Terminus submission counts as one kill. Combined verified Carnifex and Terminator Sorcerer kills determine the hunt standings.',
    'Staff review screenshots, approve or reject submissions, and assign points manually.',
    'Solo screenshots are welcome, including from registered Kill Team members.',
    'Individual and Kill Team competition. Staff credit participating players; each approved team submission earns one team kill and one team points award.'
  ]
)
on conflict (id) do update set
  published = excluded.published, title = excluded.title,
  description = excluded.description, targets = excluded.targets,
  modes = excluded.modes, rules = excluded.rules, updated_at = now();

update public.campaigns set description =
  'Night Lords // The Midnight Hunt. Hunt Carnifex and Terminator Sorcerers in Siege and PvE Operations. Combined verified target kills determine standings. Overall winner: The Midnight Reaper. Solo and Kill Team entries; screenshot evidence reviewed and points assigned manually by staff.'
where id = '20261021-0000-4000-8000-000000000001' and status = 'DRAFT';
update public.missions set name = 'The Midnight Hunt', description =
  'Eligible modes: Siege and PvE Operations. Targets: Carnifex and Terminator Sorcerer. Use /crusade-submit terminus; one approved submission counts as one kill. Staff assign points manually. Solo and Kill Team participation permitted. No event map required.'
where id = '20261021-0000-4000-8000-000000000201' and status = 'DRAFT';
commit;
