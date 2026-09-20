begin;

insert into public.campaigns (
  id,
  name,
  description,
  status
)
values (
  '10000000-0000-4000-8000-000000000001',
  'The War Call of Nexovar',
  'The live Crusade campaign for the War Call of Nexovar.',
  'ACTIVE'
);

insert into public.battlefields (
  id,
  name,
  slug,
  description
)
values
  (
    '10000000-0000-4000-8000-000000000101',
    'Termination',
    'termination',
    'Termination battlefield for the War Call of Nexovar.'
  ),
  (
    '10000000-0000-4000-8000-000000000102',
    'Vox Liberatis',
    'vox-liberatis',
    'Vox Liberatis battlefield for the War Call of Nexovar.'
  ),
  (
    '10000000-0000-4000-8000-000000000103',
    'Reclamation',
    'reclamation',
    'Reclamation battlefield for the War Call of Nexovar.'
  ),
  (
    '10000000-0000-4000-8000-000000000104',
    'Disruption',
    'disruption',
    'Disruption battlefield for the War Call of Nexovar.'
  );

insert into public.missions (
  id,
  campaign_id,
  battlefield_id,
  name,
  description
)
values
  (
    '10000000-0000-4000-8000-000000000201',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000101',
    'Termination',
    'Termination operation for the War Call of Nexovar.'
  ),
  (
    '10000000-0000-4000-8000-000000000202',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000102',
    'Vox Liberatis',
    'Vox Liberatis operation for the War Call of Nexovar.'
  ),
  (
    '10000000-0000-4000-8000-000000000203',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000103',
    'Reclamation',
    'Reclamation operation for the War Call of Nexovar.'
  ),
  (
    '10000000-0000-4000-8000-000000000204',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000104',
    'Disruption',
    'Disruption operation for the War Call of Nexovar.'
  );

commit;