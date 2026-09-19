begin;

create extension if not exists pgtap;
set local search_path = public, extensions, pg_catalog;

select plan(7);

select ok(
  exists (
    select 1
    from storage.buckets
    where id = 'crusade-evidence'
      and name = 'crusade-evidence'
  ),
  'Crusade evidence has a dedicated Storage bucket'
);

select is(
  (select public from storage.buckets where id = 'crusade-evidence'),
  false,
  'the evidence bucket is private'
);

select is(
  (select file_size_limit from storage.buckets where id = 'crusade-evidence'),
  10485760::bigint,
  'the evidence bucket enforces the ten MiB limit'
);

select ok(
  (
    select allowed_mime_types @> array['image/png', 'image/jpeg', 'image/webp']
      and cardinality(allowed_mime_types) = 3
    from storage.buckets
    where id = 'crusade-evidence'
  ),
  'the evidence bucket accepts only the approved image MIME types'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Command staff read Crusade evidence'
      and cmd = 'SELECT'
      and roles = array['authenticated'::name]
  ),
  1::bigint,
  'only authenticated sessions receive the staff evidence read policy'
);

select ok(
  (
    select qual like '%bucket_id%crusade-evidence%'
      and qual like '%current_app_role%'
      and qual like '%ADMINISTRATOR%'
      and qual like '%MODERATOR%'
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Command staff read Crusade evidence'
  ),
  'the read policy restricts the bucket to Administrator and Moderator roles'
);

select is(
  (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
      and coalesce(qual, '') || coalesce(with_check, '') like '%crusade-evidence%'
  ),
  0::bigint,
  'browser roles have no direct evidence write policy'
);

select * from finish();
rollback;
