begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.campaign_status as enum (
  'DRAFT',
  'ACTIVE',
  'COMPLETE'
);

create type public.mission_status as enum (
  'DRAFT',
  'READY',
  'ACTIVE',
  'COMPLETE',
  'ABORTED'
);

create type public.objective_status as enum (
  'PENDING',
  'ACTIVE',
  'COMPLETE'
);

create type public.campaign_update_type as enum (
  'MISSION_TRANSITION',
  'LIVE_STATE_UPDATE'
);

create table public.campaigns (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  description text,
  status public.campaign_status not null default 'DRAFT',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint campaigns_name_not_blank check (length(btrim(name)) > 0),
  constraint campaigns_description_not_blank check (
    description is null or length(btrim(description)) > 0
  )
);

create table public.battlefields (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  asset_reference text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint battlefields_name_not_blank check (length(btrim(name)) > 0),
  constraint battlefields_slug_format check (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint battlefields_description_not_blank check (
    description is null or length(btrim(description)) > 0
  ),
  constraint battlefields_asset_reference_not_blank check (
    asset_reference is null or length(btrim(asset_reference)) > 0
  )
);

create table public.missions (
  id uuid primary key default extensions.gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id)
    on update restrict on delete cascade,
  battlefield_id uuid references public.battlefields(id)
    on update restrict on delete restrict,
  name text not null,
  description text,
  status public.mission_status not null default 'DRAFT',
  enemy_faction text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint missions_campaign_and_id_unique unique (campaign_id, id),
  constraint missions_name_not_blank check (length(btrim(name)) > 0),
  constraint missions_description_not_blank check (
    description is null or length(btrim(description)) > 0
  ),
  constraint missions_enemy_faction_not_blank check (
    enemy_faction is null or length(btrim(enemy_faction)) > 0
  )
);

create unique index missions_one_active_per_campaign
  on public.missions (campaign_id)
  where status = 'ACTIVE';

create table public.objectives (
  id uuid primary key default extensions.gen_random_uuid(),
  mission_id uuid not null references public.missions(id)
    on update restrict on delete cascade,
  title text not null,
  description text,
  status public.objective_status not null default 'PENDING',
  sort_order integer not null default 0,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint objectives_title_not_blank check (length(btrim(title)) > 0),
  constraint objectives_description_not_blank check (
    description is null or length(btrim(description)) > 0
  ),
  constraint objectives_sort_order_nonnegative check (sort_order >= 0),
  constraint objectives_mission_sort_order_unique unique (mission_id, sort_order)
);

create table public.mission_enemy_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  mission_id uuid not null references public.missions(id)
    on update restrict on delete cascade,
  name text not null,
  enemy_type text,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint mission_enemy_entries_name_not_blank check (
    length(btrim(name)) > 0
  ),
  constraint mission_enemy_entries_type_not_blank check (
    enemy_type is null or length(btrim(enemy_type)) > 0
  ),
  constraint mission_enemy_entries_description_not_blank check (
    description is null or length(btrim(description)) > 0
  ),
  constraint mission_enemy_entries_sort_order_nonnegative check (
    sort_order >= 0
  ),
  constraint mission_enemy_entries_mission_sort_order_unique unique (
    mission_id,
    sort_order
  )
);

create table public.live_campaign_states (
  campaign_id uuid primary key references public.campaigns(id)
    on update restrict on delete cascade,
  current_mission_id uuid,
  campaign_progress smallint not null default 0,
  revision bigint not null default 1,
  last_update_id uuid not null default extensions.gen_random_uuid() unique,
  updated_at timestamptz not null default statement_timestamp(),
  updated_by uuid,
  constraint live_campaign_states_progress_range check (
    campaign_progress between 0 and 100
  ),
  constraint live_campaign_states_revision_positive check (revision >= 1),
  constraint live_campaign_states_current_mission_campaign_fk foreign key (
    campaign_id,
    current_mission_id
  ) references public.missions(campaign_id, id)
    on update restrict on delete restrict
);

create table public.campaign_updates (
  id uuid primary key default extensions.gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id)
    on update restrict on delete restrict,
  mission_id uuid references public.missions(id)
    on update restrict on delete restrict,
  previous_revision bigint not null,
  new_revision bigint not null,
  actor_id uuid,
  occurred_at timestamptz not null default statement_timestamp(),
  change_type public.campaign_update_type not null,
  old_values jsonb not null,
  new_values jsonb not null,
  constraint campaign_updates_revision_step check (
    new_revision = previous_revision + 1
  ),
  constraint campaign_updates_old_values_object check (
    jsonb_typeof(old_values) = 'object'
  ),
  constraint campaign_updates_new_values_object check (
    jsonb_typeof(new_values) = 'object'
  )
);

create index missions_campaign_id_idx on public.missions(campaign_id);
create index missions_battlefield_id_idx on public.missions(battlefield_id);
create index objectives_mission_id_idx on public.objectives(mission_id);
create index mission_enemy_entries_mission_id_idx
  on public.mission_enemy_entries(mission_id);
create index campaign_updates_campaign_revision_idx
  on public.campaign_updates(campaign_id, new_revision desc);
create index campaign_updates_mission_id_idx
  on public.campaign_updates(mission_id)
  where mission_id is not null;

comment on table public.live_campaign_states is
  'One authoritative display state per campaign. current_mission_id remains set after completion or abort so the final mission state stays available until the next activation.';
comment on column public.live_campaign_states.revision is
  'Campaign-wide command revision. Each successful transition or live-state mutation increments this value exactly once.';
comment on table public.campaign_updates is
  'Append-only audit history for successful authoritative campaign commands.';

alter table public.campaigns enable row level security;
alter table public.battlefields enable row level security;
alter table public.missions enable row level security;
alter table public.objectives enable row level security;
alter table public.mission_enemy_entries enable row level security;
alter table public.live_campaign_states enable row level security;
alter table public.campaign_updates enable row level security;

revoke all on table public.campaigns from anon, authenticated;
revoke all on table public.battlefields from anon, authenticated;
revoke all on table public.missions from anon, authenticated;
revoke all on table public.objectives from anon, authenticated;
revoke all on table public.mission_enemy_entries from anon, authenticated;
revoke all on table public.live_campaign_states from anon, authenticated;
revoke all on table public.campaign_updates from anon, authenticated;

commit;
