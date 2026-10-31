begin;

create or replace function public.get_public_sync_snapshot()
returns jsonb language sql stable security definer
set search_path = pg_catalog, public
as $$
  with active_campaigns as materialized (select * from public.get_public_active_campaign()),
  latest_signal as materialized (select * from public.get_public_latest_sync_signal())
  select jsonb_build_object(
    'active_campaign_count', (select count(*) from active_campaigns),
    'campaign', (
      select to_jsonb(ac) || jsonb_build_object('kill_teams', coalesce((
        select jsonb_agg(entry.value || jsonb_build_object(
          'chapter', ct.chapter,
          'leader_chapter', coalesce((select leader.chapter from public.campaign_kill_team_members leader where leader.campaign_kill_team_id=ct.id and leader.discord_user_id=ct.leader_discord_user_id), ct.chapter),
          'members', coalesce((
            select jsonb_agg(jsonb_build_object(
              'display_name', km.display_name, 'chapter', coalesce(cm.chapter, ct.chapter)
            ) order by km.display_name, km.id)
            from public.kill_team_members km
            left join public.campaign_kill_team_members cm
              on cm.campaign_kill_team_id = kt.campaign_kill_team_id and cm.discord_user_id = km.discord_user_id
            where km.kill_team_id = kt.id
          ), '[]'::jsonb)
        ) order by entry.ordinality)
        from jsonb_array_elements(to_jsonb(ac)->'kill_teams') with ordinality entry(value, ordinality)
        join public.kill_teams kt on kt.id = (entry.value->>'id')::uuid
        left join public.campaign_kill_teams ct on ct.id = kt.campaign_kill_team_id
      ), '[]'::jsonb))
      from active_campaigns ac limit 1
    ),
    'signal', (select to_jsonb(signal) from latest_signal signal)
  );
$$;

commit;
