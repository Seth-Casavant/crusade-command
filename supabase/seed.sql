-- SANDBOX TEST DATA ONLY. This file is loaded after migrations during db reset.

-- These local Auth identities have no password or reusable credential. Database
-- authorization tests simulate signed Supabase JWT claims for these user IDs.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  phone_change,
  phone_change_token,
  email_change_token_current,
  reauthentication_token,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_sso_user,
  is_anonymous
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'administrator@crusade-command.invalid',
    '',
    statement_timestamp(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"sandbox":true}'::jsonb,
    statement_timestamp(),
    statement_timestamp(),
    false,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'moderator@crusade-command.invalid',
    '',
    statement_timestamp(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"sandbox":true}'::jsonb,
    statement_timestamp(),
    statement_timestamp(),
    false,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'player@crusade-command.invalid',
    '',
    statement_timestamp(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"sandbox":true}'::jsonb,
    statement_timestamp(),
    statement_timestamp(),
    false,
    false
  )
on conflict (id) do nothing;

-- GoTrue requires a provider identity as well as an auth.users row before an
-- existing passwordless email account can request and verify a one-time code.
insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) values
  (
    'b0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    '{"sub":"a0000000-0000-4000-8000-000000000001","email":"administrator@crusade-command.invalid","email_verified":true,"phone_verified":false}'::jsonb,
    'email',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'b0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000002',
    '{"sub":"a0000000-0000-4000-8000-000000000002","email":"moderator@crusade-command.invalid","email_verified":true,"phone_verified":false}'::jsonb,
    'email',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'b0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000003',
    '{"sub":"a0000000-0000-4000-8000-000000000003","email":"player@crusade-command.invalid","email_verified":true,"phone_verified":false}'::jsonb,
    'email',
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp()
  )
on conflict (provider_id, provider) do nothing;

insert into public.app_users (user_id, role)
values
  (
    'a0000000-0000-4000-8000-000000000001',
    'ADMINISTRATOR'
  ),
  (
    'a0000000-0000-4000-8000-000000000002',
    'MODERATOR'
  ),
  (
    'a0000000-0000-4000-8000-000000000003',
    'PLAYER'
  )
on conflict (user_id) do nothing;

insert into public.campaigns (id, name, description)
values (
  '00000000-0000-4000-8000-000000000001',
  'Sandbox Crusade',
  'Test data for local development. Not a live Crusade.'
)
on conflict (id) do nothing;

insert into public.battlefields (id, name, slug, description)
values
  (
    '00000000-0000-4000-8000-000000000101',
    'Termination',
    'termination',
    'Reusable sandbox battlefield definition.'
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    'Vox Liberatis',
    'vox-liberatis',
    'Reusable sandbox battlefield definition.'
  ),
  (
    '00000000-0000-4000-8000-000000000103',
    'Reclamation',
    'reclamation',
    'Reusable sandbox battlefield definition.'
  ),
  (
    '00000000-0000-4000-8000-000000000104',
    'Disruption',
    'disruption',
    'Reusable sandbox battlefield definition.'
  )
on conflict (id) do nothing;

insert into public.missions (
  id,
  campaign_id,
  battlefield_id,
  name,
  description,
  enemy_faction,
  mission_boss_key,
  mission_boss_display_name
) values (
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000101',
  'Sandbox Mission One',
  'Prepared mission data used only for local database verification.',
  'Sandbox Hostile Force',
  'sandbox-mission-boss',
  'Sandbox Mission Boss'
)
on conflict (id) do nothing;

insert into public.objectives (
  id,
  mission_id,
  title,
  description,
  sort_order
) values (
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000201',
  'Secure the relay nexus',
  'Placeholder objective for local testing.',
  0
)
on conflict (id) do nothing;

insert into public.mission_enemy_entries (
  id,
  mission_id,
  name,
  enemy_type,
  description,
  sort_order
) values (
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000201',
  'Sandbox Hostile Contact',
  'Fixture contact',
  'Placeholder hostile information for local testing.',
  0
)
on conflict (id) do nothing;

