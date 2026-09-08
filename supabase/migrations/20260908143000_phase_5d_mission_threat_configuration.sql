begin;

alter table public.missions
  add column mission_boss_key text,
  add column mission_boss_display_name text,
  add constraint missions_mission_boss_complete check (
    (mission_boss_key is null and mission_boss_display_name is null)
    or (
      mission_boss_key is not null
      and mission_boss_display_name is not null
      and length(btrim(mission_boss_key)) > 0
      and length(btrim(mission_boss_display_name)) > 0
    )
  );

create table public.mission_crusade_scoring_targets (
  mission_id uuid not null references public.missions(id)
    on update restrict on delete cascade,
  target_key text not null,
  display_name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (mission_id, target_key),
  constraint mission_crusade_scoring_targets_key_not_blank check (
    length(btrim(target_key)) > 0
  ),
  constraint mission_crusade_scoring_targets_display_name_not_blank check (
    length(btrim(display_name)) > 0
  ),
  constraint mission_crusade_scoring_targets_sort_order_nonnegative check (
    sort_order >= 0
  ),
  constraint mission_crusade_scoring_targets_mission_sort_order_unique unique (
    mission_id,
    sort_order
  )
);

create index mission_crusade_scoring_targets_mission_id_idx
  on public.mission_crusade_scoring_targets(mission_id);

create trigger mission_crusade_scoring_targets_set_updated_at
before update on public.mission_crusade_scoring_targets
for each row execute function public.set_row_updated_at();

alter table public.mission_crusade_scoring_targets enable row level security;

revoke all on table public.mission_crusade_scoring_targets
  from anon, authenticated;

grant select on table public.mission_crusade_scoring_targets to authenticated;

create policy mission_crusade_scoring_target_staff_read
on public.mission_crusade_scoring_targets
for select
to authenticated
using (
  (select public.current_app_role()) in ('ADMINISTRATOR', 'MODERATOR')
);

drop function public.get_public_sync_snapshot();
drop function public.get_public_active_campaign();

create function public.get_public_active_campaign()
returns table (
  campaign_id uuid,
  campaign_name text,
  campaign_description text,
  mission_id uuid,
  mission_name text,
  mission_description text,
  mission_status public.mission_status,
  battlefield_id uuid,
  battlefield_name text,
  battlefield_description text,
  enemy_faction text,
  campaign_progress smallint,
  revision bigint,
  updated_at timestamptz,
  objectives jsonb,
  enemies jsonb,
  mission_boss jsonb,
  crusade_scoring_targets jsonb
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    c.id,
    c.name,
    coalesce(c.description, ''),
    m.id,
    m.name,
    coalesce(m.description, ''),
    m.status,
    b.id,
    b.name,
    coalesce(b.description, ''),
    coalesce(m.enemy_faction, ''),
    lcs.campaign_progress,
    lcs.revision,
    lcs.updated_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', o.id,
            'title', o.title,
            'description', o.description,
            'status', o.status,
            'sort_order', o.sort_order
          ) order by o.sort_order, o.id
        )
        from public.objectives as o
        where o.mission_id = m.id
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', mee.id,
            'name', mee.name,
            'enemy_type', mee.enemy_type,
            'description', mee.description,
            'sort_order', mee.sort_order
          ) order by mee.sort_order, mee.id
        )
        from public.mission_enemy_entries as mee
        where mee.mission_id = m.id
      ),
      '[]'::jsonb
    ),
    case
      when m.mission_boss_key is null then null::jsonb
      else jsonb_build_object(
        'id', m.mission_boss_key,
        'name', m.mission_boss_display_name,
        'description', null
      )
    end,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', target.target_key,
            'name', target.display_name,
            'description', null,
            'sort_order', target.sort_order
          ) order by target.sort_order, target.target_key
        )
        from public.mission_crusade_scoring_targets as target
        where target.mission_id = m.id
      ),
      '[]'::jsonb
    )
  from public.live_campaign_states as lcs
  join public.campaigns as c on c.id = lcs.campaign_id
  join public.missions as m on m.id = lcs.current_mission_id
  join public.battlefields as b on b.id = m.battlefield_id
  where c.status = 'ACTIVE'
    and m.status = 'ACTIVE'
  order by c.created_at, c.id
$$;

create function public.get_public_sync_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with active_campaigns as materialized (
    select *
    from public.get_public_active_campaign()
  ),
  latest_signal as materialized (
    select *
    from public.get_public_latest_sync_signal()
  )
  select jsonb_build_object(
    'active_campaign_count', (
      select count(*)
      from active_campaigns
    ),
    'campaign', (
      select to_jsonb(active_campaign)
      from active_campaigns as active_campaign
      limit 1
    ),
    'signal', (
      select to_jsonb(signal)
      from latest_signal as signal
    )
  )
$$;

revoke all on function public.get_public_active_campaign()
  from public, anon, authenticated;
revoke all on function public.get_public_sync_snapshot()
  from public, anon, authenticated;

grant execute on function public.get_public_active_campaign()
  to anon, authenticated;
grant execute on function public.get_public_sync_snapshot()
  to anon, authenticated;

commit;
