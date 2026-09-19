insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'crusade-evidence',
  'crusade-evidence',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Command staff read Crusade evidence"
  on storage.objects;

create policy "Command staff read Crusade evidence"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'crusade-evidence'
  and (select public.current_app_role()) in ('ADMINISTRATOR', 'MODERATOR')
);