insert into public.mission_crusade_scoring_targets (
  mission_id,
  target_key,
  display_name,
  sort_order
) values
  (
    '00000000-0000-4000-8000-000000000201',
    'sandbox-terminus-target-alpha',
    'Sandbox Terminus Target Alpha',
    0
  ),
  (
    '00000000-0000-4000-8000-000000000201',
    'sandbox-terminus-target-beta',
    'Sandbox Terminus Target Beta',
    1
  )
on conflict (mission_id, target_key) do nothing;

insert into public.mission_battlefield_checkpoints (
  id,
  mission_id,
  checkpoint_key,
  name,
  normalized_x,
  normalized_y,
  sort_order
) values
  (
    '00000000-0000-4000-8000-000000000711',
    '00000000-0000-4000-8000-000000000201',
    'sandbox-deployment',
    'Sandbox Deployment Point',
    0.18,
    0.24,
    0
  ),
  (
    '00000000-0000-4000-8000-000000000712',
    '00000000-0000-4000-8000-000000000201',
    'sandbox-relay',
    'Sandbox Relay Node',
    0.48,
    0.46,
    1
  ),
  (
    '00000000-0000-4000-8000-000000000713',
    '00000000-0000-4000-8000-000000000201',
    'sandbox-extraction',
    'Sandbox Extraction Zone',
    0.76,
    0.72,
    2
  )
on conflict (id) do nothing;

insert into public.kill_teams (
  id,
  mission_id,
  name,
  current_checkpoint_id
) values
  (
    '00000000-0000-4000-8000-000000000501',
    '00000000-0000-4000-8000-000000000201',
    'Sandbox Kill Team Alpha',
    '00000000-0000-4000-8000-000000000712'
  ),
  (
    '00000000-0000-4000-8000-000000000502',
    '00000000-0000-4000-8000-000000000201',
    'Sandbox Kill Team Beta',
    '00000000-0000-4000-8000-000000000712'
  )
on conflict (id) do nothing;

insert into public.kill_team_members (
  id,
  kill_team_id,
  mission_id,
  discord_user_id,
  display_name
) values
  (
    '00000000-0000-4000-8000-000000000601',
    '00000000-0000-4000-8000-000000000501',
    '00000000-0000-4000-8000-000000000201',
    '900000000000000001',
    'Sandbox Alpha One'
  ),
  (
    '00000000-0000-4000-8000-000000000602',
    '00000000-0000-4000-8000-000000000501',
    '00000000-0000-4000-8000-000000000201',
    '900000000000000002',
    'Sandbox Alpha Two'
  ),
  (
    '00000000-0000-4000-8000-000000000603',
    '00000000-0000-4000-8000-000000000502',
    '00000000-0000-4000-8000-000000000201',
    '900000000000000003',
    'Sandbox Beta One'
  ),
    (
    '00000000-0000-4000-8000-000000000604',
    '00000000-0000-4000-8000-000000000502',
    '00000000-0000-4000-8000-000000000201',
    '900000000000000004',
    'Sandbox Beta Two'
  ),
  (
    '00000000-0000-4000-8000-000000000605',
    '00000000-0000-4000-8000-000000000501',
    '00000000-0000-4000-8000-000000000201',
    '615704003875045386',
    'Omnial'
  ),
  (
    '00000000-0000-4000-8000-000000000606',
    '00000000-0000-4000-8000-000000000501',
    '00000000-0000-4000-8000-000000000201',
    '309027107697197058',
    'Ryu'
  ),
  (
    '00000000-0000-4000-8000-000000000607',
    '00000000-0000-4000-8000-000000000501',
    '00000000-0000-4000-8000-000000000201',
    '491639463995506711',
    'Only Fangs'
  ),
  (
    '00000000-0000-4000-8000-000000000608',
    '00000000-0000-4000-8000-000000000501',
    '00000000-0000-4000-8000-000000000201',
    '783536291240476692',
    'Decimus'
  ),
  (
    '00000000-0000-4000-8000-000000000609',
    '00000000-0000-4000-8000-000000000501',
    '00000000-0000-4000-8000-000000000201',
    '1230227705656512514',
    'Spoot'
  ),
  (
    '00000000-0000-4000-8000-000000000610',
    '00000000-0000-4000-8000-000000000501',
    '00000000-0000-4000-8000-000000000201',
    '883445785721712722',
    'Rev'
  ),
  (
    '00000000-0000-4000-8000-000000000611',
    '00000000-0000-4000-8000-000000000501',
    '00000000-0000-4000-8000-000000000201',
    '1216224946011902044',
    'King_Gregly'
  ),
  (
    '00000000-0000-4000-8000-000000000612',
    '00000000-0000-4000-8000-000000000501',
    '00000000-0000-4000-8000-000000000201',
    '476795480999723028',
    'Void'
  ),
  (
    '00000000-0000-4000-8000-000000000613',
    '00000000-0000-4000-8000-000000000501',
    '00000000-0000-4000-8000-000000000201',
    '961898713519910952',
    'Tennis'
      ),
  (
    '00000000-0000-4000-8000-000000000614',
    '00000000-0000-4000-8000-000000000501',
    '00000000-0000-4000-8000-000000000201',
    '585132035199336633',
    'Varseus'
  )
on conflict (id) do nothing;

do $$
declare
  v_status public.mission_status;
  v_revision bigint;
begin
  select m.status
  into v_status
  from public.missions as m
  where m.id = '00000000-0000-4000-8000-000000000201';

  if v_status = 'DRAFT' then
    select lcs.revision
    into v_revision
    from public.live_campaign_states as lcs
    where lcs.campaign_id = '00000000-0000-4000-8000-000000000001';

    perform *
    from public.transition_mission_state(
      '00000000-0000-4000-8000-000000000201',
      v_revision,
      'READY'
    );
  end if;

  select m.status, lcs.revision
  into v_status, v_revision
  from public.missions as m
  join public.live_campaign_states as lcs
    on lcs.campaign_id = m.campaign_id
  where m.id = '00000000-0000-4000-8000-000000000201';

  if v_status = 'READY' then
    perform set_config(
      'crusade.kill_team_operational_status_write',
      'on',
      true
    );

    update public.kill_teams
    set operational_status = case id
      when '00000000-0000-4000-8000-000000000501' then 'ADVANCING'
      when '00000000-0000-4000-8000-000000000502' then 'DEPLOYED'
      else operational_status
    end
    where id in (
      '00000000-0000-4000-8000-000000000501',
      '00000000-0000-4000-8000-000000000502'
    );

    perform set_config(
      'crusade.kill_team_operational_status_write',
      'off',
      true
    );

    perform *
    from public.transition_mission_state(
      '00000000-0000-4000-8000-000000000201',
      v_revision,
      'ACTIVE'
    );
  end if;
end;
$$;

-- Synthetic progress values exercise aggregate presentation only. They are not
-- approved Crusade scoring rules and deliberately avoid round example awards.
insert into public.kill_team_progress_ledger (
  id,
  campaign_id,
  mission_id,
  kill_team_id,
  event_type,
  point_delta,
  description,
  scoring_target_key,
  campaign_revision,
  actor_id
) values
  (
    '00000000-0000-4000-8000-000000000751',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000501',
    'TERMINUS_KILL',
    7,
    'Synthetic Alpha Terminus validation event',
    null,
    3,
    'a0000000-0000-4000-8000-000000000001'
  ),
  (
    '00000000-0000-4000-8000-000000000752',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000501',
    'OBJECTIVE',
    13,
    'Synthetic Alpha objective validation event',
    null,
    3,
    'a0000000-0000-4000-8000-000000000001'
  ),
  (
    '00000000-0000-4000-8000-000000000753',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000502',
    'MISSION_COMPLETION',
    4,
    'Synthetic Beta completion validation event',
    null,
    3,
    'a0000000-0000-4000-8000-000000000001'
  )
on conflict (id) do nothing;
